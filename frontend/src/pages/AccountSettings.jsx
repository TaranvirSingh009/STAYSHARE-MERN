import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/axios";

export default function AccountSettings() {
  const { user, requestAccountDeletion, cancelAccountDeletionRequest } = useAuth();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const requestPending = user?.deletionRequestStatus === "pending";
  const requestRejected = user?.deletionRequestStatus === "rejected";

  const submitRequest = async () => {
    if (!window.confirm("Send a request to permanently delete your StayShare profile? The superadmin must review it.")) return;
    setSaving(true);
    setMessage("");
    try {
      await requestAccountDeletion();
      setMessage("Your profile deletion request was sent to the superadmin.");
    } catch (err) {
      setMessage(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async () => {
    setSaving(true);
    setMessage("");
    try {
      await cancelAccountDeletionRequest();
      setMessage("Your profile deletion request was cancelled.");
    } catch (err) {
      setMessage(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="form-box wide account-settings">
      <h2>Account settings</h2>
      <p><strong>{user?.name}</strong> · {user?.email}</p>
      <p className="muted">Account type: {user?.role === "admin" ? "Host" : "Guest"}</p>
      <h3>Delete profile</h3>
      <p className="muted">Request permanent deletion of your profile. A superadmin will review the request; submitting it does not delete your account immediately.</p>
      {message && <p className="notice" role="status">{message}</p>}
      {requestPending ? (
        <>
          <p className="notice">Request pending since {user.deletionRequestedAt ? new Date(user.deletionRequestedAt).toLocaleString() : "recently"}.</p>
          <button className="btn-outline" onClick={cancelRequest} disabled={saving}>{saving ? "Updating…" : "Cancel deletion request"}</button>
        </>
      ) : (
        <>
          {requestRejected && <p className="notice">Your previous deletion request was not approved. You may submit a new request.</p>}
          <button className="btn-outline" onClick={submitRequest} disabled={saving}>{saving ? "Sending…" : "Request profile deletion"}</button>
        </>
      )}
    </section>
  );
}
