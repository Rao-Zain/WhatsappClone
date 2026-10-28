
import axios from "axios";
import { alertInfo } from "./swal";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Attach the saved JWT to authenticated API requests.
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// If the server says the login is no longer valid (for example after a password
// reset on another device), clear the saved login and go to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthCall =
      /\/auth\/(login|register|verify-otp|resend-otp|forgot-password|reset-password)/.test(url);

    const hadToken =
      localStorage.getItem("token") || sessionStorage.getItem("token");

    if (error.response?.status === 401 && hadToken && !isAuthCall) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

let sessionAlertOpen = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || "";
    const hadToken = Boolean(error.config?.headers?.Authorization);
    const isLoginAttempt = /\/auth\/(login|register|verify-otp|resend-otp)/.test(url);

    if (error.response?.status === 401 && hadToken && !isLoginAttempt && !sessionAlertOpen) {
      sessionAlertOpen = true;

      ["token", "user"].forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      await alertInfo("Session expired", "For your security you were signed out. Please log in again.", {
        confirmText: "Log in",
      });

      // A full reload also drops the old socket connection and any cached state.
      window.location.replace("/login");
    }

    return Promise.reject(error);
  }
);

// Forget any default Authorization header (used when logging out).
export function clearAuthHeader() {
  if (api.defaults?.headers?.common) {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
