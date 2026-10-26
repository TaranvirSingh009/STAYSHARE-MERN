import { Booking } from "../models/booking.model.js";
import { ShareRequest } from "../models/shareRequest.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfToday } from "../utils/dates.js";
import { ShareApplication } from "../models/shareApplication.model.js";
import { User } from "../models/user.model.js";

export const expireShares = async () => {
  const expired = await ShareRequest.find({ status: "open", expiresAt: { $lte: new Date() } });
  if (!expired.length) return;
  const expiredIds = expired.map((share) => share._id);
  await Promise.all([
    ShareRequest.updateMany({ _id: { $in: expiredIds } }, { status: "expired" }),
    Booking.updateMany(
      { _id: { $in: expired.map((share) => share.booking) }, shareStatus: "open" },
      { shareStatus: "none" }
    ),
    ShareApplication.updateMany(
      { share: { $in: expiredIds }, status: "pending" },
      { status: "rejected" }
    ),
  ]);
};

export const createShare = asyncHandler(async (req, res) => {
  if (req.user.verificationStatus === "pending" || req.user.verificationStatus === "rejected" || !["male", "female", "non_binary"].includes(req.user.gender)) throw new ApiError(403, "Verify your gender profile before sharing a room");
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking || !booking.user.equals(req.user._id)) throw new ApiError(404, "Booking not found");
  if (booking.status !== "confirmed") throw new ApiError(400, "Booking is not active");
  if (booking.shareStatus !== "none") throw new ApiError(400, "Already shared or requested");
  if (booking.checkIn <= startOfToday()) throw new ApiError(400, "Too late to find a partner");

  const configuredHours = Number(process.env.SHARE_WINDOW_HOURS) || 24;
  const hours = Math.min(24, Math.max(1, configuredHours));
  const byWindow = new Date(Date.now() + hours * 3600 * 1000);
  const expiresAt = booking.checkIn < byWindow ? booking.checkIn : byWindow;

  const share = await ShareRequest.create({
    booking: booking._id,
    requester: req.user._id,
    splitAmount: booking.totalPrice / 2,
    expiresAt,
  });
  booking.shareStatus = "open";
  await booking.save();
  res.status(201).json(new ApiResponse(201, share, "Partner request is live"));
});

export const getOpenShares = asyncHandler(async (req, res) => {
  await expireShares();
  const me = await User.findById(req.user._id);
  if (me.verificationStatus === "pending" || me.verificationStatus === "rejected") throw new ApiError(403, "Verify your profile before applying to share");
  const shares = await ShareRequest.find({
    status: "open",
    requester: { $ne: req.user._id },
  })
    .populate({ path: "booking", populate: { path: "property", select: "title location images" } })
    .populate("requester", "name")
    .sort({ expiresAt: 1 });
  const applications = await ShareApplication.find({ applicant: req.user._id });
  const applied = new Map(applications.map((a) => [String(a.share), a.status]));
  const eligible = [];
  for (const share of shares) {
    const owner = await User.findById(share.requester._id).select("gender verificationStatus");
    share.set("applicationStatus", applied.get(String(share._id)) || "");
    share.set("sameGender", Boolean(owner && owner.gender === me.gender && ["male", "female", "non_binary"].includes(me.gender)));
    eligible.push(share);
  }
  res.json(new ApiResponse(200, eligible));
});

export const applyToShare = asyncHandler(async (req, res) => {
  const now = new Date();
  const candidate = await ShareRequest.findOne(
    {
      _id: req.params.id,
      status: "open",
      expiresAt: { $gt: now },
      requester: { $ne: req.user._id },
    }
  );
  if (!candidate) throw new ApiError(400, "This request is no longer available");
  const [applicant, owner, booking] = await Promise.all([
    User.findById(req.user._id),
    User.findById(candidate.requester),
    Booking.findById(candidate.booking).populate("property", "owner"),
  ]);
  if (!booking || booking.status !== "confirmed" || booking.shareStatus !== "open" || booking.checkIn <= now || !booking.property) {
    throw new ApiError(400, "This stay is no longer available to share");
  }
  if (!applicant || applicant.verificationStatus === "pending" || applicant.verificationStatus === "rejected") throw new ApiError(403, "Your profile must be verified before applying");
  if (!owner || !["male", "female", "non_binary"].includes(applicant.gender) || applicant.gender !== owner.gender) throw new ApiError(403, "Room sharing is available only between guests with the same verified gender");
  if (booking.property.owner.equals(applicant._id)) throw new ApiError(400, "You cannot apply to your own listing");
  const application = await ShareApplication.findOneAndUpdate(
    { share: candidate._id, applicant: applicant._id },
    { $setOnInsert: { status: "pending", message: String(req.body.message || "").trim() } },
    { upsert: true, new: true, runValidators: true }
  );
  if (application.status !== "pending") throw new ApiError(400, "This application has already been decided");
  res.status(201).json(new ApiResponse(201, application, "Application sent to the room owner"));
});

export const getMyApplications = asyncHandler(async (req, res) => {
  await expireShares();
  const shares = await ShareRequest.find({ requester: req.user._id, status: "open", expiresAt: { $gt: new Date() } }).select("_id booking status expiresAt");
  const applications = await ShareApplication.find({ share: { $in: shares.map((s) => s._id) }, status: "pending" })
    .populate("applicant", "name email gender phone")
    .populate({ path: "share", populate: { path: "booking", populate: { path: "property", select: "title location" } } })
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, applications));
});

export const decideApplication = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!["accepted", "rejected"].includes(decision)) throw new ApiError(400, "Invalid decision");
  const application = await ShareApplication.findById(req.params.applicationId).populate("share");
  if (!application || !application.share || !application.share.requester.equals(req.user._id)) throw new ApiError(404, "Application not found");
  if (application.status !== "pending") throw new ApiError(400, "Application already decided");
  if (decision === "rejected") {
    application.status = "rejected";
    await application.save();
    return res.json(new ApiResponse(200, application, "Application rejected"));
  }
  const share = await ShareRequest.findOne({ _id: application.share._id, status: "open", expiresAt: { $gt: new Date() } });
  if (!share) throw new ApiError(400, "This share request is no longer available");
  const booking = await Booking.findOneAndUpdate(
    { _id: share.booking, user: req.user._id, status: "confirmed", shareStatus: "open", partner: null },
    {
      partner: application.applicant,
      shareStatus: "shared",
      userPays: share.splitAmount,
      partnerPays: share.splitAmount,
      $push: { guestAttendance: { guest: application.applicant, status: "expected" } },
    },
    { new: true }
  );
  if (!booking) throw new ApiError(400, "This stay is no longer available");
  application.status = "accepted";
  await application.save();
  await ShareRequest.updateOne({ _id: share._id }, { status: "accepted", partner: application.applicant });
  await ShareApplication.updateMany({ share: share._id, _id: { $ne: application._id }, status: "pending" }, { status: "rejected" });
  res.json(new ApiResponse(200, booking, "Guest approved and added to your stay"));
});

export const cancelShare = asyncHandler(async (req, res) => {
  const share = await ShareRequest.findOneAndUpdate(
    { booking: req.params.bookingId, requester: req.user._id, status: "open" },
    { status: "cancelled" }
  );
  if (!share) throw new ApiError(404, "No open request found");
  await Promise.all([
    Booking.findByIdAndUpdate(req.params.bookingId, { shareStatus: "none" }),
    ShareApplication.updateMany({ share: share._id, status: "pending" }, { status: "rejected" }),
  ]);
  res.json(new ApiResponse(200, null, "Request cancelled"));
});
