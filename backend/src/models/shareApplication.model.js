import mongoose from "mongoose";

const schema = new mongoose.Schema({
  share: { type: mongoose.Schema.Types.ObjectId, ref: "ShareRequest", required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  message: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });
schema.index({ share: 1, applicant: 1 }, { unique: true });
export const ShareApplication = mongoose.model("ShareApplication", schema);
