import { useEffect, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate } from "../utils/dates";

const empty = { title: "", description: "", price: "", location: "", type: "flat", maxGuests: 2 };

export default function AdminDashboard() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [p, b] = await Promise.all([api.get("/properties/mine"), api.get("/bookings/owner")]);
      setProperties(p.data.data);
      setBookings(b.data.data);
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
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

  return (
    <div>
      <h2>Host dashboard</h2>
      {message && <p className="notice">{message}</p>}

      <form className="form-box wide" onSubmit={handleSubmit}>
        <h3>List a new space</h3>
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} required />
        <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} required />
        <input name="location" placeholder="City / area" value={form.location} onChange={handleChange} required />
        <input name="price" type="number" min="1" placeholder="Price per night (₹)" value={form.price} onChange={handleChange} required />
        <input name="maxGuests" type="number" min="1" placeholder="Max guests" value={form.maxGuests} onChange={handleChange} />
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="flat">Flat</option>
          <option value="apartment">Apartment</option>
          <option value="hotel">Hotel</option>
          <option value="hostel">Hostel</option>
        </select>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={(e) => setFiles([...e.target.files].slice(0, 5))} required />
        <button className="btn-primary">Publish listing</button>
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
    </div>
  );
}
