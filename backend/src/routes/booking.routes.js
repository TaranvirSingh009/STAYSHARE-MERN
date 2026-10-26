import { Router } from "express";
import {
  createBooking, getBookingReceipt, emailBookingReceipt, getMyBookings, getOwnerBookings, getOwnerOverview, updateGuestAttendance, recordCashPayment, cancelBooking, getBookedDates,
} from "../controllers/booking.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.get("/property/:propertyId/dates", getBookedDates);
router.use(verifyJWT);
router.post("/", authorizeRoles("user"), createBooking);
router.get("/:id/receipt", authorizeRoles("user"), getBookingReceipt);
router.post("/:id/receipt/email", authorizeRoles("user"), emailBookingReceipt);
router.get("/mine", getMyBookings);
router.get("/owner", authorizeRoles("admin"), getOwnerBookings);
router.get("/owner/overview", authorizeRoles("admin"), getOwnerOverview);
router.patch("/owner/:bookingId/payment", authorizeRoles("admin"), recordCashPayment);
router.patch("/owner/:bookingId/guest/:guestId/attendance", authorizeRoles("admin"), updateGuestAttendance);
router.patch("/:id/cancel", authorizeRoles("user"), cancelBooking);

export default router;
