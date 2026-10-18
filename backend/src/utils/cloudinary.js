import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

export const uploadOnCloudinary = async (localPath) => {
  const hasCloudinaryConfig = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ].every(Boolean);

  if (!hasCloudinaryConfig) return `/uploads/${path.basename(localPath)}`;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  try {
    const res = await cloudinary.uploader.upload(localPath, {
      folder: "stayshare",
    });
    fs.unlink(localPath, () => {});
    return res.secure_url;
  } catch (error) {
    console.warn("Cloudinary upload failed; using local image storage:", error.message);
    return `/uploads/${path.basename(localPath)}`;
  }
};
