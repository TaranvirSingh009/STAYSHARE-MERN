import { useEffect, useRef, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate } from "../utils/dates";

const empty = { title: "", description: "", price: "", location: "", contactPhone: "", contactEmail: "", type: "flat", maxGuests: 2 };
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export default function AdminDashboard() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(empty);
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
    files.forEach((file) => data.append("images", file));
    try {
      await api.post("/properties", data);
      setMessage("Listing submitted. It will appear publicly after admin approval.");
      setForm(empty);
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
    try {
      await api.delete(`/properties/${id}`);
      setMessage("Listing hidden");
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

  const updateAttendance = async (bookingId, guestId, status) => {
    try {
      const result = await api.patch(`/bookings/owner/${bookingId}/guest/${guestId}/attendance`, { status });
      setMessage(result.data.message);
      await load();
    } catch (err) { setMessage(errMsg(err)); }
  };

  const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);

  return (
    <div>
      <h2>Host dashboard</h2>
      {message && <p className="notice">{message}</p>}

      {stats && <section className="stats host-stats">
        <div><strong>{money(stats.totalCollected)}</strong><span>Paid via Razorpay</span><small>Captured payments only</small></div>
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
        <input name="contactPhone" type="tel" placeholder="Stay helpline phone (shown on receipts)" value={form.contactPhone} onChange={handleChange} />
        <input name="contactEmail" type="email" placeholder="Stay contact email (shown on receipts)" value={form.contactEmail} onChange={handleChange} />
        <input name="price" type="number" min="1" placeholder="Price per night (₹)" value={form.price} onChange={handleChange} required />
        <input name="maxGuests" type="number" min="1" placeholder="Max guests" value={form.maxGuests} onChange={handleChange} />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="flat">Flat</option>
          <option value="apartment">Apartment</option>
          <option value="hotel">Hotel</option>
          <option value="hostel">Hostel</option>
        </select>
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
            {p.isActive === false && <span className="badge">Hidden</span>}
          </div>
          {p.isActive === false ? (
            <button className="btn-outline" onClick={() => handleRestore(p._id)}>Restore</button>
          ) : (
            <button className="btn-outline" onClick={() => handleDelete(p._id)}>Hide listing</button>
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
        <header className="host-booking-heading"><div><h4>{b.property?.title || "Stay"}</h4><span className="muted">{b.property?.location} · {formatDate(b.checkIn)} to {formatDate(b.checkOut)}</span></div><strong>{money(b.totalPrice)}</strong></header>
        <p className="muted">Booking {b._id} · {b.nights} night{b.nights === 1 ? "" : "s"} · {b.shareStatus === "shared" ? "Shared booking" : "Standard booking"}</p>
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
