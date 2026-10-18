import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errMsg } from "../api/axios";
import { formatDate } from "../utils/dates";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);

export default function Receipt() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  useEffect(() => {
    api.get(`/bookings/${id}/receipt`).then((res) => setData(res.data.data)).catch((err) => setError(errMsg(err)));
  }, [id]);
  const sendEmail = async () => {
    setEmailMessage("");
    try {
      const result = await api.post(`/bookings/${id}/receipt/email`);
      setData((current) => ({ ...current, receiptEmailSent: result.data.data.sent }));
      setEmailMessage(result.data.message);
    } catch (err) { setEmailMessage(errMsg(err)); }
  };
  if (error) return <section className="info-page"><h1>Receipt unavailable</h1><p>{error}</p><Link className="btn-primary" to="/my-bookings">Go to my bookings</Link></section>;
  if (!data) return <p className="center">Loading your receipt…</p>;
  const { booking, contacts } = data;
  const property = booking.property;
  return <article className="receipt-card">
    <div className="receipt-heading"><div><span className="auth-eyebrow">StayShare · Payment receipt</span><h1>You're all set.</h1><p>Your stay is confirmed. Save or print this receipt for check-in.</p></div><span className="badge green">Payment confirmed</span></div>
    <div className="receipt-ref"><span>Booking reference</span><strong>{booking._id}</strong></div>
    <h2>{property.title}</h2><p className="muted">{property.location}</p>
    <div className="receipt-grid"><div><span>Guest</span><strong>{booking.user?.name}</strong><small>{booking.user?.email}</small></div>{booking.partner && <div><span>Room-share partner</span><strong>{booking.partner.name}</strong></div>}<div><span>Check-in</span><strong>{formatDate(booking.checkIn)}</strong></div><div><span>Check-out</span><strong>{formatDate(booking.checkOut)}</strong></div><div><span>Duration</span><strong>{booking.nights} night{booking.nights === 1 ? "" : "s"}</strong></div><div><span>Payment reference</span><strong>{booking.razorpayPaymentId || "Confirmed"}</strong></div><div><span>Total paid</span><strong>{money(booking.totalPrice)}</strong></div></div>
    <section className="receipt-contact"><h3>Stay contact and help</h3><p>For arrival time, directions, or help at the property, contact your host:</p>{contacts.stayPhone ? <p>☎ <a href={`tel:${contacts.stayPhone}`}>{contacts.stayPhone}</a></p> : <p className="muted">The host has not added a helpline number yet.</p>}{contacts.stayEmail && <p>✉ <a href={`mailto:${contacts.stayEmail}`}>{contacts.stayEmail}</a></p>}{(contacts.supportEmail || contacts.supportPhone) && <p className="muted">StayShare support: {contacts.supportEmail && <a href={`mailto:${contacts.supportEmail}`}>{contacts.supportEmail}</a>} {contacts.supportPhone && <a href={`tel:${contacts.supportPhone}`}>{contacts.supportPhone}</a>}</p>}</section>
    <p className="notice">{emailMessage || (data.receiptEmailSent ? `A copy was sent to ${booking.user?.email}.` : data.receiptEmailConfigured ? "Your payment is confirmed. Email delivery could not be confirmed; this receipt is available here and in My bookings." : "Your payment is confirmed. Email receipts are not configured yet; keep this page or print a copy.")}</p>
    <div className="receipt-actions"><button className="btn-primary" onClick={() => window.print()}>Print / save receipt</button>{!data.receiptEmailSent && data.receiptEmailConfigured && <button className="btn-outline" onClick={sendEmail}>Email me this receipt</button>}<Link className="btn-outline" to="/my-bookings">My bookings</Link><Link className="btn-outline" to="/help-support">Help and support</Link></div>
  </article>;
}
