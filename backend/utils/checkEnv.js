// Stops the server early, with a clear message, when it is badly configured.
export function checkEnv() {
  const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    throw new Error(
      `Missing settings in backend/.env: ${missing.join(", ")}. ` +
        "Copy backend/.env.example to backend/.env and fill it in."
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    const message =
      "JWT_SECRET is too short (use at least 32 random characters). " +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';

    if (process.env.NODE_ENV === "production") throw new Error(message);

    console.warn(`WARNING: ${message}`);
  }

  const emailKeys = ["BREVO_SENDER_EMAIL"];
const missingEmail = emailKeys.filter((key) => !process.env[key]?.trim());
if (!(process.env.BREVO_API_KEY || process.env.BREVO_API)?.trim()) {
  missingEmail.push("BREVO_API_KEY");
}

  if (missingEmail.length) {
    console.warn(
      `WARNING: email is not configured (${missingEmail.join(", ")}). ` +
        "Sign-up codes and password-reset codes cannot be sent."
    );
  }
}