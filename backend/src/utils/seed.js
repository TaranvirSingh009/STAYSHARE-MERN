import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { isStrongPassword, passwordRequirementsMessage } from "./validation.js";

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
if (!email || !password) throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in backend/.env first");
if (!isStrongPassword(password)) throw new Error(passwordRequirementsMessage);
await mongoose.connect(process.env.MONGODB_URI);
try {
  const exists = await User.findOne({ email });
  if (exists?.role === "superadmin") console.log("Superadmin already exists");
  else if (exists) throw new Error("SUPERADMIN_EMAIL is already used by a non-superadmin account");
  else {
    await User.create({
      name: process.env.SUPERADMIN_NAME || "Super Admin",
      email,
      password,
      role: "superadmin",
    });
    console.log("Superadmin created:", email);
  }
} finally {
  await mongoose.disconnect();
}
