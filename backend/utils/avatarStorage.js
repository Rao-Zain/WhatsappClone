import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Profile pictures are public, so they live in their own folder.
// (Chat attachments stay private behind the authenticated download route.)
export const avatarDirectory = path.resolve("uploads/avatars");

const EXTENSIONS = { jpeg: "jpg", png: "png", webp: "webp" };

// Check the real file bytes, not just what the client claims it is.
const SIGNATURES = {
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) =>
    b.length > 8 &&
    b.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
  webp: (b) =>
    b.length > 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP",
};

// Only ever delete files we created ourselves (blocks path traversal).
const OUR_FILENAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Public address of this server, used to build the stored image URL.
export function getPublicBaseUrl(req) {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  return base.replace(/\/+$/, "");
}

// Writes the image to uploads/avatars and returns its full public URL.
export async function saveAvatar(buffer, imageType, baseUrl) {
  const type = String(imageType).toLowerCase();

  if (!SIGNATURES[type]?.(buffer)) {
    const error = new Error("The file is not a valid image.");
    error.code = "INVALID_IMAGE";
    throw error;
  }

  await fs.mkdir(avatarDirectory, { recursive: true });

  const filename = `${crypto.randomUUID()}.${EXTENSIONS[type]}`;
  await fs.writeFile(path.join(avatarDirectory, filename), buffer);

  return `${baseUrl}/uploads/avatars/${filename}`;
}

// Removes the previous avatar file. Old base64 values and other URLs are ignored.
export async function deleteAvatarByUrl(url) {
  try {
    if (typeof url !== "string" || !url.includes("/uploads/avatars/")) return;

    const filename = path.basename(new URL(url).pathname);
    if (!OUR_FILENAME.test(filename)) return;

    await fs.unlink(path.join(avatarDirectory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not delete old avatar:", error.message);
    }
  }
}



function avatarError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Accepts a cropped JPEG/PNG/WebP data URL (max 1 MB) and returns the saved file's URL.
// Errors carry an HTTP `status` so controllers can reply with them directly.
export async function saveAvatarFromDataUrl(dataUrl, baseUrl) {
  const match =
    typeof dataUrl === "string"
      ? /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(dataUrl)
      : null;

  if (!match) {
    throw avatarError("Upload a valid JPEG, PNG, or WebP image.", 400);
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 1024 * 1024) {
    throw avatarError("The cropped image must be 1 MB or smaller.", 413);
  }

  try {
    return await saveAvatar(buffer, match[1], baseUrl);
  } catch (error) {
    if (error.code === "INVALID_IMAGE") {
      throw avatarError("The image data is invalid.", 400);
    }
    throw error;
  }
}