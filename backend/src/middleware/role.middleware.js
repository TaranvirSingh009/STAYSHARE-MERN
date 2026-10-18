import { ApiError } from "../utils/ApiError.js";

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new ApiError(403, "You are not allowed to do this");
  }
  next();
};
