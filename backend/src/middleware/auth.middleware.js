import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) throw new ApiError(401, "Login required");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  const user = await User.findById(decoded._id).select("-password -refreshToken");
  if (!user) throw new ApiError(401, "User not found");
  req.user = user;
  next();
});
