// Decides which backend the app talks to, so nothing has to be edited when
// you switch between local development and production.
//
//  - Opened on localhost / 127.0.0.1 / a home-network address (192.168.x.x ...)
//      -> your local backend on port 5000 (same computer as the page)
//  - Opened anywhere else (your real domain)
//      -> the production backend
//
// To force a different backend, set VITE_API_URL and VITE_SOCKET_URL
// (for example in frontend/.env.local). Leave them out for automatic mode.

const PRODUCTION_BACKEND = "https://web-hexachat.onrender.com";
const LOCAL_BACKEND_PORT = 5000;

function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
  );
}

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

export const IS_LOCAL = isLocalHostname(hostname);

// Using the page's own hostname means a phone that opens
// http://192.168.1.7:5173 reaches the backend at http://192.168.1.7:5000.
const backendOrigin = IS_LOCAL
  ? `http://${hostname}:${LOCAL_BACKEND_PORT}`
  : PRODUCTION_BACKEND;

const fromEnv = (value) => (value || "").trim().replace(/\/+$/, "");

export const API_URL = fromEnv(import.meta.env.VITE_API_URL) || `${backendOrigin}/api`;
export const SOCKET_URL = fromEnv(import.meta.env.VITE_SOCKET_URL) || backendOrigin;
