import { Router } from "express";
import {
  createBooking, verifyBookingPayment, getMyBookings, getOwnerBookings, cancelBooking, getBookedDates,
} from "../controllers/booking.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.get("/property/:propertyId/dates", getBookedDates);
router.use(verifyJWT);
router.post("/", authorizeRoles("user"), createBooking);
router.post("/:id/verify-payment", authorizeRoles("user"), verifyBookingPayment);
router.get("/mine", getMyBookings);
router.get("/owner", authorizeRoles("admin"), getOwnerBookings);
router.patch("/:id/cancel", authorizeRoles("user"), cancelBooking);

export default router;
