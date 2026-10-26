const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dateLabel = (value) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(value));

export const sendReceiptEmail = async (booking) => {
  const { RESEND_API_KEY, MAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !MAIL_FROM) return false;
  const property = booking.property;
  const supportEmail = process.env.SUPPORT_EMAIL || "";
  const supportPhone = process.env.SUPPORT_PHONE || "";
  const stayPhone = property.contactPhone || property.owner?.phone || "";
  const stayEmail = property.contactEmail || property.owner?.email || "";
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(booking.totalPrice);
  const fields = [
    ["Stay", property.title], ["Address", property.location], ["Check-in", dateLabel(booking.checkIn)],
    ["Check-out", dateLabel(booking.checkOut)], ["Nights", booking.nights], ["Guests", booking.partner ? 2 : 1],
    ...(booking.partner?.name ? [["Room-share partner", booking.partner.name]] : []),
    ["Amount paid", amount], ["Booking reference", booking._id],
    ["Stay helpline", stayPhone], ["Stay email", stayEmail], ["Stay host", property.owner?.name || ""],
    ["StayShare support", supportPhone], ["StayShare support email", supportEmail],
  ].filter(([, value]) => value !== "");
  const rows = fields.map(([label, value]) => `<tr><th align="left" style="padding:10px;border-bottom:1px solid #eee;color:#666">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #eee">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#24211f"><h1 style="color:#ff385c">StayShare</h1><h2>Booking receipt</h2><p>Hi ${escapeHtml(booking.user?.name || "there")}, the host has recorded your payment. Keep this receipt handy for check-in.</p><table style="width:100%;border-collapse:collapse">${rows}</table><p>Need help with your booking? Reply to this email${supportEmail ? ` or email <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>` : ""}${supportPhone ? `, or call ${escapeHtml(supportPhone)}` : ""}.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `booking-receipt-${booking._id}`,
    },
    body: JSON.stringify({ from: MAIL_FROM, to: [booking.user.email], subject: `StayShare booking confirmed · ${property.title}`, html }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.name || `Email provider returned ${response.status}`);
  return true;
};
