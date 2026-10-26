import { Booking } from "../models/booking.model.js";
import { Property } from "../models/property.model.js";
import { ShareRequest } from "../models/shareRequest.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfToday, toDate } from "../utils/dates.js";
import { sendReceiptEmail } from "../utils/receiptEmail.js";

export const createBooking = asyncHandler(async (req, res) => {
  if (req.user.verificationStatus === "pending" || req.user.verificationStatus === "rejected") throw new ApiError(403, "Your profile must be verified before booking");

  const { propertyId, checkIn, checkOut } = req.body;
  if (!propertyId || !checkIn || !checkOut) throw new ApiError(400, "Select your dates");

  const inDate = toDate(checkIn);
  const outDate = toDate(checkOut);
  if (isNaN(inDate) || isNaN(outDate)) throw new ApiError(400, "Invalid dates");
  if (inDate < startOfToday()) throw new ApiError(400, "Past dates cannot be booked");
  if (outDate <= inDate) throw new ApiError(400, "Check-out must be after check-in");

  const property = await Property.findById(propertyId);
  if (!property || property.isActive === false || property.isPublished === false || (property.approvalStatus && property.approvalStatus !== "approved")) throw new ApiError(404, "Property not found");
  if (property.owner.equals(req.user._id)) throw new ApiError(400, "You cannot book your own listing");

  await Booking.updateMany(
    { status: "pending_payment", paymentExpiresAt: { $lte: new Date() } },
    { status: "cancelled" }
  );
  const clash = await Booking.findOne({
    property: propertyId,
    $or: [
      { status: "confirmed" },
      { status: "pending_payment", paymentExpiresAt: { $gt: new Date() } },
    ],
    checkIn: { $lt: outDate },
    checkOut: { $gt: inDate },
  });
  if (clash) throw new ApiError(409, "These dates are already booked");

  const nights = Math.floor((outDate - inDate) / 86400000);
  const totalPrice = nights * property.price;

  const booking = await Booking.create({
    property: propertyId,
    user: req.user._id,
    guestAttendance: [{ guest: req.user._id, status: "expected" }],
    checkIn: inDate,
    checkOut: outDate,
    nights,
    totalPrice,
    userPays: totalPrice,
    paymentExpiresAt: null,
    paymentMethod: "cash_on_checkin",
    paymentStatus: "pending",
    status: "confirmed",
  });
  res.status(201).json(new ApiResponse(201, { booking }, "Stay reserved. Pay the host at check-in."));
});

export const recordCashPayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, status: "confirmed" });
  if (!booking) throw new ApiError(404, "Confirmed booking not found");
  if (!await Property.exists({ _id: booking.property, owner: req.user._id })) {
    throw new ApiError(403, "Only the host for this stay can record payment");
  }
  if (booking.paymentMethod !== "cash_on_checkin") throw new ApiError(400, "This booking is not set to pay at check-in");
  if (booking.paymentStatus === "paid") throw new ApiError(409, "Payment has already been recorded");
  if (new Date() < booking.checkIn || new Date() >= booking.checkOut) {
    throw new ApiError(400, "Cash payment can only be recorded during the booked stay");
  }

  booking.paymentStatus = "paid";
  booking.paymentReceivedAt = new Date();
  booking.paymentReceivedBy = req.user._id;
  await booking.save();
  res.json(new ApiResponse(200, booking, "Cash payment recorded"));
});

export const getBookingReceipt = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, status: "confirmed", $or: [{ user: req.user._id }, { partner: req.user._id }] })
    .populate({ path: "property", populate: { path: "owner", select: "name email phone" } })
    .populate("user", "name email")
    .populate("partner", "name email");
  if (!booking) throw new ApiError(404, "Confirmed booking receipt not found");
  const property = booking.property;
  res.json(new ApiResponse(200, {
    booking,
    contacts: {
      stayPhone: property.contactPhone || property.owner?.phone || "",
      stayEmail: property.contactEmail || property.owner?.email || "",
      supportPhone: process.env.SUPPORT_PHONE || "",
      supportEmail: process.env.SUPPORT_EMAIL || "",
    },
    receiptEmailSent: Boolean(booking.receiptEmailSentAt),
    receiptEmailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
  }));
});

export const emailBookingReceipt = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, status: "confirmed", $or: [{ user: req.user._id }, { partner: req.user._id }] })
    .populate({ path: "property", populate: { path: "owner", select: "name email phone" } })
    .populate("user", "name email")
    .populate("partner", "name");
  if (!booking) throw new ApiError(404, "Confirmed booking receipt not found");
  if (booking.paymentStatus !== "paid") throw new ApiError(409, "Payment must be received before emailing a payment receipt");
  if (booking.receiptEmailSentAt) return res.json(new ApiResponse(200, { sent: true }, "Receipt email was already sent"));
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) throw new ApiError(503, "Receipt email is not configured yet");
  try {
    const sent = await sendReceiptEmail(booking);
    if (sent) {
      booking.receiptEmailSentAt = new Date();
      await booking.save();
    }
    res.json(new ApiResponse(200, { sent }, sent ? "Receipt emailed to your booking email" : "Receipt email was not sent"));
  } catch (error) {
    throw new ApiError(502, `Could not send the receipt email: ${error.message}`);
  }
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    $or: [{ user: req.user._id }, { partner: req.user._id }],
  })
    .populate("property", "title location images price type")
    .populate("user", "name")
    .populate("partner", "name")
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, bookings));
});

export const getOwnerBookings = asyncHandler(async (req, res) => {
  const mine = await Property.find({ owner: req.user._id }).select("_id");
  const bookings = await Booking.find({
    property: { $in: mine.map((p) => p._id) },
    status: "confirmed",
  })
    .populate("property", "title")
    .populate("user", "name email")
    .sort({ checkIn: 1 });
  res.json(new ApiResponse(200, bookings));
});

export const getOwnerOverview = asyncHandler(async (req, res) => {
  const mine = await Property.find({ owner: req.user._id }).select("_id");
  const propertyIds = mine.map((property) => property._id);
  const bookings = await Booking.find({ property: { $in: propertyIds }, status: "confirmed" })
    .populate("property", "title location")
    .populate("user", "name email phone gender")
    .populate("partner", "name email phone gender")
    .populate("guestAttendance.guest", "name email phone gender")
    .populate("guestAttendance.verifiedBy", "name")
    .sort({ checkIn: 1 });
  const now = new Date();
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  let totalGuests = 0;
  let checkedInGuests = 0;
  let checkedOutGuests = 0;
  let arrivalsToday = 0;
  let departuresToday = 0;
  for (const booking of bookings) {
    const occupants = [booking.user, booking.partner].filter(Boolean);
    totalGuests += occupants.length;
    if (booking.checkIn >= today && booking.checkIn < tomorrow) arrivalsToday += occupants.length;
    if (booking.checkOut >= today && booking.checkOut < tomorrow) departuresToday += occupants.length;
    for (const guest of occupants) {
      const attendance = booking.guestAttendance.find((entry) => entry.guest?._id?.equals(guest._id) || entry.guest?.equals?.(guest._id));
      if (attendance?.status === "checked_in") checkedInGuests += 1;
      if (attendance?.status === "checked_out") checkedOutGuests += 1;
    }
  }
  const activeBookings = bookings.filter((booking) => booking.checkIn <= now && booking.checkOut > now).length;
  const upcomingBookings = bookings.filter((booking) => booking.checkIn > now).length;
  const totalCollected = bookings.reduce((sum, booking) => sum + (booking.paymentStatus === "paid" ? booking.totalPrice : 0), 0);
  const confirmedValue = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
  res.json(new ApiResponse(200, {
    stats: { totalCollected, confirmedValue, confirmedBookings: bookings.length, totalGuests, arrivalsToday, departuresToday, checkedInGuests, checkedOutGuests, activeBookings, upcomingBookings },
    bookings,
  }));
});

export const updateGuestAttendance = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["checked_in", "checked_out"].includes(status)) throw new ApiError(400, "Choose check-in or check-out");
  const booking = await Booking.findOne({ _id: req.params.bookingId, status: "confirmed" });
  if (!booking) throw new ApiError(404, "Confirmed booking not found");
  const property = await Property.exists({ _id: booking.property, owner: req.user._id });
  if (!property) throw new ApiError(403, "Only the host for this stay can update guest arrival");
  const guestId = req.params.guestId;
  if (![String(booking.user), booking.partner ? String(booking.partner) : ""].includes(guestId)) throw new ApiError(404, "Guest is not part of this booking");
  if (status === "checked_in" && booking.paymentMethod === "cash_on_checkin" && booking.paymentStatus !== "paid") {
    throw new ApiError(409, "Record the cash payment before checking the guest in");
  }
  if (status === "checked_in" && (new Date() < booking.checkIn || new Date() >= booking.checkOut)) {
    throw new ApiError(400, "Guests can only be verified and checked in during their booked stay");
  }
  let attendance = booking.guestAttendance.find((entry) => String(entry.guest) === guestId);
  if (!attendance) {
    booking.guestAttendance.push({ guest: guestId, status: "expected" });
    attendance = booking.guestAttendance[booking.guestAttendance.length - 1];
  }
  if (status === "checked_in" && attendance.status !== "expected") throw new ApiError(400, "This guest is not waiting to check in");
  if (status === "checked_out" && attendance.status !== "checked_in") throw new ApiError(400, "Check the guest in before marking check-out");
  attendance.status = status;
  attendance.verifiedBy = req.user._id;
  attendance.checkedInAt = status === "checked_in" ? new Date() : attendance.checkedInAt;
  attendance.checkedOutAt = status === "checked_out" ? new Date() : attendance.checkedOutAt;
  await booking.save();
  res.json(new ApiResponse(200, { bookingId: booking._id, guestId, status, updatedAt: status === "checked_in" ? attendance.checkedInAt : attendance.checkedOutAt }, status === "checked_in" ? "Guest verified and checked in" : "Guest checked out"));
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || !booking.user.equals(req.user._id)) throw new ApiError(404, "Booking not found");
  if (booking.status === "cancelled") throw new ApiError(400, "Already cancelled");
  if (booking.checkIn < startOfToday()) throw new ApiError(400, "Past bookings cannot be cancelled");
  if (booking.shareStatus === "shared") throw new ApiError(400, "Shared bookings cannot be cancelled");

  await ShareRequest.updateMany(
    { booking: booking._id, status: "open" },
    { status: "cancelled" }
  );
  booking.status = "cancelled";
  booking.shareStatus = "none";
  await booking.save();
  res.json(new ApiResponse(200, booking, "Booking cancelled"));
});

export const getBookedDates = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    property: req.params.propertyId,
    $or: [
      { status: "confirmed" },
      { status: "pending_payment", paymentExpiresAt: { $gt: new Date() } },
    ],
    checkOut: { $gt: startOfToday() },
  })
    .select("checkIn checkOut")
    .sort({ checkIn: 1 });
  res.json(new ApiResponse(200, bookings));
});
