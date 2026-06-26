const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { onlineUsers } = require('../socket/handler');

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
                    ru.username as reply_sender_name, r.is_deleted as reply_is_deleted
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             LEFT JOIN messages r ON m.reply_to_id = r.id
             LEFT JOIN users ru ON r.sender_id = ru.id
             WHERE ((m.sender_id = ? AND m.receiver_id = ?)
                OR (m.sender_id = ? AND m.receiver_id = ?))
               AND NOT (m.sender_id = ? AND m.deleted_by_sender = 1)
               AND NOT (m.receiver_id = ? AND m.deleted_by_receiver = 1)
             ORDER BY m.created_at ASC`,
            [senderId, receiverId, receiverId, senderId, senderId, senderId]
        );

        // Mark unseen as seen
        const unseenIds = messages.filter(m => m.sender_id === receiverId && m.status !== 'seen').map(m => m.id);
        if (unseenIds.length > 0) {
            await db.query(`UPDATE messages SET status = 'seen' WHERE id IN (?)`, [unseenIds]);
            
            // Notify the sender that these messages have been read
            const senderSocketId = onlineUsers.get(receiverId);
            if (senderSocketId) {
                const io = req.app.get('io');
                if (io) {
                    io.to(senderSocketId).emit('message:seen', { seenBy: senderId });
                }
            }
        }

        // Restructure reply data
        const formatted = messages.map(m => ({
            ...m,
            reply: m.reply_to_id ? { 
                id: m.reply_to_id, 
                content: m.reply_content, 
                sender_id: m.reply_sender_id, 
                sender_name: m.reply_sender_name,
                is_deleted: m.reply_is_deleted 
            } : null
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
                    m.is_deleted as last_message_is_deleted,
                    (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND status != 'seen' AND deleted_by_receiver = 0) as unread_count
             FROM users u
             INNER JOIN messages m ON m.id = (
                 SELECT MAX(id) FROM messages 
                 WHERE ((sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id))
                   AND NOT (sender_id = ? AND deleted_by_sender = 1)
                   AND NOT (receiver_id = ? AND deleted_by_receiver = 1)
             )
             WHERE u.id != ?
             ORDER BY m.created_at DESC`,
            [userId, userId, userId, userId, userId, userId]
        );
        res.json({ success: true, conversations });
    } catch (err) {
        console.error('Get conversations error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── DELETE MESSAGE ─────────────────────────────
router.delete('/:messageId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const messageId = parseInt(req.params.messageId);
        const { type } = req.body; // 'me' or 'everyone'

        // Fetch message details
        const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [messageId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        const message = rows[0];

        // Authorization check
        if (message.sender_id !== userId && message.receiver_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized to delete this message' });
        }

        if (type === 'everyone') {
            // Only the sender can delete for everyone
            if (message.sender_id !== userId) {
                return res.status(403).json({ success: false, message: 'Only the sender can delete for everyone' });
            }

            // Mark as deleted for everyone
            await db.query('UPDATE messages SET is_deleted = 1 WHERE id = ?', [messageId]);

            // If it has file attachments, clean them from disk
            if (message.message_type !== 'text') {
                const filePath = path.join(__dirname, '..', 'uploads', 'attachments', message.content);
                fs.unlink(filePath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error('Failed to delete attachment file:', err);
                    }
                });
            }

            // Notify both users via sockets
            const { onlineUsers } = require('../socket/handler');
            const io = req.app.get('io');
            if (io) {
                const senderSocketId = onlineUsers.get(message.sender_id);
                const receiverSocketId = onlineUsers.get(message.receiver_id);
                if (senderSocketId) io.to(senderSocketId).emit('message:delete', { messageId, type: 'everyone' });
                if (receiverSocketId) io.to(receiverSocketId).emit('message:delete', { messageId, type: 'everyone' });
            }

            return res.json({ success: true, message: 'Message deleted for everyone' });
        } else if (type === 'me') {
            // Delete for me
            if (message.sender_id === userId) {
                await db.query('UPDATE messages SET deleted_by_sender = 1 WHERE id = ?', [messageId]);
            } else {
                await db.query('UPDATE messages SET deleted_by_receiver = 1 WHERE id = ?', [messageId]);
            }

            return res.json({ success: true, message: 'Message deleted for me' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid delete type' });
        }
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
