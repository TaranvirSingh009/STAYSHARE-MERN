import { useEffect, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate } from "../utils/dates";
import { useAuth } from "../context/AuthContext";

export default function MyBookings() {
  const { user, updateProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ phone: user?.phone || "", gender: user?.gender === "prefer_not_to_say" ? "" : user?.gender || "" });

  const load = async () => {
    try {
      const [res, appRes] = await Promise.all([api.get("/bookings/mine"), api.get("/shares/applications/mine")]);
      setBookings(res.data.data);
      setApplications(appRes.data.data);
    } catch (err) {
      setMessage(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (request) => {
    try {
      const res = await request();
      setMessage(res.data.message);
      await load();
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const isFuture = (booking) => new Date(booking.checkIn) > new Date();

  const decideApplication = async (id, decision) => {
    try { const res = await api.patch(`/shares/applications/${id}`, { decision }); setMessage(res.data.message); await load(); }
    catch (err) { setMessage(errMsg(err)); }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try { const updated = await updateProfile(profileForm); setProfileForm({ phone: updated.phone, gender: updated.gender }); setMessage("Profile submitted for admin verification"); }
    catch (err) { setMessage(errMsg(err)); }
  };

  return (
    <div>
      <h2>My bookings</h2>
      {message && <p className="notice">{message}</p>}
      {user?.role === "user" && <form className="form-box wide profile-form" onSubmit={saveProfile}><h3>Profile verification</h3><p className="muted">Your profile status: <strong>{user.verificationStatus || "verified"}</strong>. Add or update your phone and gender; the superadmin reviews changes before you book or share a room.</p><input aria-label="Phone number" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit phone number" placeholder="9876543210" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required /><select aria-label="Gender" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })} required><option value="" disabled>Select gender</option><option value="male">Man</option><option value="female">Woman</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select><button className="btn-outline">Submit for verification</button></form>}
      {loading && <p className="muted">Loading bookings...</p>}
      {!loading && bookings.length === 0 && !message && <p>No bookings yet. Find a stay on the home page.</p>}

      <section>
        <h3>Guest requests to share your bookings</h3>
        {applications.length === 0 && <p className="muted">No pending share requests.</p>}
        {applications.map((a) => <div className="row-card" key={a._id}>
          <div className="grow">
            <strong>{a.applicant?.name}</strong>
            <p className="muted">{a.applicant?.email} · {a.applicant?.phone} · {a.applicant?.gender}</p>
            <p>{a.share?.booking?.property?.title} · {a.applicant?.gender === "male" ? "Man" : a.applicant?.gender === "female" ? "Woman" : "Non-binary"}</p>
            {a.message && <p>{a.message}</p>}
            <p className="muted">If approved, each guest pays ₹{a.share?.splitAmount} directly to the host at check-in.</p>
          </div>
          <button className="btn-primary" onClick={() => decideApplication(a._id, "accepted")}>Accept request</button>
          <button className="btn-outline" onClick={() => decideApplication(a._id, "rejected")}>Decline</button>
        </div>)}
      </section>

      {bookings.map((b) => {
        if (!b.property || !b.user) return null;
        const isOwner = b.user._id === user?._id;
        const myShare = isOwner ? b.userPays : b.partnerPays;
        return (
          <div className="row-card" key={b._id}>
            <img src={imageUrl(b.property.images?.[0])} alt={b.property.title} />
            <div className="grow">
              <h3>{b.property.title}</h3>
              <p className="muted">{b.property.location}</p>
              <p>{formatDate(b.checkIn)} to {formatDate(b.checkOut)} - {b.nights} nights</p>
              <p>You pay <strong>₹{myShare}</strong> of ₹{b.totalPrice}</p>
              <span className={`badge ${b.status === "cancelled" ? "red" : ""}`}>{b.status === "pending_payment" ? "Payment pending" : b.status}</span>{" "}
              {b.status === "confirmed" && <span className={`badge ${b.paymentStatus === "paid" ? "green" : ""}`}>
                {b.paymentStatus === "paid" ? "Paid" : "Pay at check-in"}
              </span>}
              {b.shareStatus === "open" && <span className="badge">Looking for a partner</span>}
              {b.shareStatus === "shared" && (
                <span className="badge green">Shared with {isOwner ? b.partner?.name : b.user.name}</span>
              )}
            </div>

            {isOwner && ["confirmed", "pending_payment"].includes(b.status) && isFuture(b) && (
              <div className="actions">
                {b.status === "confirmed" && b.shareStatus === "none" && (
                  <button className="btn-primary" onClick={() => act(() => api.post(`/shares/${b._id}`))}>Share with network</button>
                )}
                {b.status === "confirmed" && b.shareStatus === "open" && (
                  <button className="btn-outline" onClick={() => act(() => api.delete(`/shares/${b._id}`))}>Stop searching</button>
                )}
                {b.status === "confirmed" && b.shareStatus !== "shared" && <p className="muted">Visible to verified guests with matching profile details for up to 24 hours or until check-in, whichever comes first.</p>}
                {b.status === "pending_payment" && (
                  <button className="btn-outline" onClick={() => act(() => api.patch(`/bookings/${b._id}/cancel`))}>Cancel payment hold</button>
                )}
                {b.status === "confirmed" && b.shareStatus !== "shared" && (
                  <button className="btn-outline" onClick={() => act(() => api.patch(`/bookings/${b._id}/cancel`))}>Cancel booking</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
