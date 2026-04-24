const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'attachments');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `attachment_${req.userId}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// ─── UPLOAD ATTACHMENT ──────────────────────────
router.post('/upload', verifyToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, filename: req.file.filename, originalname: req.file.originalname });
});

// ─── GET CHAT HISTORY (with reply data) ─────────
router.get('/:receiverId', verifyToken, async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = parseInt(req.params.receiverId);

        const [messages] = await db.query(
            `SELECT m.*, u.username as sender_name, u.avatar as sender_avatar,
                    r.content as reply_content, r.sender_id as reply_sender_id,
                    ru.username as reply_sender_name
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             LEFT JOIN messages r ON m.reply_to_id = r.id
             LEFT JOIN users ru ON r.sender_id = ru.id
             WHERE (m.sender_id = ? AND m.receiver_id = ?)
                OR (m.sender_id = ? AND m.receiver_id = ?)
             ORDER BY m.created_at ASC`,
            [senderId, receiverId, receiverId, senderId]
        );

        // Mark unseen as seen
        const unseenIds = messages.filter(m => m.sender_id === receiverId && m.status !== 'seen').map(m => m.id);
        if (unseenIds.length > 0) {
            await db.query(`UPDATE messages SET status = 'seen' WHERE id IN (?)`, [unseenIds]);
        }

        // Restructure reply data
        const formatted = messages.map(m => ({
            ...m,
            reply: m.reply_to_id ? { id: m.reply_to_id, content: m.reply_content, sender_id: m.reply_sender_id, sender_name: m.reply_sender_name } : null
        }));

        res.json({ success: true, messages: formatted });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET RECENT CONVERSATIONS ───────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const [conversations] = await db.query(
            `SELECT u.id, u.username, u.avatar, u.about, u.is_online, u.last_seen,
                    m.content as last_message, m.created_at as last_message_time,
                    m.sender_id as last_sender_id, m.status as last_message_status,
                    m.message_type as last_message_type,
                    (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND status != 'seen') as unread_count
             FROM users u
             INNER JOIN messages m ON m.id = (
                 SELECT MAX(id) FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
             )
             WHERE u.id != ?
             ORDER BY m.created_at DESC`,
            [userId, userId, userId, userId]
        );
        res.json({ success: true, conversations });
    } catch (err) {
        console.error('Get conversations error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
