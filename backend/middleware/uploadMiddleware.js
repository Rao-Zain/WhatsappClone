
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDirectory = path.resolve("uploads/attachments");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).slice(0, 20).toLowerCase();

    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const allowedTypes = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".avif": ["image/avif"],

  ".mp4": ["video/mp4"],
  ".webm": ["video/webm", "audio/webm"],
  ".mov": ["video/quicktime"],
  ".m4v": ["video/x-m4v", "video/mp4"],
  ".mkv": ["video/x-matroska"],

  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav", "audio/x-wav", "audio/wave"],
  ".ogg": ["audio/ogg", "application/ogg"],
  ".oga": ["audio/ogg"],
  ".m4a": ["audio/mp4", "audio/x-m4a"],
  ".aac": ["audio/aac", "audio/x-aac"],
  ".opus": ["audio/opus", "audio/ogg"],
  ".flac": ["audio/flac", "audio/x-flac"],

  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
  ".zip": ["application/zip", "application/x-zip-compressed"],
  ".rar": ["application/vnd.rar", "application/x-rar-compressed"],
  ".7z": ["application/x-7z-compressed"],
};

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const acceptedMimeTypes = allowedTypes[extension];

    if (!acceptedMimeTypes) {
      return callback(
        new Error(
          `File type "${extension || "unknown"}" is not supported.`
        )
      );
    }

    // Browsers sometimes provide generic MIME types for certain files.
    // Reject known mismatches but allow application/octet-stream.
    const mimeType = (file.mimetype || "").toLowerCase();

    if (
      mimeType &&
      mimeType !== "application/octet-stream" &&
      !acceptedMimeTypes.includes(mimeType)
    ) {
      return callback(
        new Error(
          `The file extension "${extension}" does not match its MIME type.`
        )
      );
    }

    callback(null, true);
  },
});

export default upload;
