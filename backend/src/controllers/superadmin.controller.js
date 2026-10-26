import { User } from "../models/user.model.js";
import { Property } from "../models/property.model.js";
import { Booking } from "../models/booking.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getStats = asyncHandler(async (req, res) => {
  const [users, admins, properties, bookings] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "admin" }),
    Property.countDocuments({ isActive: { $ne: false } }),
    Booking.countDocuments({ status: "confirmed" }),
  ]);
  res.json(new ApiResponse(200, { users, admins, properties, bookings }));
});

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken").sort({ createdAt: -1 });
  res.json(new ApiResponse(200, users));
});

export const updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!["admin", "user"].includes(role)) throw new ApiError(400, "Invalid role");
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "superadmin") throw new ApiError(403, "Cannot change a superadmin");
  user.role = role;
  await user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, null, "Role updated"));
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "superadmin") throw new ApiError(403, "Cannot delete a superadmin");
  await user.deleteOne();
  res.json(new ApiResponse(200, null, "User deleted"));
});

export const getDeletionRequests = asyncHandler(async (_req, res) => {
  const requests = await User.find({ deletionRequestStatus: "pending", role: { $ne: "superadmin" } })
    .select("-password -refreshToken")
    .sort({ deletionRequestedAt: 1 });
  res.json(new ApiResponse(200, requests));
});

export const reviewDeletionRequest = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) throw new ApiError(400, "Invalid deletion request decision");

  const user = await User.findById(req.params.id);
  if (!user || user.role === "superadmin") throw new ApiError(404, "Deletion request not found");
  if (user.deletionRequestStatus !== "pending") throw new ApiError(409, "This deletion request is no longer pending");

  if (status === "approved") {
    await user.deleteOne();
    return res.json(new ApiResponse(200, null, "Profile deletion request approved; the user was deleted"));
  }

  user.deletionRequestStatus = "rejected";
  user.deletionRequestNote = String(req.body.note || "").trim();
  await user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, null, "Profile deletion request rejected"));
});

export const verifyUser = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["verified", "rejected"].includes(status)) throw new ApiError(400, "Invalid verification decision");
  const user = await User.findById(req.params.id);
  if (!user || user.role === "superadmin") throw new ApiError(404, "User not found");
  user.verificationStatus = status;
  user.verificationNote = String(req.body.note || "").trim();
  await user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, null, `Profile ${status}`));
});

export const reviewListing = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) throw new ApiError(400, "Invalid listing decision");
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, "Listing not found");
  property.approvalStatus = status;
  property.approvalNote = String(req.body.note || "").trim();
  property.isPublished = false;
  await property.save();
  res.json(new ApiResponse(200, property, `Listing ${status}`));
});
