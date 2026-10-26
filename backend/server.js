
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
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
import { cleanupExpiredStatuses } from "./controllers/statusController.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

// Middleware
app.use(
  cors({
    origin: clientUrl,
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
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat-requests", chatRequestRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/calls", callRoutes);                  // under app.use("/api/messages", messageRoutes);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: clientUrl,
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
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://127.0.0.1:27017/whatsapp_clone"
    );
    await resetPresence();

    console.log("MongoDB connected successfully");

    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    
    // Status updates last 24 hours: remove expired ones (and their files) now and every 15 minutes.
    cleanupExpiredStatuses();
    setInterval(cleanupExpiredStatuses, 15 * 60 * 1000);
    
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
