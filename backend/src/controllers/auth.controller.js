import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isStrongPassword, isValidPhoneNumber, passwordRequirementsMessage } from "../utils/validation.js";

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

const issueTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const setCookies = (res, { accessToken, refreshToken }) => {
  res
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone || "",
  gender: user.gender || "prefer_not_to_say",
  verificationStatus: user.verificationStatus || "verified",
  deletionRequestStatus: user.deletionRequestStatus || "none",
  deletionRequestedAt: user.deletionRequestedAt || null,
  deletionRequestNote: user.deletionRequestNote || "",
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, gender, acceptedAgreement } = req.body;
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedName || !normalizedEmail || !password || !normalizedPhone || !gender) throw new ApiError(400, "Name, email, password, phone, and gender are required");
  if (!isStrongPassword(password)) throw new ApiError(400, passwordRequirementsMessage);
  if (!isValidPhoneNumber(normalizedPhone)) throw new ApiError(400, "Phone number must contain exactly 10 digits");
  if (acceptedAgreement !== true) throw new ApiError(400, "Please accept the User Agreement before creating an account");
  if (!["male", "female", "non_binary", "prefer_not_to_say"].includes(gender)) throw new ApiError(400, "Select a valid gender option");
  if (await User.findOne({ email: normalizedEmail })) throw new ApiError(409, "Email already registered");

  const safeRole = role === "admin" ? "admin" : "user";
  const user = await User.create({ name: normalizedName, email: normalizedEmail, password, phone: normalizedPhone, gender, role: safeRole, verificationStatus: "pending", acceptedAgreementAt: new Date(), agreementVersion: "2026-10-18" });
  res.status(201).json(new ApiResponse(201, safeUser(user), "Registered. Your profile is waiting for verification."));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) throw new ApiError(400, "Email and password required");

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const tokens = await issueTokens(user);
  setCookies(res, tokens);
  res.json(new ApiResponse(200, safeUser(user), "Logged in"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incoming) throw new ApiError(401, "Refresh token missing");

  let decoded;
  try {
    decoded = jwt.verify(incoming, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Refresh token expired");
  }

  const user = await User.findById(decoded._id);
  if (!user || user.refreshToken !== incoming) throw new ApiError(401, "Refresh token invalid");

  const tokens = await issueTokens(user);
  setCookies(res, tokens);
  res.json(new ApiResponse(200, safeUser(user), "Token refreshed"));
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .clearCookie("connect.sid")
    .json(new ApiResponse(200, null, "Logged out"));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, safeUser(req.user)));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { phone, gender } = req.body;
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedPhone || !gender || !["male", "female", "non_binary", "prefer_not_to_say"].includes(gender)) throw new ApiError(400, "Phone and a valid gender option are required");
  if (!isValidPhoneNumber(normalizedPhone)) throw new ApiError(400, "Phone number must contain exactly 10 digits");
  if (normalizedPhone === (req.user.phone || "") && gender === (req.user.gender || "prefer_not_to_say")) {
    return res.json(new ApiResponse(200, safeUser(req.user), "Your profile details are unchanged"));
  }
  req.user.phone = normalizedPhone;
  req.user.gender = gender;
  req.user.verificationStatus = "pending";
  req.user.verificationNote = "";
  await req.user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, safeUser(req.user), "Profile updated. It is waiting for admin verification."));
});

export const requestAccountDeletion = asyncHandler(async (req, res) => {
  if (req.user.role === "superadmin") throw new ApiError(403, "Superadmin profiles cannot be deleted through an account request");
  if (req.user.deletionRequestStatus === "pending") throw new ApiError(409, "You already have a pending deletion request");

  req.user.deletionRequestStatus = "pending";
  req.user.deletionRequestedAt = new Date();
  req.user.deletionRequestNote = "";
  await req.user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, safeUser(req.user), "Your profile deletion request was sent to the superadmin"));
});

export const cancelAccountDeletionRequest = asyncHandler(async (req, res) => {
  if (req.user.deletionRequestStatus !== "pending") throw new ApiError(409, "There is no pending deletion request to cancel");

  req.user.deletionRequestStatus = "none";
  req.user.deletionRequestedAt = null;
  req.user.deletionRequestNote = "";
  await req.user.save({ validateBeforeSave: false });
  res.json(new ApiResponse(200, safeUser(req.user), "Your profile deletion request was cancelled"));
});
