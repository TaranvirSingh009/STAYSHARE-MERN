import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestAttendance: [{
      guest: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      status: { type: String, enum: ["expected", "checked_in", "checked_out"], default: "expected" },
      checkedInAt: { type: Date, default: null },
      checkedOutAt: { type: Date, default: null },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    }],
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    userPays: { type: Number, required: true },
    partnerPays: { type: Number, default: 0 },
    status: { type: String, enum: ["pending_payment", "confirmed", "cancelled"], default: "pending_payment" },
    paymentExpiresAt: { type: Date, default: null },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    receiptEmailSentAt: { type: Date, default: null },
    shareStatus: { type: String, enum: ["none", "open", "shared"], default: "none" },
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);
