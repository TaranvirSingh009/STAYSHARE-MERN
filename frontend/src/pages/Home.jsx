import { useEffect, useState } from "react";
import api from "../api/axios";
import PropertyCard from "../components/PropertyCard";

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProperties = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/properties", { params: { location, type } });
      setProperties(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load stays. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [type]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProperties();
  };

  return (
    <>
      <section className="hero">
        <h1>Book a room. Split the bill.</h1>
        <p>Stay anywhere and share your room with a partner to pay half.</p>
        <form className="search" onSubmit={handleSearch}>
          <input
            placeholder="Where are you going?"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="hotel">Hotel</option>
            <option value="hostel">Hostel</option>
            <option value="flat">Flat</option>
            <option value="apartment">Apartment</option>
          </select>
          <button className="btn-primary">Search</button>
        </form>
      </section>

      {loading ? (
        <p className="center">Loading stays...</p>
      ) : error ? (
        <p className="center error">{error}</p>
      ) : properties.length === 0 ? (
        <p className="center">No stays found. Try another location.</p>
      ) : (
        <div className="grid">
          {properties.map((p) => <PropertyCard key={p._id} property={p} />)}
        </div>
      )}
    </>
  );
}
