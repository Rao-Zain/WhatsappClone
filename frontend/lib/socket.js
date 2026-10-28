
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket;

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );
}

export function getSocket() {
  const token = getToken();

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: {
        token,
      },
    });
  }

    // The server refuses sockets whose login was ended (e.g. password reset elsewhere).
  // `registeredAuthHandler` makes sure we only listen once.
  if (!socket.registeredAuthHandler) {
    socket.registeredAuthHandler = true;

    socket.on("connect_error", (error) => {
      if (/authentication|token/i.test(error?.message || "")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
      }
    });
  }

  // Refresh the token whenever the socket is requested.
  // This prevents using an old token after login or logout.
  socket.auth = { token };

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
