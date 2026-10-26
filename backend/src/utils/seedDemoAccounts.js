import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Property } from "../models/property.model.js";
import { Booking } from "../models/booking.model.js";
import { isStrongPassword, passwordRequirementsMessage } from "./validation.js";

const demoPassword = "StayShareDemo123!";
const demoUsers = [
  { name: "StayShare Demo Guest", email: "guest@stayshare.demo", role: "user", phone: "+91 90000 00001", gender: "male" },
  { name: "StayShare Demo Host", email: "host@stayshare.demo", role: "admin", phone: "+91 90000 00002", gender: "male" },
  { name: "StayShare Demo Superadmin", email: "superadmin@stayshare.demo", role: "superadmin", phone: "+91 90000 00003", gender: "prefer_not_to_say" },
];
const testUsers = [
  { name: "Demo Guest — Deletion Request", email: "delete-request@stayshare.demo", role: "user", phone: "9000000011", gender: "female", verificationStatus: "verified", deletionRequestStatus: "pending" },
  { name: "Demo Host — Deletion Request", email: "delete-host@stayshare.demo", role: "admin", phone: "9000000012", gender: "male", verificationStatus: "verified", deletionRequestStatus: "pending" },
  { name: "Demo Guest — Pending Review", email: "pending-guest@stayshare.demo", role: "user", phone: "9000000013", gender: "non_binary", verificationStatus: "pending", deletionRequestStatus: "none" },
  { name: "Demo Host — Pending Review", email: "pending-host@stayshare.demo", role: "admin", phone: "9000000014", gender: "female", verificationStatus: "pending", deletionRequestStatus: "none" },
];

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo accounts cannot be seeded when NODE_ENV=production.");
}
if (process.env.ENABLE_DEMO_ACCOUNTS !== "true") {
  throw new Error("Set ENABLE_DEMO_ACCOUNTS=true to explicitly create the public demo logins.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from backend/.env");
if (!isStrongPassword(demoPassword)) throw new Error(passwordRequirementsMessage);

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

  for (const demo of testUsers) {
    const existing = await User.findOne({ email: demo.email });
    if (existing && existing.role !== demo.role) {
      throw new Error(`${demo.email} already belongs to a ${existing.role} account; no test account was changed.`);
    }
    const user = existing || new User({ name: demo.name, email: demo.email, role: demo.role });
    user.name = demo.name;
    user.password = demoPassword;
    user.role = demo.role;
    user.phone = demo.phone;
    user.gender = demo.gender;
    user.verificationStatus = demo.verificationStatus;
    user.deletionRequestStatus = demo.deletionRequestStatus;
    user.deletionRequestedAt = demo.deletionRequestStatus === "pending" ? new Date() : null;
    user.deletionRequestNote = "";
    await user.save();
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
    { $set: { owner: accounts.admin._id, isPublished: true } }
  );
  const hotelRoomTypes = [
    { name: "Standard Double", pricePerNight: 4500, maxGuests: 2, quantity: 8 },
    { name: "Courtyard Suite", pricePerNight: 6800, maxGuests: 3, quantity: 3 },
  ];
  let sampleHotel = await Property.findOne({ sampleKey: "stayshare-demo-jaipur-hotel" });
  if (!sampleHotel) {
    sampleHotel = await Property.create({
      sampleKey: "stayshare-demo-jaipur-hotel",
      title: "Haveli Courtyard Stay",
      description: "A welcoming heritage-style stay with a quiet courtyard and easy access to the old city.",
      price: 4500,
      location: "Jaipur, Rajasthan",
      type: "hotel",
      maxGuests: 2,
      roomTypes: hotelRoomTypes,
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85"],
      owner: accounts.admin._id,
      isPublished: true,
    });
  } else {
    sampleHotel.roomTypes = hotelRoomTypes;
    sampleHotel.isPublished = true;
    await sampleHotel.save();
  }

  const testListings = [
    {
      sampleKey: "stayshare-demo-pending-hotel",
      title: "Demo Hotel Awaiting Approval",
      description: "A hotel listing seeded for testing the superadmin approval queue.",
      price: 4200,
      location: "Jaipur, Rajasthan",
      type: "hotel",
      maxGuests: 2,
      roomTypes: hotelRoomTypes,
      approvalStatus: "pending",
      approvalNote: "",
      isActive: true,
      isPublished: false,
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85"],
      owner: accounts.admin._id,
    },
    {
      sampleKey: "stayshare-demo-rejected-hostel",
      title: "Demo Hostel — Rejected Listing",
      description: "A listing seeded for checking rejected status and host feedback controls.",
      price: 1600,
      location: "Manali, Himachal Pradesh",
      type: "hostel",
      maxGuests: 4,
      approvalStatus: "rejected",
      approvalNote: "Please provide clearer property photos.",
      isActive: true,
      isPublished: false,
      images: ["https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85"],
      owner: accounts.admin._id,
    },
    {
      sampleKey: "stayshare-demo-hidden-apartment",
      title: "Demo Apartment — Hidden",
      description: "An approved listing seeded for checking restore and publish controls.",
      price: 2800,
      location: "Bengaluru, Karnataka",
      type: "apartment",
      maxGuests: 3,
      approvalStatus: "approved",
      approvalNote: "",
      isActive: false,
      isPublished: false,
      images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85"],
      owner: accounts.admin._id,
    },
  ];
  for (const listing of testListings) {
    await Property.findOneAndUpdate(
      { sampleKey: listing.sampleKey },
      { $set: listing },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 4);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);
  await Booking.findOneAndUpdate(
    { demoKey: "stayshare-demo-upcoming-booking" },
    {
      $set: {
        demoKey: "stayshare-demo-upcoming-booking",
        property: sampleHotel._id,
        user: accounts.user._id,
        partner: null,
        guestAttendance: [{ guest: accounts.user._id, status: "expected" }],
        checkIn,
        checkOut,
        nights: 2,
        totalPrice: 9000,
        userPays: 9000,
        partnerPays: 0,
        status: "confirmed",
        paymentMethod: "cash_on_checkin",
        paymentStatus: "paid",
        paymentReceivedAt: new Date(),
        paymentExpiresAt: null,
        paymentReceivedBy: accounts.admin._id,
        shareStatus: "none",
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log("Demo accounts, pending deletion and verification requests, hotel room types, approval fixtures, and a sample host booking are ready.");
} finally {
  await mongoose.disconnect();
}
