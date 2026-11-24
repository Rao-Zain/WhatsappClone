
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import initializeSocket, { resetPresence } from "./socket/socket.js";
import authRoutes from "./routes/authRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import path from "path";
import { avatarDirectory } from "./utils/avatarStorage.js";
import callRoutes from "./routes/callRoutes.js";   // with the other route imports
import chatRequestRoutes from "./routes/chatRequestRoutes.js";
import blockRoutes from "./routes/blockRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import { cleanupExpiredStatuses } from "./controllers/statusController.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { checkEnv } from "./utils/checkEnv.js";
import { resolveEnv, isProduction } from "./utils/resolveEnv.js";

dotenv.config();
const appEnv = resolveEnv(); // picks the local or production URLs
checkEnv(); // stops here with a clear message if the settings are wrong
const app = express();
const httpServer = createServer(app);

const clientUrls = [
  process.env.CLIENT_URL,
  ...(process.env.ALLOWED_ORIGINS || "").split(","),
  "https://hexachat.hexalogicx.com",
].map((value) => value?.trim()).filter(Boolean);

const allowedOrigins = [...new Set(clientUrls)];

// While developing, also accept the app opened from localhost or from this
// computer's network address (for example a phone on the same Wi-Fi).
const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const corsOriginValidator = (origin, callback) => {
  if (
    !origin ||
    allowedOrigins.includes(origin) ||
    (!isProduction() && LOCAL_ORIGIN.test(origin))
  ) {
    callback(null, true);
    return;
  }

  callback(new Error("Not allowed by CORS"));
};

// Behind a reverse proxy (Nginx, Render, Railway...) set TRUST_PROXY=1 in .env so
// rate limits see each visitor's real IP. Leave it unset when there is no proxy.
app.set("trust proxy", Number(process.env.TRUST_PROXY) || 0);

// Safe default security headers. "cross-origin" lets the web app (another address)
// show profile pictures served from /uploads/avatars.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Middleware
app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Allow small, cropped profile photos in JSON requests.
app.use(express.json({ limit: "2mb" }));

// Public profile pictures only. Chat attachments stay private.
app.use(
  "/uploads/avatars",
  express.static(avatarDirectory, { maxAge: "7d", immutable: true })
);

// API routes
app.use("/api", apiLimiter);              // under app.use("/api/messages", messageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/calls", callRoutes);    

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

initializeSocket(io);
app.set("io", io);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp Clone backend is running!",
  });
});



app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Each file must be 100 MB or smaller.",
    });
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "You can attach at most 10 files at a time.",
    });
  }

  if (error.message?.includes("not supported")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Request error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});


// MongoDB connection and server startup
const preferredPorts = [
  Number.parseInt(process.env.PORT || "5000", 10),
  5001,
  5002,
  5003,
  5004,
  5005,
  5006,
  5007,
  5008,
  5009,
  5010,
];

function startListening(portIndex = 0) {
  const port = preferredPorts[portIndex];

  httpServer.once("error", (error) => {
    if (error.code === "EADDRINUSE" && portIndex < preferredPorts.length - 1) {
      const nextPort = preferredPorts[portIndex + 1];
      console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
      startListening(portIndex + 1);
      return;
    }

    console.error(`Failed to start server on port ${port}:`, error.message);
    process.exit(1);
  });

  httpServer.listen(port, "0.0.0.0", () => {
    process.env.PORT = String(port);
    console.log(`Server running at http://localhost:${port} (${appEnv} mode)`);
    console.log(`Allowing browser requests from: ${allowedOrigins.join(", ")}`);

    // Status updates last 24 hours: remove expired ones (and their files) now and every 15 minutes.
    cleanupExpiredStatuses();
    setInterval(cleanupExpiredStatuses, 15 * 60 * 1000);
  });
}

async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://127.0.0.1:27017/whatsapp_clone"
    );
    await resetPresence();

    console.log("MongoDB connected successfully");
    startListening();
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
