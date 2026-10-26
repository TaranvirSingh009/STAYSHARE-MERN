import { Link } from "react-router-dom";

const email = import.meta.env.VITE_SUPPORT_EMAIL || "";
const phone = import.meta.env.VITE_SUPPORT_PHONE || "";

export default function HelpSupport() {
  return <div className="info-page"><span className="auth-eyebrow">We’re here to help</span><h1>Help & support</h1><p className="muted">Need a hand with a booking, sign-in, payment, or listing? Start with the right option below.</p>
    <section className="support-contact"><h2>Contact StayShare support</h2><p>For account access, payment issues, cancellations, or anything that doesn’t look right, contact our support team.</p>{email ? <p>✉ <a href={`mailto:${email}?subject=StayShare%20support%20request`}>{email}</a></p> : <p className="notice">Support email is being set up. The site owner should add <code>VITE_SUPPORT_EMAIL</code> in the frontend environment and <code>SUPPORT_EMAIL</code> in the backend environment.</p>}{phone ? <p>☎ <a href={`tel:${phone}`}>{phone}</a></p> : <p className="muted">A support phone number will appear here when configured.</p>}</section>
    <div className="support-grid"><section><h2>Booking and payment</h2><p>Your reservation is confirmed when you book. Pay the host directly at check-in; the host records your payment and your receipt becomes available afterward.</p><Link to="/my-bookings">View my bookings</Link></section><section><h2>Can’t log in?</h2><p>Check the email address and password you registered with. Demo accounts are listed on the login page. For password recovery, contact support and include the account email you registered with.</p><Link to="/login">Go to login</Link></section><section><h2>Host or listing help</h2><p>New host profiles and listings need admin review. Check your verification or listing status from the host dashboard.</p><Link to="/login">Open host login</Link></section><section><h2>Safety and shared rooms</h2><p>Room sharing requests go to the booking owner for approval. If a guest or booking concern needs attention, contact StayShare support.</p><Link to="/shared-rooms">Browse shared rooms</Link></section></div>
    <p className="muted">Please don’t send passwords or payment card details by email.</p>
  </div>;
}
