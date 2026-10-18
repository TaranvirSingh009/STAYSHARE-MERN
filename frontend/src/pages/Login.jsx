import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/axios";

const demoAccounts = [
  { label: "Guest", description: "Find stays and book a trip", email: "guest@stayshare.demo" },
  { label: "Host", description: "List and manage a place", email: "host@stayshare.demo" },
  { label: "Superadmin", description: "Explore the admin dashboard", email: "superadmin@stayshare.demo" },
];
const demoPassword = "StayShareDemo123!";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const chooseDemo = (email) => {
    setForm({ email, password: demoPassword });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoggingIn(true);
    try {
      const user = await login(form.email, form.password);
      const destination = user.role === "admin" ? "/admin" : user.role === "superadmin" ? "/superadmin" : "/";
      navigate(destination, { state: { toast: `Welcome back, ${user.name}!` } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="auth-layout login-layout">
      <aside className="auth-aside login-aside">
        <span className="auth-eyebrow">StayShare</span>
        <h1>Come on in.<br />Your next stay awaits.</h1>
        <p>Find a little place to call yours, or open the door to guests from everywhere.</p>
        <div className="auth-stay-note"><span className="stay-note-icon">✳</span><span><strong>Stay a little closer.</strong><small>Good places. Shared moments.</small></span></div>
      </aside>

      <div className="login-column">
        <form className="form-box auth-card" onSubmit={handleSubmit}>
          <span className="auth-eyebrow">Welcome to StayShare</span>
          <h2>Log in</h2>
          <p className="muted auth-intro">Pick up where your next trip begins.</p>
          <label className="auth-label" htmlFor="login-email">Email address</label>
          <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          <label className="auth-label" htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={handleChange} required />
          {error && <p className="error auth-error" role="alert">{error}</p>}
          <button className="btn-primary auth-submit" disabled={loggingIn}>{loggingIn ? "Logging you in…" : "Log in"}</button>
          <p className="muted auth-footer">New to StayShare? <Link to="/register">Create an account</Link></p>
        </form>

        <section className="demo-login" aria-label="Demo accounts">
          <div className="demo-login-heading"><span className="auth-eyebrow">Just looking around?</span><span className="demo-password">Password: <code>{demoPassword}</code></span></div>
          <div className="demo-account-list">
            {demoAccounts.map((account) => (
              <button type="button" className={`demo-account ${form.email === account.email ? "active" : ""}`} key={account.email} onClick={() => chooseDemo(account.email)}>
                <span><strong>{account.label}</strong><small>{account.description}</small></span><b aria-hidden="true">↗</b>
              </button>
            ))}
          </div>
          <p className="demo-hint">Choose an account to fill the form. Demo accounts are created by the local seed command.</p>
        </section>
      </div>
    </div>
  );
}
