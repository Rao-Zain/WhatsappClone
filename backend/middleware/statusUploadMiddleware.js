import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const statusDirectory = path.resolve("uploads/statuses");

fs.mkdirSync(statusDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, statusDirectory),

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).slice(0, 10).toLowerCase();

    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

// Status updates are photos and short videos only.
export const STATUS_TYPES = {
  ".jpg": { mime: ["image/jpeg"], kind: "image" },
  ".jpeg": { mime: ["image/jpeg"], kind: "image" },
  ".png": { mime: ["image/png"], kind: "image" },
  ".webp": { mime: ["image/webp"], kind: "image" },
  ".gif": { mime: ["image/gif"], kind: "image" },

  ".mp4": { mime: ["video/mp4"], kind: "video" },
  ".webm": { mime: ["video/webm"], kind: "video" },
  ".mov": { mime: ["video/quicktime"], kind: "video" },
  ".m4v": { mime: ["video/x-m4v", "video/mp4"], kind: "video" },
};

const statusUpload = multer({
  storage,

  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = STATUS_TYPES[extension];

    // "not supported" is what the server's error handler turns into a 400.
    if (!allowed) {
      return callback(
        new Error(
          `File type "${extension || "unknown"}" is not supported for status updates.`
        )
      );
    }

    const mimeType = (file.mimetype || "").toLowerCase();

    if (
      mimeType &&
      mimeType !== "application/octet-stream" &&
      !allowed.mime.includes(mimeType)
    ) {
      return callback(
        new Error(`The file extension "${extension}" is not supported with that file type.`)
      );
    }

    callback(null, true);
  },
});

export default statusUpload;