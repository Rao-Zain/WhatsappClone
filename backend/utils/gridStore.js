import fs from "fs";
import mongoose from "mongoose";

// Small images go into MongoDB (GridFS). Everything else stays on disk.
const MAX_IMAGE_BYTES = Number(process.env.DB_IMAGE_MAX_BYTES) || 2 * 1024 * 1024;   // 2 MB per image
const DB_CAP_BYTES = Number(process.env.DB_STORAGE_CAP_BYTES) || 400 * 1024 * 1024;  // stop using the DB at 400 MB

export const GRIDFS_PREFIX = "gridfs:";
export const isGridKey = (key) => typeof key === "string" && key.startsWith(GRIDFS_PREFIX);

const idOf = (key) => new mongoose.Types.ObjectId(key.slice(GRIDFS_PREFIX.length));
const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "attachments" });

// Is there still room in the free cluster?
async function hasRoom(extraBytes) {
  try {
    const s = await mongoose.connection.db.command({ dbStats: 1 });
    return s.storageSize + s.indexSize + extraBytes <= DB_CAP_BYTES;
  } catch {
    return false; // can't tell, so keep the file on disk
  }
}

export async function shouldStoreInDb(file) {
  return (
    file.mimetype?.startsWith("image/") &&
    file.size <= MAX_IMAGE_BYTES &&
    (await hasRoom(file.size))
  );
}

function pipeInto(source, filename, contentType) {
  return new Promise((resolve, reject) => {
    const up = bucket().openUploadStream(filename, { contentType });
    source.on("error", reject);
    up.on("error", reject).on("finish", () => resolve(`${GRIDFS_PREFIX}${up.id}`));
    source.pipe(up);
  });
}

// Disk file -> MongoDB. Returns the key to save as storageKey.
export const putFile = (filePath, filename, contentType) =>
  pipeInto(fs.createReadStream(filePath), filename, contentType);

// Used when forwarding: make an independent copy.
export const duplicateFile = (key, filename, contentType) =>
  pipeInto(bucket().openDownloadStream(idOf(key)), filename, contentType);

export const streamFile = (key) => bucket().openDownloadStream(idOf(key));

export async function hasFile(key) {
  const found = await bucket().find({ _id: idOf(key) }).limit(1).toArray();
  return found.length > 0;
}

export async function deleteFile(key) {
  try {
    await bucket().delete(idOf(key));
  } catch {
    /* already gone */
  }
}

// Cleans up an upload that failed, wherever it was stored.
export async function discardUpload(file) {
  if (isGridKey(file.storageKey)) await deleteFile(file.storageKey);
  else if (file.path) await fs.promises.unlink(file.path).catch(() => {});
}