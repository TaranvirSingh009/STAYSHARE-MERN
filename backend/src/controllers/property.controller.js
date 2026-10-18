import { Property } from "../models/property.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Review } from "../models/review.model.js";
import { Booking } from "../models/booking.model.js";

export const getProperties = asyncHandler(async (req, res) => {
  const { location, type } = req.query;
  const filter = { isActive: { $ne: false }, $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] };
  if (location) filter.location = new RegExp(String(location).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (["hotel", "hostel", "flat", "apartment"].includes(type)) filter.type = type;
  const properties = await Property.find(filter).populate("owner", "name").sort({ createdAt: -1 });
  const stats = await Review.aggregate([{ $match: { property: { $in: properties.map((p) => p._id) } } }, { $group: { _id: "$property", average: { $avg: "$rating" }, count: { $sum: 1 } } }]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  const enriched = properties.map((property) => {
    const stats = byId.get(String(property._id));
    return { ...property.toObject(), ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0, reviewCount: stats?.count || 0 };
  });
  res.json(new ApiResponse(200, enriched));
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await Property.findOne({ _id: req.params.id, isActive: { $ne: false }, $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] }).populate("owner", "name");
  if (!property) throw new ApiError(404, "Property not found");
  res.json(new ApiResponse(200, property));
});

export const getMyProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, properties));
});

export const createProperty = asyncHandler(async (req, res) => {
  const { title, description, price, location, type, maxGuests, contactPhone, contactEmail } = req.body;
  const parsedPrice = Number(price);
  const parsedMaxGuests = maxGuests === undefined || maxGuests === "" ? 2 : Number(maxGuests);
  if (!title?.trim() || !description?.trim() || !location?.trim() || !type || !Number.isFinite(parsedPrice) || parsedPrice < 1) {
    throw new ApiError(400, "Fill all required fields");
  }
  if (!Number.isInteger(parsedMaxGuests) || parsedMaxGuests < 1) {
    throw new ApiError(400, "Maximum guests must be a positive whole number");
  }
  if (!["hotel", "hostel", "flat", "apartment"].includes(type)) throw new ApiError(400, "Invalid property type");
  if (!req.files?.length) throw new ApiError(400, "Upload at least one image");

  const images = [];
  try {
    for (const file of req.files) images.push(await uploadOnCloudinary(file.path));
  } catch (error) {
    throw new ApiError(502, "Could not save one or more images");
  }

  if (req.user.verificationStatus === "rejected" || req.user.verificationStatus === "pending") throw new ApiError(403, "Your profile must be verified before publishing listings");
  const property = await Property.create({
    title: title.trim(), description: description.trim(), price: parsedPrice,
    location: location.trim(), contactPhone: String(contactPhone || "").trim(), contactEmail: String(contactEmail || "").trim().toLowerCase(), type, maxGuests: parsedMaxGuests, images, owner: req.user._id, approvalStatus: "pending",
  });
  res.status(201).json(new ApiResponse(201, property, "Listing submitted for admin approval"));
});

export const getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ property: req.params.id }).populate("user", "name").sort({ createdAt: -1 });
  const eligible = req.user ? await Booking.exists({ property: req.params.id, status: "confirmed", checkOut: { $lte: new Date() }, $or: [{ user: req.user._id }, { partner: req.user._id }] }) : false;
  res.json(new ApiResponse(200, { reviews, eligible: Boolean(eligible) }));
});

export const createReview = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5");
  const booking = await Booking.findOne({ property: req.params.id, status: "confirmed", checkOut: { $lte: new Date() }, $or: [{ user: req.user._id }, { partner: req.user._id }] });
  if (!booking) throw new ApiError(403, "A completed stay is required to leave a review");
  if (await Review.exists({ booking: booking._id, user: req.user._id })) throw new ApiError(409, "You already reviewed this stay");
  const review = await Review.create({ property: req.params.id, booking: booking._id, user: req.user._id, rating, comment: String(req.body.comment || "").trim() });
  await review.populate("user", "name");
  res.status(201).json(new ApiResponse(201, review, "Review added"));
});

export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, "Property not found");

  const isOwner = property.owner.equals(req.user._id);
  if (!isOwner && req.user.role !== "superadmin") throw new ApiError(403, "Not your property");

  property.isActive = false;
  await property.save();
  res.json(new ApiResponse(200, null, "Property hidden"));
});

export const restoreProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw new ApiError(404, "Property not found");

  const isOwner = property.owner.equals(req.user._id);
  if (!isOwner && req.user.role !== "superadmin") throw new ApiError(403, "Not your property");

  property.isActive = true;
  await property.save();
  res.json(new ApiResponse(200, null, "Property restored"));
});
