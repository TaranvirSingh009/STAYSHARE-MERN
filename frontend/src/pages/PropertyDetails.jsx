import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  const [reviewableBookingIds, setReviewableBookingIds] = useState([]);
  const canReview = reviewableBookingIds.length > 0;
  const [reviewStatusLoaded, setReviewStatusLoaded] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [postingReview, setPostingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setReviewableBookingIds([]);
    setReviewStatusLoaded(false);
    setReviewError("");
    Promise.all([
      api.get(`/properties/${id}`),
      api.get(`/bookings/property/${id}/dates`),
      api.get(`/properties/${id}/reviews`),
    ])
      .then(([propertyRes, datesRes, reviewsRes]) => {
        if (cancelled) return;
        const loadedProperty = propertyRes.data.data;
        setProperty(loadedProperty);
        setBooked(datesRes.data.data);
        setReviews(reviewsRes.data.data.reviews);
        if (user?.role === "user") {
          api.get("/bookings/mine")
            .then((bookingsRes) => {
              if (cancelled) return;
              const completedBookings = bookingsRes.data.data.filter((booking) =>
                String(booking.property?._id) === String(id)
                && booking.status === "confirmed"
                && new Date(booking.checkOut) <= new Date()
              );
              const reviewedBookingIds = new Set(
                reviewsRes.data.data.reviews
                  .filter((review) => String(review.user?._id) === String(user._id))
                  .map((review) => String(review.booking))
              );
              setReviewableBookingIds(
                completedBookings
                  .filter((booking) => !reviewedBookingIds.has(String(booking._id)))
                  .map((booking) => String(booking._id))
              );
              setReviewStatusLoaded(true);
            })
            .catch((err) => {
              if (!cancelled) {
                setReviewError(`Could not check review eligibility: ${errMsg(err)}`);
                setReviewStatusLoaded(true);
              }
            });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Could not load this stay.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user?._id, user?.role]);

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
      const result = await api.post("/bookings", { propertyId: id, checkIn, checkOut });
      navigate(`/receipt/${result.data.data.booking._id}`);
    } catch (err) {
      setError(errMsg(err));
      setPaying(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewError("");
    setPostingReview(true);
    try {
      const result = await api.post(`/properties/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      setReviews((items) => [result.data.data, ...items]);
      setReviewComment("");
      setReviewableBookingIds((ids) => ids.filter((bookingId) => bookingId !== String(result.data.data.booking)));
    } catch (err) {
      setReviewError(errMsg(err));
    } finally {
      setPostingReview(false);
    }
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
          {property.type === "hotel" && property.roomTypes?.length > 0 && (
            <section className="room-type-list">
              <h3>Room types</h3>
              <p className="muted">Rates and room counts are provided by the host. Reservations currently use the listing’s overall nightly rate.</p>
              {property.roomTypes.map((room) => (
                <article className="room-type-card" key={room._id || room.name}>
                  <div><strong>{room.name}</strong><p className="muted">Up to {room.maxGuests} guests · {room.quantity} available</p></div>
                  <strong>₹{room.pricePerNight} / night</strong>
                </article>
              ))}
            </section>
          )}
        </div>

        <div className="booking-box">
          <p><strong>₹{property.price}</strong> / night</p>
          <label htmlFor="check-in">Check-in</label>
          <input id="check-in" type="date" min={todayInputValue()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setCheckOut(""); }} />
          <label htmlFor="check-out">Check-out</label>
          <input id="check-out" type="date" min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10) : todayInputValue()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={!checkIn} />

          {user?.role === "user" && <p className="muted">Reserve now and pay ₹{nights > 0 ? nights * property.price : property.price} directly to the host at check-in. After booking, you can share the stay with verified guests for up to 24 hours from My bookings.</p>}
          {user?.role === "user" && ["pending", "rejected"].includes(user.verificationStatus) && <p className="error">Your profile must be approved before you can book. Update your profile in <Link to="/my-bookings">My bookings</Link>, then ask the superadmin to review it.</p>}
          {nights > 0 && <p>{nights} nights - total <strong>₹{nights * property.price}</strong></p>}
          {clashes && <p className="error">These dates are already booked.</p>}
          {error && <p className="error">{error}</p>}

          <button
            className="btn-primary"
            disabled={paying || !nights || nights < 1 || clashes || user?.role === "admin" || user?.role === "superadmin" || (user?.role === "user" && ["pending", "rejected"].includes(user.verificationStatus))}
            onClick={handleBook}
          >{paying ? "Reserving..." : "Reserve & pay at check-in"}</button>
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
        {user?.role === "user" && canReview && <form className="form-box wide" onSubmit={submitReview}><h3>Stayed here? Leave a review</h3><select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}</select><textarea placeholder="Share what future guests should know" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} maxLength={1200} /><button className="btn-primary" disabled={postingReview}>{postingReview ? "Posting..." : "Post review"}</button></form>}
        {user?.role === "user" && reviewStatusLoaded && !canReview && !reviewError && <p className="muted">You can review this stay after a confirmed booking has checked out.</p>}
        {reviewError && <p className="error">{reviewError}</p>}
        {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {reviews.map((r) => <article className="review-card" key={r._id}><strong>★ {r.rating}/5 · {r.user?.name || "Guest"}</strong><p>{r.comment}</p></article>)}
      </section>
    </div>
  );
}
