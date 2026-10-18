import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("stayshare-theme") === "dark");
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("stayshare-theme", dark ? "dark" : "light"); }, [dark]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // The local session is cleared even when the API cannot be reached.
    } finally {
      navigate("/");
    }
  };

  return (
    <header className="navbar">
      <Link to="/" className="logo">stayshare</Link>
      <nav>
        <button className="btn-outline theme-toggle" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode">{dark ? "☀️ Light" : "🌙 Dark"}</button>
        {user?.role === "user" && (
          <>
            <Link to="/shared-rooms">Shared rooms</Link>
            <Link to="/my-bookings">My bookings</Link>
          </>
        )}
        {user?.role === "admin" && <Link to="/admin">Host dashboard</Link>}
        {user?.role === "superadmin" && <Link to="/superadmin">Control panel</Link>}
        <Link to="/help-support">Help</Link>
        {user ? (
          <button className="btn-outline" onClick={handleLogout}>Log out ({user.name})</button>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn-primary">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
