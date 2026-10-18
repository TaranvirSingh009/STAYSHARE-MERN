import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const uploadDir = path.join(publicDir, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
    const error = new Error("Upload a JPEG, PNG, WebP, GIF, or AVIF image");
    error.status = 400;
    cb(error);
  },
});
