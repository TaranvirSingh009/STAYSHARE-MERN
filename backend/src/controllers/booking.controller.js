import crypto from "node:crypto";
import { Booking } from "../models/booking.model.js";
import { Property } from "../models/property.model.js";
import { ShareRequest } from "../models/shareRequest.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfToday, toDate } from "../utils/dates.js";

const razorpayRequest = async (path, method, body) => {
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || "Razorpay request failed");
  return data;
};

export const createBooking = asyncHandler(async (req, res) => {
  if (req.user.verificationStatus === "pending" || req.user.verificationStatus === "rejected") throw new ApiError(403, "Your profile must be verified before booking");
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new ApiError(503, "Online payments are not configured yet. Add Razorpay test keys to the backend environment.");

  const { propertyId, checkIn, checkOut } = req.body;
  if (!propertyId || !checkIn || !checkOut) throw new ApiError(400, "Select your dates");

  const inDate = toDate(checkIn);
  const outDate = toDate(checkOut);
  if (isNaN(inDate) || isNaN(outDate)) throw new ApiError(400, "Invalid dates");
  if (inDate < startOfToday()) throw new ApiError(400, "Past dates cannot be booked");
  if (outDate <= inDate) throw new ApiError(400, "Check-out must be after check-in");

  const property = await Property.findById(propertyId);
  if (!property || property.isActive === false || (property.approvalStatus && property.approvalStatus !== "approved")) throw new ApiError(404, "Property not found");
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

  const paymentExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const booking = await Booking.create({
    property: propertyId,
    user: req.user._id,
    checkIn: inDate,
    checkOut: outDate,
    nights,
    totalPrice,
    userPays: totalPrice,
    paymentExpiresAt,
    status: "pending_payment",
  });
  try {
    const order = await razorpayRequest("orders", "POST", {
      amount: Math.round(totalPrice * 100),
      currency: process.env.RAZORPAY_CURRENCY || "INR",
      receipt: `stay_${booking._id}`,
      notes: { bookingId: String(booking._id), propertyId: String(property._id) },
    });
    booking.razorpayOrderId = order.id;
    await booking.save();
    res.status(201).json(new ApiResponse(201, {
      booking,
      payment: { keyId, orderId: order.id, amount: order.amount, currency: order.currency },
    }, "Payment order created"));
  } catch (error) {
    await Booking.findByIdAndUpdate(booking._id, { status: "cancelled" });
    throw new ApiError(502, "Could not start payment. Please try again.");
  }
});

export const verifyBookingPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) throw new ApiError(400, "Payment verification details are incomplete");
  const booking = await Booking.findOne({
    _id: req.params.id,
    user: req.user._id,
    status: "pending_payment",
    razorpayOrderId: orderId,
    paymentExpiresAt: { $gt: new Date() },
  });
  if (!booking) throw new ApiError(404, "Payment session expired or booking not found. Please start again.");

  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${booking.razorpayOrderId}|${paymentId}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (expectedBytes.length !== receivedBytes.length || !crypto.timingSafeEqual(expectedBytes, receivedBytes)) {
    throw new ApiError(400, "Payment signature could not be verified");
  }

  try {
    let payment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`, "GET");
    if (payment.status === "authorized" && payment.order_id === booking.razorpayOrderId) {
      payment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}/capture`, "POST", {
        amount: Math.round(booking.totalPrice * 100),
        currency: process.env.RAZORPAY_CURRENCY || "INR",
      });
    }
    if (payment.order_id !== booking.razorpayOrderId || payment.amount !== Math.round(booking.totalPrice * 100) || payment.currency !== (process.env.RAZORPAY_CURRENCY || "INR") || payment.status !== "captured") {
      throw new ApiError(400, "Payment is not captured for this booking");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Could not confirm payment status. Please refresh your bookings shortly.");
  }

  booking.status = "confirmed";
  booking.paymentExpiresAt = null;
  booking.razorpayPaymentId = paymentId;
  await booking.save();
  res.json(new ApiResponse(200, booking, "Payment verified and booking confirmed"));
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    $or: [{ user: req.user._id }, { partner: req.user._id }],
  })
    .populate("property", "title location images price")
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
