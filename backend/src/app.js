import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import propertyRoutes from "./routes/property.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import shareRoutes from "./routes/share.routes.js";
import superadminRoutes from "./routes/superadmin.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

app.use(cors({
  origin: process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()) || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(publicDir, "uploads"), { maxAge: isProd ? "7d" : 0 }));

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/shares", shareRoutes);
app.use("/api/v1/superadmin", superadminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use(errorHandler);

export default app;
