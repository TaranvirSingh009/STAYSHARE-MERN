import mongoose from "mongoose";

const schema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1200, default: "" },
}, { timestamps: true });
schema.index({ booking: 1, user: 1 }, { unique: true });
export const Review = mongoose.model("Review", schema);
