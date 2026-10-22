import { io } from "socket.io-client";

const token = process.env.TEST_TOKEN;

if (!token) {
  console.error("Please provide TEST_TOKEN.");
  process.exit(1);
}

const socket = io("http://localhost:5000", {
  auth: { token },
  reconnection: false,
});

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Connection rejected:", error.message);
});

socket.on("user:online", ({ userId }) => {
  console.log("User online:", userId);
});

socket.on("user:offline", ({ userId }) => {
  console.log("User offline:", userId);
});

// Keep the connection open for testing.
// Press Ctrl+C to disconnect.
