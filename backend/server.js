
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

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

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
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
