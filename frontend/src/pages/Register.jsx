import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/axios";

const welcomeLines = ["A better stay starts here.", "Your next favourite place awaits.", "Make room for a little adventure."];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", gender: "", role: "user", acceptedAgreement: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setLineIndex((index) => (index + 1) % welcomeLines.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await register(form);
      navigate("/login", { state: { toast: "Account created. The admin will verify your profile shortly." } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-layout">
      <aside className="auth-aside register-aside">
        <span className="auth-eyebrow">A little more than a place to sleep</span>
        <h1>Good stays.<br />Good stories.</h1>
        <p className="auth-sliding-line" key={lineIndex}>{welcomeLines[lineIndex]}</p>
        <div className="auth-perks">
          <p><span>01</span> Find a stay that feels like yours</p>
          <p><span>02</span> Share the room, split the cost</p>
          <p><span>03</span> Host your own little corner</p>
        </div>
        <div className="auth-dots" aria-hidden="true"><i /><i /><i /></div>
      </aside>

      <form className="form-box auth-card" onSubmit={handleSubmit}>
        <span className="auth-eyebrow">Join StayShare</span>
        <h2>Create your account</h2>
        <p className="muted auth-intro">A few details and you’re on your way. We’ll review your profile before bookings and room sharing.</p>

        <div className="role-switch" role="group" aria-label="Choose how you want to use StayShare">
          <button type="button" className={form.role === "user" ? "selected" : ""} onClick={() => setForm({ ...form, role: "user" })}>
            <span>Find a stay</span><small>Book as a guest</small>
          </button>
          <button type="button" className={form.role === "admin" ? "selected" : ""} onClick={() => setForm({ ...form, role: "admin" })}>
            <span>List my place</span><small>Host on StayShare</small>
          </button>
        </div>

        <label className="auth-label" htmlFor="register-name">Your name</label>
        <input id="register-name" name="name" autoComplete="name" placeholder="e.g. Aanya Sharma" value={form.name} onChange={handleChange} required />
        <label className="auth-label" htmlFor="register-email">Email address</label>
        <input id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
        <label className="auth-label" htmlFor="register-phone">Phone number</label>
        <input id="register-phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} required />
        <label className="auth-label" htmlFor="register-gender">Gender (used to match room-share requests)</label>
        <select id="register-gender" name="gender" value={form.gender} onChange={handleChange} required>
          <option value="" disabled>Select an option</option><option value="male">Man</option><option value="female">Woman</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option>
        </select>
        <label className="auth-label" htmlFor="register-password">Password</label>
        <input id="register-password" name="password" type="password" autoComplete="new-password" minLength={6} placeholder="At least 6 characters" value={form.password} onChange={handleChange} required />
        <label className="agreement-consent"><input type="checkbox" name="acceptedAgreement" checked={form.acceptedAgreement} onChange={(e) => setForm({ ...form, acceptedAgreement: e.target.checked })} required /> <span>I agree to the <Link to="/user-agreement" target="_blank" rel="noreferrer">User Agreement</Link>.</span></label>
        {error && <p className="error auth-error" role="alert">{error}</p>}
        <button className="btn-primary auth-submit" disabled={saving}>{saving ? "Creating your account…" : "Create account"}</button>
        <p className="muted auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
