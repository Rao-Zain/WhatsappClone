const db = require('../config/database');
const { verifySocketToken } = require('../middleware/auth');

const onlineUsers = new Map();

function initializeSocket(io) {

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));
        const decoded = verifySocketToken(token);
        if (!decoded) return next(new Error('Invalid token'));
        socket.userId = decoded.id;
        next();
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        console.log(`🟢 User ${userId} connected (socket: ${socket.id})`);

        onlineUsers.set(userId, socket.id);
        await db.query('UPDATE users SET is_online = 1 WHERE id = ?', [userId]);
        io.emit('user:online', { userId });
        socket.emit('users:online', Array.from(onlineUsers.keys()));

        // ─── Send Message (with reply support) ──────
        socket.on('message:send', async (data) => {
            try {
                const { receiverId, content, messageType = 'text', replyToId = null } = data;
                if (!receiverId || !content || !content.trim()) {
                    socket.emit('error', { message: 'Invalid message data' });
                    return;
                }

                const [result] = await db.query(
                    'INSERT INTO messages (sender_id, receiver_id, content, message_type, status, reply_to_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, receiverId, content.trim(), messageType, 'sent', replyToId]
                );

                const messageId = result.insertId;
                const [senderRows] = await db.query('SELECT username, avatar FROM users WHERE id = ?', [userId]);

                // Fetch replied-to message if exists
                let replyData = null;
                if (replyToId) {
                    const [replyRows] = await db.query(
                        'SELECT m.id, m.content, m.sender_id, u.username as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
                        [replyToId]
                    );
                    if (replyRows.length > 0) replyData = replyRows[0];
                }

                const messageData = {
                    id: messageId,
                    sender_id: userId,
                    receiver_id: receiverId,
                    content: content.trim(),
                    message_type: messageType,
                    status: 'sent',
                    created_at: new Date().toISOString(),
                    sender_name: senderRows[0]?.username,
                    sender_avatar: senderRows[0]?.avatar,
                    reply_to_id: replyToId,
                    reply: replyData
                };

                socket.emit('message:sent', messageData);

                const receiverSocketId = onlineUsers.get(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('message:receive', messageData);
                    await db.query('UPDATE messages SET status = ? WHERE id = ?', ['delivered', messageId]);
                    socket.emit('message:status', { messageId, status: 'delivered' });
                }

            } catch (err) {
                console.error('Message send error:', err);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // ─── Typing ─────────────────────────────────
        socket.on('typing:start', (data) => {
            const s = onlineUsers.get(data.receiverId);
            if (s) io.to(s).emit('typing:start', { userId });
        });
        socket.on('typing:stop', (data) => {
            const s = onlineUsers.get(data.receiverId);
            if (s) io.to(s).emit('typing:stop', { userId });
        });

        // ─── Message Seen ───────────────────────────
        socket.on('message:seen', async (data) => {
            try {
                const { senderId } = data;
                const [unseen] = await db.query(
                    `SELECT id FROM messages WHERE sender_id = ? AND receiver_id = ? AND status != 'seen' ORDER BY id`,
                    [senderId, userId]
                );
                if (unseen.length > 0) {
                    await db.query(`UPDATE messages SET status = 'seen' WHERE id IN (?)`, [unseen.map(m => m.id)]);
                }
                const senderSocketId = onlineUsers.get(senderId);
                if (senderSocketId) io.to(senderSocketId).emit('message:seen', { seenBy: userId });
            } catch (err) { console.error('Message seen error:', err); }
        });

        // ═══════════════════════════════════════════
        // CALL SIGNALING (WebRTC)
        // ═══════════════════════════════════════════

        socket.on('call:initiate', async (data) => {
            const { receiverId, callType } = data; // callType: 'audio' or 'video'
            const receiverSocketId = onlineUsers.get(receiverId);

            const [callerRows] = await db.query('SELECT username, avatar FROM users WHERE id = ?', [userId]);
            const callerInfo = { id: userId, username: callerRows[0]?.username, avatar: callerRows[0]?.avatar };

            if (!receiverSocketId) {
                socket.emit('call:unavailable', { message: 'User is offline' });
                return;
            }

            io.to(receiverSocketId).emit('call:incoming', { caller: callerInfo, callType });
            socket.emit('call:ringing', { receiverId });
        });

        socket.on('call:accept', (data) => {
            const callerSocketId = onlineUsers.get(data.callerId);
            if (callerSocketId) io.to(callerSocketId).emit('call:accepted', { userId });
        });

        socket.on('call:reject', (data) => {
            const callerSocketId = onlineUsers.get(data.callerId);
            if (callerSocketId) io.to(callerSocketId).emit('call:rejected', { userId });
        });

        socket.on('call:end', (data) => {
            const otherSocketId = onlineUsers.get(data.userId);
            if (otherSocketId) io.to(otherSocketId).emit('call:ended', { userId });
        });

        // WebRTC signaling
        socket.on('webrtc:offer', (data) => {
            const s = onlineUsers.get(data.to);
            if (s) io.to(s).emit('webrtc:offer', { offer: data.offer, from: userId });
        });

        socket.on('webrtc:answer', (data) => {
            const s = onlineUsers.get(data.to);
            if (s) io.to(s).emit('webrtc:answer', { answer: data.answer, from: userId });
        });

        socket.on('webrtc:ice-candidate', (data) => {
            const s = onlineUsers.get(data.to);
            if (s) io.to(s).emit('webrtc:ice-candidate', { candidate: data.candidate, from: userId });
        });

        // ─── Disconnect ─────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`🔴 User ${userId} disconnected`);
            onlineUsers.delete(userId);
            await db.query('UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?', [userId]);
            io.emit('user:offline', { userId });
        });
    });
}

module.exports = { initializeSocket, onlineUsers };
