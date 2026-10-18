import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    location: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" },
    type: { type: String, enum: ["hotel", "hostel", "flat", "apartment"], required: true },
    maxGuests: { type: Number, default: 2 },
    images: [{ type: String }],
    isActive: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    approvalNote: { type: String, default: "" },
    sampleKey: { type: String, unique: true, sparse: true, select: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Property = mongoose.model("Property", propertySchema);
