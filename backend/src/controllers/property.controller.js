import { Property } from "../models/property.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Review } from "../models/review.model.js";
import { Booking } from "../models/booking.model.js";
import { isValidPhoneNumber } from "../utils/validation.js";

export const getProperties = asyncHandler(async (req, res) => {
  const { location, type } = req.query;
  const filter = {
    isActive: { $ne: false },
    $and: [
      { $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] },
      { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] },
    ],
  };
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
  const property = await Property.findOne({
    _id: req.params.id,
    isActive: { $ne: false },
    $and: [
      { $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }] },
      { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] },
    ],
  }).populate("owner", "name");
  if (!property) throw new ApiError(404, "Property not found");
  res.json(new ApiResponse(200, property.toObject()));
});

export const getMyProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, properties));
});

export const createProperty = asyncHandler(async (req, res) => {
  const { title, description, price, location, type, maxGuests, contactPhone, contactEmail } = req.body;
  const parsedPrice = Number(price);
  const parsedMaxGuests = maxGuests === undefined || maxGuests === "" ? 2 : Number(maxGuests);
  const normalizedContactPhone = String(contactPhone || "").trim();
  if (!title?.trim() || !description?.trim() || !location?.trim() || !type || !Number.isFinite(parsedPrice) || parsedPrice < 1) {
    throw new ApiError(400, "Fill all required fields");
  }
  if (!Number.isInteger(parsedMaxGuests) || parsedMaxGuests < 1) {
    throw new ApiError(400, "Maximum guests must be a positive whole number");
  }
  if (!["hotel", "hostel", "flat", "apartment"].includes(type)) throw new ApiError(400, "Invalid property type");
  if (normalizedContactPhone && !isValidPhoneNumber(normalizedContactPhone)) throw new ApiError(400, "Stay contact phone must contain exactly 10 digits");
  const roomTypes = parseRoomTypes(req.body.roomTypes, type === "hotel");
  if (!req.files?.length) throw new ApiError(400, "Upload at least one image");

  if (req.user.verificationStatus === "rejected" || req.user.verificationStatus === "pending") throw new ApiError(403, "Your profile must be verified before publishing listings");
  const images = [];
  try {
    for (const file of req.files) images.push(await uploadOnCloudinary(file.path));
  } catch (error) {
    throw new ApiError(502, "Could not save one or more images");
  }

  const property = await Property.create({
    title: title.trim(), description: description.trim(), price: parsedPrice,
    location: location.trim(), contactPhone: normalizedContactPhone, contactEmail: String(contactEmail || "").trim().toLowerCase(), type, maxGuests: parsedMaxGuests, roomTypes, images, owner: req.user._id, approvalStatus: "pending", isPublished: false,
  });
  res.status(201).json(new ApiResponse(201, property, "Listing submitted for admin approval"));
});

const parseRoomTypes = (input, required) => {
  let roomTypes = input;
  if (typeof roomTypes === "string") {
    try {
      roomTypes = JSON.parse(roomTypes);
    } catch {
      throw new ApiError(400, "Room types must be valid JSON data");
    }
  }
  if (roomTypes === undefined || roomTypes === null) roomTypes = [];
  if (!Array.isArray(roomTypes) || roomTypes.length > 30 || (required && roomTypes.length === 0)) {
    throw new ApiError(400, required ? "Add at least one room type to your hotel" : "Invalid room types");
  }

  return roomTypes.map((room, index) => {
    const name = String(room?.name || "").trim();
    const pricePerNight = Number(room?.pricePerNight);
    const maxGuests = Number(room?.maxGuests);
    const quantity = Number(room?.quantity);
    if (!name || name.length > 80) throw new ApiError(400, `Room type ${index + 1} needs a name of up to 80 characters`);
    if (!Number.isFinite(pricePerNight) || pricePerNight < 1) throw new ApiError(400, `Room type ${index + 1} needs a valid price of at least ₹1`);
    if (!Number.isInteger(maxGuests) || maxGuests < 1) throw new ApiError(400, `Room type ${index + 1} guest capacity must be a positive whole number`);
    if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, `Room type ${index + 1} quantity must be a positive whole number`);
    return { name, pricePerNight, maxGuests, quantity };
  });
};

const getOwnedProperty = async (propertyId, user) => {
  const property = await Property.findById(propertyId);
  if (!property) throw new ApiError(404, "Property not found");
  if (!property.owner.equals(user._id) && user.role !== "superadmin") throw new ApiError(403, "Not your property");
  return property;
};

export const updateRoomTypes = asyncHandler(async (req, res) => {
  const property = await getOwnedProperty(req.params.id, req.user);
  if (property.type !== "hotel") throw new ApiError(400, "Room types can only be managed for hotel listings");
  property.roomTypes = parseRoomTypes(req.body.roomTypes, true);
  await property.save();
  res.json(new ApiResponse(200, property, "Hotel room types updated"));
});

export const setPropertyPublished = asyncHandler(async (req, res) => {
  if (typeof req.body.published !== "boolean") throw new ApiError(400, "Published status must be true or false");
  const property = await getOwnedProperty(req.params.id, req.user);
  if (req.body.published && property.approvalStatus !== "approved") throw new ApiError(409, "The listing must be approved before it can go live");
  if (req.body.published && property.isActive === false) throw new ApiError(409, "Restore the listing before publishing it");
  property.isPublished = req.body.published;
  await property.save();
  res.json(new ApiResponse(200, property, req.body.published ? "Listing is now live" : "Listing taken offline"));
});

export const getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ property: req.params.id }).populate("user", "name").sort({ createdAt: -1 });
  const eligible = req.user
    ? await Booking.exists({
      property: req.params.id,
      status: "confirmed",
      checkOut: { $lte: new Date() },
      $or: [{ user: req.user._id }, { partner: req.user._id }],
    })
    : false;
  res.json(new ApiResponse(200, { reviews, eligible: Boolean(eligible) }));
});

export const createReview = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5");
  const completedBookings = await Booking.find({
    property: req.params.id,
    status: "confirmed",
    checkOut: { $lte: new Date() },
    $or: [{ user: req.user._id }, { partner: req.user._id }],
  }).select("_id").sort({ checkOut: -1 });
  if (!completedBookings.length) throw new ApiError(403, "A completed stay is required to leave a review");

  const reviewedBookings = await Review.find({
    booking: { $in: completedBookings.map(({ _id }) => _id) },
    user: req.user._id,
  }).distinct("booking");
  const reviewedBookingIds = new Set(reviewedBookings.map(String));
  const booking = completedBookings.find(({ _id }) => !reviewedBookingIds.has(String(_id)));
  if (!booking) throw new ApiError(409, "You already reviewed all completed stays at this property");

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
