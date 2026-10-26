import { Router } from "express";
import { register, login, logout, refreshAccessToken, getMe, updateProfile, requestAccountDeletion, cancelAccountDeletionRequest } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", verifyJWT, logout);
router.get("/me", verifyJWT, getMe);
router.patch("/profile", verifyJWT, updateProfile);
router.post("/deletion-request", verifyJWT, requestAccountDeletion);
router.delete("/deletion-request", verifyJWT, cancelAccountDeletionRequest);

export default router;
