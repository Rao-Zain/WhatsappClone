import fs from "fs";
import { shouldStoreInDb, putFile } from "../utils/gridStore.js";

// Runs right after multer: small images move from the disk into MongoDB.
export default async function moveSmallImagesToDb(req, _res, next) {
  for (const file of req.files || []) {
    try {
      if (!(await shouldStoreInDb(file))) continue;

      file.storageKey = await putFile(file.path, file.originalname, file.mimetype);
      await fs.promises.unlink(file.path).catch(() => {});
      file.path = null; // already removed
    } catch (error) {
      console.error("Keeping file on disk:", error.message); // falls back to the folder
    }
  }
  next();
}