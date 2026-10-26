import { useEffect, useRef, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate } from "../utils/dates";

const empty = { title: "", description: "", price: "", location: "", contactPhone: "", contactEmail: "", type: "flat", maxGuests: 2 };
const newRoomType = () => ({ name: "", pricePerNight: "", maxGuests: 2, quantity: 1 });
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const isPropertyPublished = (property) => property.isPublished ?? (property.approvalStatus === "approved" && property.isActive !== false);

export default function AdminDashboard() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(empty);
  const [roomTypes, setRoomTypes] = useState([newRoomType()]);
  const [editingRoomPropertyId, setEditingRoomPropertyId] = useState("");
  const [roomTypeDraft, setRoomTypeDraft] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const load = async () => {
    try {
      const [p, overview] = await Promise.all([api.get("/properties/mine"), api.get("/bookings/owner/overview")]);
      setProperties(p.data.data);
      setBookings(overview.data.data.bookings);
      setStats(overview.data.data.stats);
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addFiles = (incoming) => {
    const picked = Array.from(incoming || []);
    const valid = picked.filter((file) => allowedImageTypes.has(file.type) && file.size <= 5 * 1024 * 1024);
    setFiles((current) => {
      const merged = [...current, ...valid].filter((file, index, all) => all.findIndex((other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index);
      return merged.slice(0, 5);
    });
    if (valid.length !== picked.length) setMessage("Choose image files up to 5 MB each. Some files were skipped.");
    else if (files.length + valid.length > 5) setMessage("You can add up to 5 photos per listing.");
    else setMessage("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!files.length) { setMessage("Add at least one photo of your place before publishing."); return; }
    setSaving(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (form.type === "hotel") data.append("roomTypes", JSON.stringify(roomTypes));
    files.forEach((file) => data.append("images", file));
    try {
      await api.post("/properties", data);
      setMessage("Listing submitted. It will appear publicly after admin approval.");
      setForm(empty);
      setRoomTypes([newRoomType()]);
      setFiles([]);
      e.target.reset();
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this listing from guest search? Existing bookings are kept, and you can restore the listing later.")) return;
    try {
      await api.delete(`/properties/${id}`);
      setMessage("Listing removed from guest search");
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.patch(`/properties/${id}/restore`);
      setMessage("Listing restored");
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const togglePublished = async (property) => {
    const published = isPropertyPublished(property);
    try {
      let result;
      let usingLegacyRoute = false;
      try {
        result = await api.patch(`/properties/${property._id}/publish`, { published: !published });
      } catch (err) {
        if (err.response?.status !== 404) throw err;
        usingLegacyRoute = true;
        result = published
          ? await api.delete(`/properties/${property._id}`)
          : await api.patch(`/properties/${property._id}/restore`);
      }

      const updated = result.data.data;
      setProperties((current) => current.map((item) => item._id === property._id
        ? {
          ...item,
          ...(updated || {}),
          isPublished: !published,
          ...(usingLegacyRoute ? { isActive: !published } : {}),
        }
        : item));
      setMessage(result.data.message || (!published ? "Listing is now live" : "Listing taken offline"));
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const saveRoomTypes = async (id) => {
    try {
      await api.patch(`/properties/${id}/room-types`, { roomTypes: roomTypeDraft });
      setEditingRoomPropertyId("");
      setRoomTypeDraft([]);
      setMessage("Hotel room types updated");
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const updateAttendance = async (bookingId, guestId, status) => {
    try {
      const result = await api.patch(`/bookings/owner/${bookingId}/guest/${guestId}/attendance`, { status });
      setMessage(result.data.message);
      await load();
    } catch (err) { setMessage(errMsg(err)); }
  };

  const recordCashPayment = async (booking) => {
    const payerDescription = booking.shareStatus === "shared" ? "both guests together" : "the guest";
    if (!window.confirm(`Confirm that you received the full booking amount of ${money(booking.totalPrice)} from ${payerDescription}?`)) return;
    try {
      const result = await api.patch(`/bookings/owner/${booking._id}/payment`);
      setMessage(result.data.message);
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);

  return (
    <div>
      <h2>Host dashboard</h2>
      {message && <p className="notice">{message}</p>}

      {stats && <section className="stats host-stats">
        <div><strong>{money(stats.totalCollected)}</strong><span>Collected booking payments</span><small>Host-recorded payments</small></div>
        <div><strong>{money(stats.confirmedValue)}</strong><span>Confirmed booking value</span></div>
        <div><strong>{stats.confirmedBookings}</strong><span>Confirmed bookings</span></div>
        <div><strong>{stats.upcomingBookings}</strong><span>Upcoming stays</span></div>
        <div><strong>{stats.activeBookings}</strong><span>Currently staying</span></div>
        <div><strong>{stats.arrivalsToday}</strong><span>Guests arriving today</span></div>
        <div><strong>{stats.departuresToday}</strong><span>Guests departing today</span></div>
        <div><strong>{stats.checkedInGuests}</strong><span>Checked in</span></div>
        <div><strong>{stats.checkedOutGuests}</strong><span>Checked out</span></div>
      </section>}

      <form className="form-box wide" onSubmit={handleSubmit}>
        <h3>List a new space</h3>
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} required />
        <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} required />
        <input name="location" placeholder="City / area" value={form.location} onChange={handleChange} required />
        <input name="contactPhone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit phone number" placeholder="Stay helpline phone (10 digits)" value={form.contactPhone} onChange={handleChange} />
        <input name="contactEmail" type="email" placeholder="Stay contact email (shown on receipts)" value={form.contactEmail} onChange={handleChange} />
        <input name="price" type="number" min="1" placeholder="Price per night (₹)" value={form.price} onChange={handleChange} required />
        <input name="maxGuests" type="number" min="1" placeholder="Max guests" value={form.maxGuests} onChange={handleChange} />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="flat">Flat</option>
          <option value="apartment">Apartment</option>
          <option value="hotel">Hotel</option>
          <option value="hostel">Hostel</option>
        </select>
        {form.type === "hotel" && (
          <RoomTypeEditor roomTypes={roomTypes} setRoomTypes={setRoomTypes} />
        )}
        {form.type === "hotel" && <p className="muted">Room rates are shown on the listing for reference. Reservations still use the listing’s price above.</p>}
        <section className="photo-upload-section" aria-label="Listing photos">
          <div className="photo-upload-heading"><div><strong>Property photos</strong><span>Help guests picture their stay</span></div><small>{files.length}/5 added</small></div>
          <label className={`photo-dropzone ${dragging ? "is-dragging" : ""}`} htmlFor="property-photos" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
            <input ref={fileInput} className="photo-file-input" id="property-photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={(e) => addFiles(e.target.files)} />
            <span className="photo-upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="photo-upload-copy"><strong>Drop your photos here</strong><small>or <span className="photo-browse">browse files</span> from your device</small></span>
            <span className="photo-format-note">JPG, PNG, WEBP, GIF, AVIF · Up to 5 photos, 5 MB each</span>
          </label>
          {files.length > 0 && <div className="photo-preview-grid">{files.map((file, index) => <article className="photo-preview" key={`${file.name}-${file.lastModified}`}><img src={previews[index]} alt={`Preview of ${file.name}`} /><div className="photo-preview-info"><strong title={file.name}>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(1)} MB {index === 0 ? "· Cover photo" : ""}</small></div><button type="button" className="photo-remove" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></article>)}</div>}
        </section>
        <button className="btn-primary" disabled={saving}>{saving ? "Submitting listing…" : "Submit for approval"}</button>
      </form>

      <h3>Your listings</h3>
      {properties.length === 0 && <p>You have not listed anything yet.</p>}
      {properties.map((p) => (
        <div className="row-card" key={p._id}>
          <img src={imageUrl(p.images?.[0])} alt={p.title} />
          <div className="grow">
            <h4>{p.title}</h4>
            <span className={`badge ${p.approvalStatus === "approved" ? "green" : p.approvalStatus === "rejected" ? "red" : ""}`}>Approval: {p.approvalStatus || "approved"}</span>
            {p.approvalNote && <p className="muted">Admin note: {p.approvalNote}</p>}
            <p className="muted">{p.location} - ₹{p.price} / night</p>
            <span className={`badge ${p.isActive !== false && isPropertyPublished(p) ? "green" : ""}`}>
              {p.isActive === false ? "Listing hidden" : isPropertyPublished(p) ? "Live" : "Not live"}
            </span>
            {p.type === "hotel" && <p className="muted">{p.roomTypes?.length || 0} room types</p>}
          </div>
          {p.approvalStatus === "approved" && p.isActive !== false && <button className="btn-primary" onClick={() => togglePublished(p)}>{isPropertyPublished(p) ? "Take offline" : "Publish live"}</button>}
          {p.isActive === false ? (
            <button className="btn-outline" onClick={() => handleRestore(p._id)}>Restore</button>
          ) : (
            <button className="btn-outline" onClick={() => handleDelete(p._id)}>Delete listing</button>
          )}
          {p.type === "hotel" && (
            <div className="hotel-room-management">
              {editingRoomPropertyId === p._id ? (
                <>
                  <RoomTypeEditor roomTypes={roomTypeDraft} setRoomTypes={setRoomTypeDraft} />
                  <button className="btn-primary" onClick={() => saveRoomTypes(p._id)}>Save room types</button>
                  <button className="btn-outline" onClick={() => { setEditingRoomPropertyId(""); setRoomTypeDraft([]); }}>Cancel</button>
                </>
              ) : (
                <>
                  {p.roomTypes?.length > 0 && <ul className="plain">{p.roomTypes.map((room) => <li key={room._id || room.name}>{room.name} · ₹{room.pricePerNight}/night · up to {room.maxGuests} guests · {room.quantity} rooms</li>)}</ul>}
                  <button className="btn-outline" onClick={() => { setEditingRoomPropertyId(p._id); setRoomTypeDraft(p.roomTypes?.length ? p.roomTypes.map(({ name, pricePerNight, maxGuests, quantity }) => ({ name, pricePerNight, maxGuests, quantity })) : [newRoomType()]); }}>Manage room types</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <h3>Upcoming bookings</h3>
      {bookings.length === 0 && <p>No bookings yet.</p>}
      <ul className="plain">
        {bookings.map((b) => (
          <li key={b._id}>
            {b.property?.title}: {b.user?.name} ({formatDate(b.checkIn)} to {formatDate(b.checkOut)}) - ₹{b.totalPrice}
          </li>
        ))}
      </ul>

      <h3>Guest arrivals, verification & check-out</h3>
      <p className="muted">Review the booking details and guest contact information. After checking the guest at the property, mark them checked in; mark check-out when they leave.</p>
      {bookings.length === 0 && <p>No confirmed guest stays yet.</p>}
      {bookings.map((b) => <article className="host-booking" key={`guests-${b._id}`}>
        <header className="host-booking-heading"><div><h4>{b.property?.title || "Stay"}</h4><span className="muted">{b.property?.location} · {formatDate(b.checkIn)} to {formatDate(b.checkOut)}</span></div><div><strong>{money(b.totalPrice)}</strong><p><span className={`badge ${b.paymentStatus === "paid" ? "green" : ""}`}>{b.paymentStatus === "paid" ? "Paid" : "Cash due at check-in"}</span></p></div></header>
        <p className="muted">Booking {b._id} · {b.nights} night{b.nights === 1 ? "" : "s"} · {b.shareStatus === "shared" ? "Shared booking" : "Standard booking"}</p>
        {b.paymentStatus !== "paid" && new Date() >= new Date(b.checkIn) && new Date() < new Date(b.checkOut) && <button className="btn-primary" onClick={() => recordCashPayment(b)}>Confirm cash received · {money(b.totalPrice)}</button>}
        {b.paymentMethod === "cash_on_checkin" && b.paymentStatus === "paid" && b.paymentReceivedAt && <p className="muted">Cash payment recorded {new Date(b.paymentReceivedAt).toLocaleString()}</p>}
        <div className="host-guest-list">{[b.user, b.partner].filter(Boolean).map((guest) => {
          const attendance = b.guestAttendance?.find((entry) => String(entry.guest?._id || entry.guest) === String(guest._id));
          const status = attendance?.status || "expected";
          return <div className="host-guest" key={guest._id}>
            <div className="host-guest-details"><strong>{guest.name}</strong><span>{guest.email}</span>{guest.phone && <a href={`tel:${guest.phone}`}>{guest.phone}</a>}</div>
            <div className="host-guest-action"><span className={`badge ${status === "checked_in" ? "green" : status === "checked_out" ? "green" : ""}`}>{status.replaceAll("_", " ")}</span>{status === "expected" && <button className="btn-primary" onClick={() => updateAttendance(b._id, guest._id, "checked_in")}>Verify & check in</button>}{status === "checked_in" && <button className="btn-outline" onClick={() => updateAttendance(b._id, guest._id, "checked_out")}>Mark checked out</button>}{attendance?.verifiedBy?.name && <small>Host: {attendance.verifiedBy.name}{attendance.checkedInAt ? ` · ${new Date(attendance.checkedInAt).toLocaleString()}` : ""}</small>}</div>
          </div>;
        })}</div>
      </article>)}
    </div>
  );
}

function RoomTypeEditor({ roomTypes, setRoomTypes }) {
  const updateRoom = (index, field, value) => {
    setRoomTypes((current) => current.map((room, roomIndex) => roomIndex === index ? { ...room, [field]: value } : room));
  };

  return (
    <section className="room-type-editor">
      <h4>Hotel room types</h4>
      <p className="muted">Set a nightly rate, guest limit, and number of rooms for each type.</p>
      {roomTypes.map((room, index) => (
        <fieldset className="room-type-fields" key={index}>
          <legend>Room type {index + 1}</legend>
          <input aria-label={`Room type ${index + 1} name`} maxLength={80} placeholder="e.g. Standard Double" value={room.name} onChange={(event) => updateRoom(index, "name", event.target.value)} required />
          <input aria-label={`Room type ${index + 1} price per night`} type="number" min="1" placeholder="Price per night (₹)" value={room.pricePerNight} onChange={(event) => updateRoom(index, "pricePerNight", event.target.value)} required />
          <input aria-label={`Room type ${index + 1} guest capacity`} type="number" min="1" step="1" placeholder="Guests" value={room.maxGuests} onChange={(event) => updateRoom(index, "maxGuests", event.target.value)} required />
          <input aria-label={`Room type ${index + 1} quantity`} type="number" min="1" step="1" placeholder="Number of rooms" value={room.quantity} onChange={(event) => updateRoom(index, "quantity", event.target.value)} required />
          {roomTypes.length > 1 && <button type="button" className="btn-outline" onClick={() => setRoomTypes((current) => current.filter((_, roomIndex) => roomIndex !== index))}>Remove type</button>}
        </fieldset>
      ))}
      {roomTypes.length < 30 && <button type="button" className="btn-outline" onClick={() => setRoomTypes((current) => [...current, newRoomType()])}>Add room type</button>}
    </section>
  );
}
