import { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PropertyDetails from "./pages/PropertyDetails";
import MyBookings from "./pages/MyBookings";
import SharedRooms from "./pages/SharedRooms";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdmin from "./pages/SuperAdmin";
import Receipt from "./pages/Receipt";
import HelpSupport from "./pages/HelpSupport";
import About from "./pages/About";
import UserAgreement from "./pages/UserAgreement";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";
import Footer from "./components/Footer";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");

  useEffect(() => {
    const message = location.state?.toast;
    if (!message) return;
    setToast(message);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1900);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/help-support" element={<HelpSupport />} />
          <Route path="/about" element={<About />} />
          <Route path="/user-agreement" element={<UserAgreement />} />
          <Route path="/account" element={<ProtectedRoute roles={["user", "admin"]}><AccountSettings /></ProtectedRoute>} />
          <Route path="/property/:id" element={<PropertyDetails />} />
          <Route path="/receipt/:id" element={<ProtectedRoute roles={["user"]}><Receipt /></ProtectedRoute>} />
          <Route
            path="/my-bookings"
            element={<ProtectedRoute roles={["user"]}><MyBookings /></ProtectedRoute>}
          />
          <Route
            path="/shared-rooms"
            element={<ProtectedRoute roles={["user"]}><SharedRooms /></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>}
          />
          <Route
            path="/superadmin"
            element={<ProtectedRoute roles={["superadmin"]}><SuperAdmin /></ProtectedRoute>}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      {toast && <div className="welcome-toast" role="status"><span>✳</span>{toast}</div>}
    </>
  );
}
