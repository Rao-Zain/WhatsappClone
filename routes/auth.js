const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');

// ─── Multer Config for Avatar Upload ────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user_${req.userId}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype.split('/')[1]);
        if (extOk && mimeOk) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

// ─── REGISTER ──────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or email already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert user
        const [result] = await db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        // Generate token
        const token = generateToken(result.insertId);

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax'
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: { id: result.insertId, username, email, avatar: 'default.png', about: 'Hey there! I am using WhatsApp.' },
            token
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── LOGIN ──────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Find user
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = users[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user.id);

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                about: user.about
            },
            token
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── LOGOUT ─────────────────────────────────────
router.post('/logout', verifyToken, (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out' });
});

// ─── GET CURRENT USER ───────────────────────────
router.get('/me', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, avatar, about, is_online, last_seen FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: users[0] });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET ALL USERS (for contacts list) ──────────
router.get('/users', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, avatar, about, is_online, last_seen FROM users WHERE id != ? ORDER BY username',
            [req.userId]
        );

        res.json({ success: true, users });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── UPDATE PROFILE (username, about) ───────────
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { username, about } = req.body;
        const userId = req.userId;

        // Build dynamic update
        const updates = [];
        const values = [];

        if (username && username.trim()) {
            // Check if username is taken by someone else
            const [existing] = await db.query(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [username.trim(), userId]
            );
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
            updates.push('username = ?');
            values.push(username.trim());
        }

        if (about !== undefined) {
            updates.push('about = ?');
            values.push(about.trim());
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Nothing to update' });
        }

        values.push(userId);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        // Fetch updated user
        const [users] = await db.query(
            'SELECT id, username, email, avatar, about FROM users WHERE id = ?',
            [userId]
        );

        res.json({ success: true, message: 'Profile updated', user: users[0] });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── UPLOAD AVATAR ──────────────────────────────
router.post('/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const avatarPath = req.file.filename;
        const userId = req.userId;

        // Delete old avatar file (if not default)
        const [users] = await db.query('SELECT avatar FROM users WHERE id = ?', [userId]);
        if (users[0]?.avatar && users[0].avatar !== 'default.png') {
            const oldPath = path.join(__dirname, '..', 'uploads', 'avatars', users[0].avatar);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Update DB
        await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId]);

        res.json({
            success: true,
            message: 'Avatar updated',
            avatar: avatarPath
        });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── REMOVE AVATAR ──────────────────────────────
router.delete('/avatar', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;

        // Delete current avatar file
        const [users] = await db.query('SELECT avatar FROM users WHERE id = ?', [userId]);
        if (users[0]?.avatar && users[0].avatar !== 'default.png') {
            const oldPath = path.join(__dirname, '..', 'uploads', 'avatars', users[0].avatar);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Reset to default
        await db.query("UPDATE users SET avatar = 'default.png' WHERE id = ?", [userId]);

        res.json({ success: true, message: 'Avatar removed' });
    } catch (err) {
        console.error('Remove avatar error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
