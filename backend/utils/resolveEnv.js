// Works out whether the server is running locally or in production, and
// picks the matching URLs so you never have to edit .env when switching.
//
// Production = NODE_ENV is "production", or the server runs on Render
// (Render always sets RENDER=true). Anything else counts as local.

export function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
}

// For each of these, .env may hold KEY_LOCAL and KEY_PROD.
// The one matching the current mode is copied into KEY.
const MODE_KEYS = ["CLIENT_URL", "PUBLIC_URL", "MONGODB_URI"];

export function resolveEnv() {
  const production = isProduction();
  const suffix = production ? "PROD" : "LOCAL";

  for (const key of MODE_KEYS) {
    const modeValue = process.env[`${key}_${suffix}`]?.trim();
    if (modeValue) process.env[key] = modeValue;
  }

  // Sensible fallbacks when nothing is set.
  if (!process.env.CLIENT_URL?.trim() && !production) {
    process.env.CLIENT_URL = "http://localhost:5173";
  }

  if (!process.env.PUBLIC_URL?.trim()) {
    process.env.PUBLIC_URL = production
      ? process.env.RENDER_EXTERNAL_URL || ""
      : `http://localhost:${process.env.PORT || 5000}`;
  }

  process.env.APP_ENV = production ? "production" : "local";
  return process.env.APP_ENV;
}
