import { useEffect, useState } from "react";
import api, { errMsg } from "../api/axios";
import { imageUrl } from "../api/imageUrl";

export default function SuperAdmin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [statsRes, usersRes, propertiesRes] = await Promise.all([
        api.get("/superadmin/stats"),
        api.get("/superadmin/users"),
        api.get("/superadmin/listings"),
      ]);
      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
      setProperties(propertiesRes.data.data);
      setDeletionRequests(usersRes.data.data.filter((user) => user.deletionRequestStatus === "pending"));
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/superadmin/users/${id}/role`, { role });
      await load();
      setMessage("User role updated");
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const removeUser = async (id) => {
    try {
      await api.delete(`/superadmin/users/${id}`);
      await load();
      setMessage("User deleted");
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const reviewDeletionRequest = async (id, status) => {
    if (status === "approved" && !window.confirm("Permanently delete this profile? This cannot be undone.")) return;
    try {
      const result = await api.patch(`/superadmin/users/${id}/deletion-request`, { status });
      await load();
      setMessage(result.data.message);
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const hideProperty = async (id) => {
    if (!window.confirm("Remove this listing from guest search? Existing bookings are kept, and you can restore the listing later.")) return;
    try {
      await api.delete(`/properties/${id}`);
      await load();
      setMessage("Listing removed from guest search");
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const restoreProperty = async (id) => {
    try {
      await api.patch(`/properties/${id}/restore`);
      await load();
      setMessage("Listing restored");
    } catch (err) {
      setMessage(errMsg(err));
    }
  };

  const decide = async (path, status) => {
    try { await api.patch(path, { status }); await load(); setMessage(`Request ${status}`); }
    catch (err) { setMessage(errMsg(err)); }
  };

  return (
    <div>
      <h2>Control panel</h2>
      {message && <p className="notice">{message}</p>}

      {stats && (
        <div className="stats">
          <div><strong>{stats.users}</strong><span>Guests</span></div>
          <div><strong>{stats.admins}</strong><span>Hosts</span></div>
          <div><strong>{stats.properties}</strong><span>Listings</span></div>
          <div><strong>{stats.bookings}</strong><span>Active bookings</span></div>
        </div>
      )}

      <h3>Profile deletion requests</h3>
      {deletionRequests.length === 0 ? <p className="muted">No pending profile deletion requests.</p> : deletionRequests.map((request) => (
        <div className="row-card" key={request._id}>
          <div className="grow">
            <strong>{request.name}</strong>
            <p className="muted">{request.email} · {request.role === "admin" ? "Host" : "Guest"}</p>
            <small>Requested {request.deletionRequestedAt ? new Date(request.deletionRequestedAt).toLocaleString() : "recently"}</small>
          </div>
          <button className="btn-primary" onClick={() => reviewDeletionRequest(request._id, "approved")}>Approve and delete</button>
          <button className="btn-outline" onClick={() => reviewDeletionRequest(request._id, "rejected")}>Reject</button>
        </div>
      ))}

      <h3>Users</h3>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Phone / gender</th><th>Verification</th><th>Role</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.phone || "—"} / {user.gender || "not set"}</td>
              <td>{user.verificationStatus || "verified"} {user.verificationStatus !== "verified" && user.role !== "superadmin" && <><button className="btn-outline" onClick={() => decide(`/superadmin/users/${user._id}/verification`, "verified")}>Verify</button> <button className="btn-outline" onClick={() => decide(`/superadmin/users/${user._id}/verification`, "rejected")}>Reject</button></>}</td>
              <td>
                {user.role === "superadmin" ? "superadmin" : (
                  <select value={user.role} onChange={(e) => changeRole(user._id, e.target.value)}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                )}
              </td>
              <td>
                {user.role !== "superadmin" && (
                  <button className="btn-outline" onClick={() => removeUser(user._id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Listings</h3>
      {properties.length === 0 && <p>No active listings.</p>}
      {properties.map((property) => (
        <div className="row-card" key={property._id}>
          <img src={imageUrl(property.images?.[0])} alt={property.title} />
          <div className="grow">
            <h4>{property.title}</h4>
            <p className="muted">{property.location} - {property.owner?.name || "Unknown host"} · {property.approvalStatus || "approved"}</p>
          </div>
          {property.approvalStatus !== "approved" && <><button className="btn-primary" onClick={() => decide(`/superadmin/listings/${property._id}/review`, "approved")}>Approve</button><button className="btn-outline" onClick={() => decide(`/superadmin/listings/${property._id}/review`, "rejected")}>Reject</button></>}
          {property.isActive === false
            ? <button className="btn-outline" onClick={() => restoreProperty(property._id)}>Restore listing</button>
            : <button className="btn-outline" onClick={() => hideProperty(property._id)}>Delete listing</button>}
        </div>
      ))}
    </div>
  );
}
