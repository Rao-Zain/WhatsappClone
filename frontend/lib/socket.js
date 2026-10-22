
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
