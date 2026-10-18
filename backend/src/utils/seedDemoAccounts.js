import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Property } from "../models/property.model.js";

const demoPassword = "StayShareDemo123!";
const demoUsers = [
  { name: "StayShare Demo Guest", email: "guest@stayshare.demo", role: "user", phone: "+91 90000 00001", gender: "male" },
  { name: "StayShare Demo Host", email: "host@stayshare.demo", role: "admin", phone: "+91 90000 00002", gender: "male" },
  { name: "StayShare Demo Superadmin", email: "superadmin@stayshare.demo", role: "superadmin", phone: "+91 90000 00003", gender: "prefer_not_to_say" },
];

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo accounts cannot be seeded when NODE_ENV=production.");
}
if (process.env.ENABLE_DEMO_ACCOUNTS !== "true") {
  throw new Error("Set ENABLE_DEMO_ACCOUNTS=true to explicitly create the public demo logins.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from backend/.env");
if (demoPassword.length < 6) throw new Error("DEMO_ACCOUNT_PASSWORD must be at least 6 characters.");

await mongoose.connect(process.env.MONGODB_URI);
try {
  const accounts = {};
  const existingAccounts = await Promise.all(demoUsers.map(({ email }) => User.findOne({ email })));
  const conflict = existingAccounts.find((account, index) => account && account.role !== demoUsers[index].role);
  if (conflict) {
    throw new Error(conflict.email + " already belongs to a " + conflict.role + " account; no account was changed.");
  }

  for (const [index, demo] of demoUsers.entries()) {
    const existing = existingAccounts[index];
    const user = existing || new User(demo);
    user.name = demo.name;
    user.password = demoPassword;
    user.role = demo.role;
    user.phone = demo.phone;
    user.gender = demo.gender;
    user.verificationStatus = "verified";
    await user.save();
    accounts[demo.role] = user;
  }

  const sampleKeys = [
    "stayshare-demo-goa-flat",
    "stayshare-demo-jaipur-hotel",
    "stayshare-demo-manali-hostel",
    "stayshare-demo-bengaluru-flat",
    "stayshare-demo-delhi-hotel",
    "stayshare-demo-delhi-flat",
    "stayshare-demo-chandigarh-hotel",
    "stayshare-demo-chandigarh-hostel",
  ];
  await Property.updateMany(
    { sampleKey: { $in: sampleKeys } },
    { owner: accounts.admin._id }
  );
  const sampleHotel = await Property.findOne({ sampleKey: "stayshare-demo-jaipur-hotel" });
  if (!sampleHotel) {
    await Property.create({
      sampleKey: "stayshare-demo-jaipur-hotel",
      title: "Haveli Courtyard Stay",
      description: "A welcoming heritage-style stay with a quiet courtyard and easy access to the old city.",
      price: 4500,
      location: "Jaipur, Rajasthan",
      type: "hotel",
      maxGuests: 2,
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85"],
      owner: accounts.admin._id,
    });
  }
  console.log("Demo guest, host and superadmin accounts are ready. Sample listings belong to the demo host.");
} finally {
  await mongoose.disconnect();
}
