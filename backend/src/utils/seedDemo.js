import "dotenv/config";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Property } from "../models/property.model.js";

const demoProperties = [
  {
    sampleKey: "stayshare-demo-goa-flat",
    title: "Palm Grove Apartment",
    description: "A bright, comfortable apartment close to the beach, cafes, and local markets.",
    price: 3200,
    location: "Candolim, Goa",
    type: "flat",
    maxGuests: 2,
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-jaipur-hotel",
    title: "Haveli Courtyard Stay",
    description: "A welcoming heritage-style stay with a quiet courtyard and easy access to the old city.",
    price: 4500,
    location: "Jaipur, Rajasthan",
    type: "hotel",
    maxGuests: 2,
    images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-manali-hostel",
    title: "Pine Ridge Hostel",
    description: "A relaxed mountain base with warm rooms, shared lounges, and views of the surrounding hills.",
    price: 1800,
    location: "Manali, Himachal Pradesh",
    type: "hostel",
    maxGuests: 2,
    images: ["https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-bengaluru-flat",
    title: "Garden City Guest Flat",
    description: "A peaceful, well-equipped flat near neighborhood restaurants, parks, and public transport.",
    price: 2600,
    location: "Indiranagar, Bengaluru",
    type: "flat",
    maxGuests: 3,
    images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-delhi-hotel",
    title: "The Lodhi Garden House",
    description: "A calm boutique stay with leafy balconies, thoughtful rooms, and cafés nearby.",
    price: 3800,
    location: "Lodhi Colony, New Delhi",
    type: "hotel",
    maxGuests: 2,
    images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-delhi-flat",
    title: "Little Hauz Khas Flat",
    description: "A bright, quiet apartment tucked close to the lake, galleries, and neighborhood food spots.",
    price: 2900,
    location: "Hauz Khas, New Delhi",
    type: "flat",
    maxGuests: 3,
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-chandigarh-hotel",
    title: "Rose Garden Retreat",
    description: "A relaxed city hotel near Chandigarh's gardens, with an easy ride to Sector 17.",
    price: 3400,
    location: "Sector 16, Chandigarh",
    type: "hotel",
    maxGuests: 2,
    images: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85"],
  },
  {
    sampleKey: "stayshare-demo-chandigarh-hostel",
    title: "Sector 17 Social Stay",
    description: "A friendly, no-fuss hostel with bright shared spaces and the city centre close by.",
    price: 1450,
    location: "Sector 17, Chandigarh",
    type: "hostel",
    maxGuests: 4,
    images: ["https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85"],
  },
];

try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from backend/.env");
  await mongoose.connect(process.env.MONGODB_URI);

  let owner = await User.findOne({ email: "host@stayshare.demo", role: "admin" })
    || await User.findOne({ role: "admin" }).sort({ createdAt: 1 })
    || await User.findOne({ role: "superadmin" }).sort({ createdAt: 1 });
  if (!owner) {
    const email = process.env.DEMO_HOST_EMAIL || "sample-host@stayshare.invalid";
    owner = await User.findOne({ email, role: "admin" });
    if (!owner) {
      const conflictingUser = await User.exists({ email });
      if (conflictingUser) throw new Error("DEMO_HOST_EMAIL is already used by a non-host account");
      owner = await User.create({
        name: "StayShare Sample Host",
        email,
        password: randomBytes(32).toString("hex"),
        role: "admin",
      });
      console.log("Created a sample host account with a randomly generated password.");
    }
  }

  let added = 0;
  let alreadyPresent = 0;
  for (const sample of demoProperties) {
    const exists = await Property.findOne({ sampleKey: sample.sampleKey });
    if (exists) {
      alreadyPresent += 1;
      continue;
    }
    await Property.create({ ...sample, owner: owner._id });
    added += 1;
  }

  console.log(`Demo listings added: ${added}; already present: ${alreadyPresent}.`);
} finally {
  await mongoose.disconnect();
}
