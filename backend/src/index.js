import "dotenv/config";
import connectDB from "./db/index.js";
import app from "./app.js";
import { Booking } from "./models/booking.model.js";
import { expireShares } from "./controllers/share.controller.js";

const requiredEnv = ["MONGODB_URI", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Missing required environment values: ${missingEnv.join(", ")}`);
  process.exit(1);
}

connectDB()
  .then(() => {
    setInterval(() => expireShares().catch(console.error), 60 * 1000);
    setInterval(() => Booking.updateMany(
      { status: "pending_payment", paymentExpiresAt: { $lte: new Date() } },
      { status: "cancelled" }
    ).catch(console.error), 60 * 1000);
    app.listen(process.env.PORT || 5000, () =>
      console.log(`StayShare API running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error("DB connection failed", err);
    process.exit(1);
  });
