import { useEffect, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate } from "../utils/dates";

const timeLeft = (date) => {
  const ms = new Date(date) - new Date();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m left`;
};

export default function SharedRooms() {
  const [shares, setShares] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get("/shares");
      setShares(res.data.data);
    } catch (err) {
      setMessage(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const apply = async (id) => {
    try {
      await api.post(`/shares/${id}/apply`);
      await load();
      setMessage("Request sent. The room owner will review it.");
    } catch (err) {
      const message = errMsg(err);
      await load();
      setMessage(message);
    }
  };

  return (
    <div>
      <h2>Rooms looking for a partner</h2>
      <p className="muted">Join a booked room and pay only half.</p>
      {message && <p className="notice">{message}</p>}
      {loading && <p className="muted">Loading shared rooms...</p>}
      {!loading && shares.length === 0 && !message && <p>No open requests right now. Check back soon.</p>}

      {shares.map((s) => {
        const property = s.booking?.property;
        if (!property) return null;
        return (
          <div className="row-card" key={s._id}>
            <img src={imageUrl(property.images?.[0])} alt={property.title} />
            <div className="grow">
              <h3>{property.title}</h3>
              <p className="muted">{property.location}</p>
              <p>{formatDate(s.booking.checkIn)} to {formatDate(s.booking.checkOut)}</p>
              <p>Posted by {s.requester?.name || "A guest"} - <strong>{timeLeft(s.expiresAt)}</strong></p>
            </div>
            <div className="actions">
              <p>Your share <strong>₹{s.splitAmount}</strong></p>
              {!s.sameGender && <p className="muted">This room is matched with guests of the same gender.</p>}
              <button className="btn-primary" disabled={!s.sameGender || Boolean(s.applicationStatus)} onClick={() => apply(s._id)}>{s.applicationStatus ? `Request ${s.applicationStatus}` : "Request to share"}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
