import { Router } from "express";
import {
  getProperties, getProperty, getMyProperties, createProperty, deleteProperty, restoreProperty, getReviews, createReview,
} from "../controllers/property.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

router.get("/", getProperties);
router.get("/:id/reviews", getReviews);
router.post("/:id/reviews", verifyJWT, authorizeRoles("user"), createReview);
router.get("/mine", verifyJWT, authorizeRoles("admin", "superadmin"), getMyProperties);
router.get("/:id", getProperty);
router.post("/", verifyJWT, authorizeRoles("admin"), upload.array("images", 5), createProperty);
router.delete("/:id", verifyJWT, authorizeRoles("admin", "superadmin"), deleteProperty);
router.patch("/:id/restore", verifyJWT, authorizeRoles("admin", "superadmin"), restoreProperty);

export default router;
