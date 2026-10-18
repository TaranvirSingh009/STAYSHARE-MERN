import { Router } from "express";
import { getStats, getUsers, updateRole, deleteUser, verifyUser, reviewListing } from "../controllers/superadmin.controller.js";
import { Property } from "../models/property.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(verifyJWT, authorizeRoles("superadmin"));
router.get("/stats", getStats);
router.get("/users", getUsers);
router.get("/listings/pending", asyncHandler(async (_req, res) => {
  const listings = await Property.find({ approvalStatus: "pending" }).populate("owner", "name email").sort({ createdAt: -1 });
  res.json(new ApiResponse(200, listings));
}));
router.get("/listings", asyncHandler(async (_req, res) => {
  const listings = await Property.find().populate("owner", "name email").sort({ createdAt: -1 });
  res.json(new ApiResponse(200, listings));
}));
router.patch("/users/:id/verification", verifyUser);
router.patch("/listings/:id/review", reviewListing);
router.patch("/users/:id/role", updateRole);
router.delete("/users/:id", deleteUser);

export default router;
