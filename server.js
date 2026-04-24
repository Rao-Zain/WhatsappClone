const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const { initializeSocket } = require('./socket/handler');

const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ────────────────────────────
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// ─── Middleware ──────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files (frontend) — disable caching so all devices get the latest code
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes (HTTP half) ─────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// ─── Catch-all: serve the SPA ───────────────────
app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Initialize Socket.io (WebSocket half) ──────
initializeSocket(io);

// ─── Start Server ───────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Clone Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready for connections`);
    console.log(`📦 API routes mounted at /api\n`);
});
