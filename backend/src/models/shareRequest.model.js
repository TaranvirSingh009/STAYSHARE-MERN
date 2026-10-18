import mongoose from "mongoose";

const shareRequestSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    splitAmount: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "accepted", "expired", "cancelled"],
      default: "open",
    },
  },
  { timestamps: true }
);

shareRequestSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);

export const ShareRequest = mongoose.model("ShareRequest", shareRequestSchema);
