import LoginAttempt from "../models/LoginAttempt.js";

/* Login lockout.
   Two counters per login attempt:
   - account + IP : 5 wrong passwords from the same address -> locked for 15 minutes.
                    (An attacker can't lock YOU out from your own address.)
   - account      : 20 wrong passwords from anywhere        -> locked for 15 minutes.
                    (Stops attackers who spread guesses over many addresses.)
   Wrong guesses for names that don't exist are counted too, so the lockout
   message never reveals whether an account exists. */

const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgotten
const LOCK_MS = 15 * 60 * 1000;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const clean = (identifier) => String(identifier).trim().toLowerCase().slice(0, 100);

export function loginKeys(identifier, ip) {
  const id = clean(identifier);

  return [
    { key: `acct:${id}`, max: 20 },
    { key: `acctip:${id}|${ip || "unknown"}`, max: 5 },
  ];
}

// Minutes left on the longest lock, or 0 if not locked.
export async function getLockMinutes(keys) {
  const rows = await LoginAttempt.find({
    key: { $in: keys.map((item) => item.key) },
  }).lean();

  let longest = 0;

  for (const row of rows) {
    if (row.lockedUntil) {
      longest = Math.max(longest, row.lockedUntil.getTime() - Date.now());
    }
  }

  return longest > 0 ? Math.ceil(longest / 60000) : 0;
}

async function recordOne({ key, max }) {
  // Old failures expire.
  await LoginAttempt.updateOne(
    { key, updatedAt: { $lt: new Date(Date.now() - WINDOW_MS) } },
    { $set: { failures: 0, lockedUntil: null } }
  );

  let row;

  try {
    row = await LoginAttempt.findOneAndUpdate(
      { key },
      { $inc: { failures: 1 } },
      { upsert: true, new: true }
    );
  } catch (error) {
    // Two requests created the row at the same moment: just count again.
    if (error?.code !== 11000) throw error;

    row = await LoginAttempt.findOneAndUpdate(
      { key },
      { $inc: { failures: 1 } },
      { new: true }
    );
  }

  if (row && row.failures >= max) {
    await LoginAttempt.updateOne(
      { _id: row._id },
      { $set: { failures: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } }
    );
  }
}

export async function recordFailure(keys) {
  await Promise.all(keys.map(recordOne));
}

// A correct password clears the counters.
export async function clearFailures(keys) {
  await LoginAttempt.deleteMany({ key: { $in: keys.map((item) => item.key) } });
}

// After a password reset: remove every lock for this account.
export async function clearAccountLocks(user) {
  const names = [user.email, user.username].filter(Boolean).map(clean);

  await LoginAttempt.deleteMany({
    $or: [
      { key: { $in: names.map((name) => `acct:${name}`) } },
      ...names.map((name) => ({
        key: { $regex: `^acctip:${escapeRegExp(name)}\\|` },
      })),
    ],
  });
}