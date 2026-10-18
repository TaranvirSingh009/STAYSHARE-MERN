import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";
import { formatDate, todayInputValue } from "../utils/dates";
import { useAuth } from "../context/AuthContext";

export default function PropertyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [booked, setBooked] = useState([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      api.get(`/properties/${id}`),
      api.get(`/bookings/property/${id}/dates`),
      api.get(`/properties/${id}/reviews`),
    ])
      .then(([propertyRes, datesRes, reviewsRes]) => {
        if (cancelled) return;
        setProperty(propertyRes.data.data);
        setBooked(datesRes.data.data);
        setReviews(reviewsRes.data.data.reviews);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Could not load this stay.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="center">Loading...</p>;
  if (!property) return <p className="center error">{error || "Stay not found."}</p>;

  const nights = checkIn && checkOut
    ? Math.floor((new Date(checkOut) - new Date(checkIn)) / 86400000)
    : 0;
  const clashes = booked.some((b) =>
    new Date(checkIn) < new Date(b.checkOut) && new Date(checkOut) > new Date(b.checkIn)
  );

  const handleBook = async () => {
    setError("");
    if (!user) return navigate("/login");
    setPaying(true);
    try {
      const scriptLoaded = await new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      if (!scriptLoaded) throw new Error("Could not load Razorpay checkout. Check your connection and try again.");

      const { data } = await api.post("/bookings", { propertyId: id, checkIn, checkOut });
      const { booking, payment } = data.data;
      const options = {
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "StayShare",
        description: `${property.title} · ${nights} night${nights === 1 ? "" : "s"}`,
        order_id: payment.orderId,
        handler: async (result) => {
          try {
            await api.post(`/bookings/${booking._id}/verify-payment`, result);
            navigate(`/receipt/${booking._id}`);
          } catch (err) {
            setError(errMsg(err));
            setPaying(false);
          }
        },
        modal: {
          ondismiss: async () => {
            await api.patch(`/bookings/${booking._id}/cancel`).catch(() => {});
            setPaying(false);
          },
        },
        prefill: { name: user.name, email: user.email },
        theme: { color: "#1f6f5c" },
      };
      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        api.patch(`/bookings/${booking._id}/cancel`).finally(() => setPaying(false));
      });
      checkout.open();
    } catch (err) {
      setError(errMsg(err));
      setPaying(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault(); setError("");
    try {
      const result = await api.post(`/properties/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      setReviews((items) => [result.data.data, ...items]); setReviewComment("");
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <div>
      <h1>{property.title}</h1>
      <p className="muted">{property.location} - {property.type} - up to {property.maxGuests} guests</p>

      <div className="gallery">
        {(property.images || []).map((img) => <img key={img} src={imageUrl(img)} alt={property.title} />)}
      </div>

      <div className="details">
        <div>
          <h3>About this place</h3>
          <p>{property.description}</p>
          <p className="muted">Hosted by {property.owner?.name}</p>
          {(property.contactPhone || property.contactEmail) && <p className="muted">Stay contact: {property.contactPhone && <a href={`tel:${property.contactPhone}`}>{property.contactPhone}</a>} {property.contactEmail && <a href={`mailto:${property.contactEmail}`}>{property.contactEmail}</a>}</p>}
        </div>

        <div className="booking-box">
          <p><strong>₹{property.price}</strong> / night</p>
          <label htmlFor="check-in">Check-in</label>
          <input id="check-in" type="date" min={todayInputValue()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setCheckOut(""); }} />
          <label htmlFor="check-out">Check-out</label>
          <input id="check-out" type="date" min={checkIn || todayInputValue()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={!checkIn} />

          {nights > 0 && <p>{nights} nights - total <strong>₹{nights * property.price}</strong></p>}
          {clashes && <p className="error">These dates are already booked.</p>}
          {error && <p className="error">{error}</p>}

          <button
            className="btn-primary"
            disabled={paying || !nights || nights < 1 || clashes || user?.role === "admin" || user?.role === "superadmin"}
            onClick={handleBook}
          >{paying ? "Opening secure checkout..." : "Reserve"}</button>
          {user && user.role !== "user" && <p className="muted">Only guest accounts can book.</p>}

          {booked.length > 0 && (
            <>
              <h4>Unavailable dates</h4>
              <ul className="plain">
                {booked.map((b) => <li key={b._id}>{formatDate(b.checkIn)} to {formatDate(b.checkOut)}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
      <section className="reviews-section">
        <h2>Guest reviews {reviews.length > 0 && <span className="muted">· ★ {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} ({reviews.length})</span>}</h2>
        {user?.role === "user" && <form className="form-box wide" onSubmit={submitReview}><h3>Stayed here? Leave a review</h3><select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}</select><textarea placeholder="Share what future guests should know" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} maxLength={1200} /><button className="btn-primary">Post review</button></form>}
        {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {reviews.map((r) => <article className="review-card" key={r._id}><strong>★ {r.rating}/5 · {r.user?.name || "Guest"}</strong><p>{r.comment}</p></article>)}
      </section>
    </div>
  );
}
