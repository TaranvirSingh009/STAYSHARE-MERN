import { Router } from "express";
import { createShare, getOpenShares, applyToShare, cancelShare, getMyApplications, decideApplication } from "../controllers/share.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(verifyJWT, authorizeRoles("user"));
router.get("/", getOpenShares);
router.get("/applications/mine", getMyApplications);
router.patch("/applications/:applicationId", decideApplication);
router.post("/:bookingId", createShare);
router.delete("/:bookingId", cancelShare);
router.post("/:id/apply", applyToShare);

export default router;
