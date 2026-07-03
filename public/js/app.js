/* ═══════════════════════════════════════════════════
   WhatsApp Clone — Client Application (With Reply & Call)
   ═══════════════════════════════════════════════════ */

// Global error handler — shows errors visually on ALL devices
window.onerror = function(msg, url, line, col, error) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:#fff;padding:12px;z-index:99999;font-size:14px;word-break:break-all;';
    d.textContent = 'JS ERROR: ' + msg + ' (Line: ' + line + ')';
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 10000);
};
window.onunhandledrejection = function(e) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:orange;color:#000;padding:12px;z-index:99999;font-size:14px;word-break:break-all;';
    d.textContent = 'PROMISE ERROR: ' + (e.reason ? e.reason.message || e.reason : 'Unknown');
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 10000);
};

let currentUser = null;
let token = null;
let socket = null;
let activeChat = null;
let onlineUsers = new Set();
let conversations = [];
let replyToMessage = null;

// WebRTC Globals
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callType = null; // 'audio' or 'video'
let callTimerInterval = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Dynamic viewport height handler for mobile keyboards & browsers
function updateViewportHeight() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--viewport-height', `${height}px`);
}
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
} else {
    window.addEventListener('resize', updateViewportHeight);
}
updateViewportHeight();

// ─── UI ELEMENTS ─────────────────────────────────
const authScreen = $('#auth-screen');
const chatScreen = $('#chat-screen');
const chatList = $('#chat-list');
const messagesList = $('#messages-list');
const messageInput = $('#message-input');
const replyPreview = $('#reply-preview');
const callOverlay = $('#call-overlay');
const incomingCallModal = $('#incoming-call');
const searchInput = $('#search-input');

// ─── UTILS ──────────────────────────────────────
function showToast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => t.className = 'toast', 3000);
}

function getAvatarColor(id) { return `avatar-color-${id % 8}`; }
function getAvatarLetter(name) { return name ? name.charAt(0).toUpperCase() : '?'; }
function formatTime(d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

window.scrollToMessage = function(msgId) {
    const el = $(`#msg-${msgId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-msg');
        setTimeout(() => el.classList.remove('highlight-msg'), 2000);
    }
}

function avatarHTML(id, name, avatarFile, sizeClass = 'avatar-md', showOnline = false) {
    const isOnline = onlineUsers.has(id);
    const hasImg = avatarFile && avatarFile !== 'default.png';
    return `<div class="avatar ${sizeClass} ${getAvatarColor(id)} ${hasImg ? 'has-image' : ''}">
        ${hasImg ? `<img src="/uploads/avatars/${avatarFile}" alt="">` : ''}
        <span>${getAvatarLetter(name)}</span>
        ${showOnline && isOnline ? '<div class="online-dot"></div>' : ''}
    </div>`;
}

function getStatusIcon(status) {
    if (status === 'sent') return `<span class="message-status status-sent">✓</span>`;
    if (status === 'delivered') return `<span class="message-status status-delivered">✓✓</span>`;
    if (status === 'seen') return `<span class="message-status status-seen">✓✓</span>`;
    return '';
}

async function api(url, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
    return res.json();
}

// ─── AUTH ───────────────────────────────────────
$('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) });
    if (data.success) { token = data.token; currentUser = data.user; localStorage.setItem('token', token); enterChatScreen(); }
    else showToast(data.message, true);
});

$('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: $('#register-username').value, email: $('#register-email').value, password: $('#register-password').value }) });
    if (data.success) { token = data.token; currentUser = data.user; localStorage.setItem('token', token); enterChatScreen(); }
    else showToast(data.message, true);
});

$('#forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: $('#forgot-email').value }) });
    if (data.success) {
        showToast(data.message);
        if (data.token) {
            $('#reset-email').value = $('#forgot-email').value;
            showAuthForm('reset-password-form');
            showToast('Password reset code generated. Check console output.');
        }
    } else {
        showToast(data.message, true);
    }
});

$('#reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('#reset-password').value;
    const confirmPassword = $('#reset-password-confirm').value;
    if (password !== confirmPassword) {
        return showToast('Passwords do not match', true);
    }
    const data = await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
            email: $('#reset-email').value,
            token: $('#reset-token').value,
            password
        })
    });
    if (data.success) {
        showToast(data.message);
        showAuthForm('login-form');
    } else {
        showToast(data.message, true);
    }
});

$('#show-register').onclick = (e) => { e.preventDefault(); showAuthForm('register-form'); };
$('#show-login').onclick = (e) => { e.preventDefault(); showAuthForm('login-form'); };
$('#show-forgot-password').onclick = (e) => { e.preventDefault(); showAuthForm('forgot-password-form'); };
$('#show-login-from-forgot').onclick = (e) => { e.preventDefault(); showAuthForm('login-form'); };
$('#show-login-from-reset').onclick = (e) => { e.preventDefault(); showAuthForm('login-form'); };

function showAuthForm(formId) {
    ['login-form', 'register-form', 'forgot-password-form', 'reset-password-form'].forEach(id => {
        const form = $(`#${id}`);
        if (form) form.classList.toggle('active', id === formId);
    });
}

function enterChatScreen() {
    authScreen.classList.remove('active');
    chatScreen.classList.add('active');
    $('#my-username').textContent = currentUser.username;
    setMyAvatar();
    connectSocket();
    loadConversations();
}

// ─── SIDEBAR BUTTONS ────────────────────────────
$('#new-chat-btn').onclick = async () => {
    const data = await api('/api/auth/users');
    if (data.success) {
        const contactsList = $('#contacts-list');
        contactsList.innerHTML = data.users.map(u => `
            <div class="contact-item" onclick="openChat(${u.id}, '${u.username.replace(/'/g, "\\'")}', '${(u.avatar||'').replace(/'/g, "\\'")}')">
                ${avatarHTML(u.id, u.username, u.avatar, 'avatar-md', true)}
                <div class="contact-info"><span class="contact-name">${u.username}</span><span class="contact-about">${u.about || 'Hey there! I am using WhatsApp.'}</span></div>
            </div>`).join('');
        $('#contacts-panel').classList.add('open');
    }
};
$('#close-contacts').onclick = () => $('#contacts-panel').classList.remove('open');

$('#logout-btn').onclick = () => {
    localStorage.removeItem('token');
    token = null; currentUser = null;
    if (socket) socket.disconnect();
    chatScreen.classList.remove('active');
    authScreen.classList.add('active');
    showToast('Logged out');
};

$('#back-btn').onclick = () => {
    $('#active-chat').style.display = 'none';
    $('#default-chat-view').style.display = 'flex';
    activeChat = null;
    $('.app-container').classList.remove('chat-active');
};

// ─── PROFILE PANEL ──────────────────────────────
$('#open-profile-btn').onclick = () => {
    const panel = $('#profile-panel');
    $('#profile-name-input').value = currentUser.username;
    $('#profile-about-input').value = currentUser.about || '';
    $('#profile-email-display').value = currentUser.email || '';
    const avatarEl = $('#profile-avatar-display');
    const hasImg = currentUser.avatar && currentUser.avatar !== 'default.png';
    avatarEl.className = `profile-avatar ${getAvatarColor(currentUser.id)} ${hasImg ? 'has-image' : ''}`;
    if (hasImg) {
        let img = avatarEl.querySelector('img');
        if (!img) { img = document.createElement('img'); avatarEl.prepend(img); }
        img.src = `/uploads/avatars/${currentUser.avatar}`;
        $('#remove-avatar-btn').style.display = 'block';
    } else {
        const img = avatarEl.querySelector('img');
        if (img) img.remove();
        $('#remove-avatar-btn').style.display = 'none';
    }
    $('#profile-avatar-letter').textContent = getAvatarLetter(currentUser.username);
    panel.classList.add('open');
};
$('#close-profile').onclick = () => $('#profile-panel').classList.remove('open');

$('#avatar-upload-trigger').onclick = () => $('#avatar-file-input').click();
$('#avatar-file-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    const data = await fetch('/api/auth/avatar', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }).then(r => r.json());
    if (data.success) {
        currentUser.avatar = data.avatar;
        setMyAvatar();
        $('#open-profile-btn').click(); // refresh profile panel
        showToast('Avatar updated!');
    } else showToast(data.message || 'Upload failed', true);
    e.target.value = '';
};

$('#remove-avatar-btn').onclick = async () => {
    const data = await api('/api/auth/avatar', { method: 'DELETE' });
    if (data.success) {
        currentUser.avatar = null;
        setMyAvatar();
        $('#open-profile-btn').click();
        showToast('Avatar removed');
    }
};

$('#save-name-btn').onclick = async () => {
    const newName = $('#profile-name-input').value.trim();
    if (!newName) return showToast('Name cannot be empty', true);
    const data = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ username: newName }) });
    if (data.success) {
        currentUser.username = newName;
        $('#my-username').textContent = newName;
        setMyAvatar();
        showToast('Name updated!');
    } else showToast(data.message || 'Failed', true);
};

$('#save-about-btn').onclick = async () => {
    const about = $('#profile-about-input').value.trim();
    const data = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ about }) });
    if (data.success) {
        currentUser.about = about;
        showToast('About updated!');
    } else showToast(data.message || 'Failed', true);
};

function setMyAvatar() {
    const el = $('#my-avatar');
    const hasImg = currentUser.avatar && currentUser.avatar !== 'default.png';
    el.innerHTML = hasImg ? `<img src="/uploads/avatars/${currentUser.avatar}">` : `<span>${getAvatarLetter(currentUser.username)}</span>`;
    el.className = `avatar avatar-sm ${getAvatarColor(currentUser.id)} ${hasImg ? 'has-image' : ''}`;
}

function updateMessageStatus(messageId, status) {
    const el = $(`#msg-${messageId}`);
    if (el) {
        const meta = el.querySelector('.message-meta');
        if (meta) {
            const statusEl = meta.querySelector('.message-status');
            if (statusEl) {
                statusEl.outerHTML = getStatusIcon(status);
            } else {
                meta.insertAdjacentHTML('beforeend', getStatusIcon(status));
            }
        }
    }
}

function updateAllOutgoingToSeen() {
    const messages = $$('.message-outgoing');
    messages.forEach(el => {
        const meta = el.querySelector('.message-meta');
        if (meta) {
            const statusEl = meta.querySelector('.message-status');
            if (statusEl) {
                statusEl.outerHTML = getStatusIcon('seen');
            }
        }
    });
}

// ─── SOCKET & CHAT ──────────────────────────────
function connectSocket() {
    socket = io({ auth: { token } });
    socket.on('users:online', (ids) => { onlineUsers = new Set(ids); renderConversations(conversations); });
    socket.on('message:receive', (msg) => {
        if (activeChat && activeChat.id === msg.sender_id) {
            appendMessage(msg, false); scrollToBottom();
            socket.emit('message:seen', { senderId: msg.sender_id });
        }
        loadConversations();
    });
    socket.on('message:sent', (msg) => { if (activeChat && activeChat.id === msg.receiver_id) { appendMessage(msg, true); scrollToBottom(); } loadConversations(); });
    
    // Status updates
    socket.on('message:status', (data) => {
        const { messageId, status } = data;
        updateMessageStatus(messageId, status);
        loadConversations();
    });
    socket.on('message:status_bulk', (data) => {
        const { receiverId, status } = data;
        if (activeChat && activeChat.id === receiverId) {
            const messages = $$('.message-outgoing');
            messages.forEach(el => {
                const meta = el.querySelector('.message-meta');
                if (meta) {
                    const statusEl = meta.querySelector('.message-status');
                    if (statusEl && !statusEl.classList.contains('status-seen')) {
                        statusEl.outerHTML = getStatusIcon(status);
                    }
                }
            });
        }
        loadConversations();
    });
    socket.on('message:seen', (data) => {
        const { seenBy } = data;
        if (activeChat && activeChat.id === seenBy) {
            updateAllOutgoingToSeen();
        }
        loadConversations();
    });
    
    socket.on('message:delete', (data) => {
        const { messageId, type } = data;
        if (type === 'everyone') {
            const el = $(`#msg-${messageId}`);
            if (el) {
                el.className = `message ${el.classList.contains('message-outgoing') ? 'message-outgoing' : 'message-incoming'} message-deleted`;
                const contentEl = el.querySelector('.message-content');
                if (contentEl) {
                    contentEl.style.cssText = 'color: var(--text-tertiary); font-style: italic;';
                    contentEl.innerHTML = '🚫 This message was deleted';
                }
                const quoteEl = el.querySelector('.reply-quote');
                if (quoteEl) quoteEl.remove();
                const dropdownEl = el.querySelector('.message-dropdown');
                if (dropdownEl) dropdownEl.remove();
                const statusEl = el.querySelector('.message-status');
                if (statusEl) statusEl.remove();
            }
            loadConversations();
        }
    });

    // Call Signaling
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', () => { showToast('Call declined'); endCallUI(); });
    socket.on('call:ended', () => { showToast('Call ended'); endCallUI(); });
    socket.on('call:unavailable', (data) => { showToast(data.message, true); endCallUI(); });
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
}

async function loadConversations() {
    const data = await api('/api/messages');
    if (data.success) { conversations = data.conversations; renderConversations(conversations); }
}

function renderConversations(convos) {
    if (convos.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <p>${searchInput.value.trim() ? 'No results found' : 'No conversations yet'}</p>
            </div>`;
        return;
    }
    chatList.innerHTML = convos.map(c => `
        <div class="chat-item ${activeChat?.id === c.id ? 'active' : ''}" data-user-id="${c.id}" onclick="openChat(${c.id}, '${c.username.replace(/'/g, "\\'")}', '${(c.avatar||'').replace(/'/g, "\\'")}')">
            ${avatarHTML(c.id, c.username, c.avatar, 'avatar-md', true)}
            <div class="chat-item-content">
                <div class="chat-item-top">
                    <span class="chat-item-name">${c.username}</span>
                    <span class="chat-item-time">${formatTime(c.last_message_time)}</span>
                </div>
                <div class="chat-item-bottom">
                    <span class="chat-item-preview">${c.last_message_is_deleted ? '🚫 This message was deleted' : (c.last_message_type === 'audio' ? '🎤 Voice Note' : (c.last_message_type === 'image' ? '🖼️ Image' : (c.last_message_type === 'document' ? '📄 Document' : escapeHtml(c.last_message))))}</span>
                    ${c.unread_count > 0 ? `<span class="unread-badge">${c.unread_count}</span>` : ''}
                </div>
            </div>
        </div>`).join('');
}

window.openChat = async function(userId, username, avatar) {
    activeChat = { id: userId, username, avatar };
    $('#active-chat').style.display = 'flex';
    $('#default-chat-view').style.display = 'none';
    $('#contacts-panel').classList.remove('open');
    $('#chat-username').textContent = username;
    $('.app-container').classList.add('chat-active');

    // Set chat header avatar
    const chatAv = $('#chat-avatar');
    const hasImg = avatar && avatar !== 'default.png' && avatar !== 'null' && avatar !== 'undefined';
    chatAv.className = `avatar avatar-sm ${getAvatarColor(userId)} ${hasImg ? 'has-image' : ''}`;
    if (hasImg) {
        let img = chatAv.querySelector('img');
        if (!img) { img = document.createElement('img'); chatAv.prepend(img); }
        img.src = `/uploads/avatars/${avatar}`;
    } else { const img = chatAv.querySelector('img'); if (img) img.remove(); }
    $('#chat-avatar-letter').textContent = getAvatarLetter(username);

    const data = await api(`/api/messages/${userId}`);
    if (data.success) { renderMessages(data.messages); scrollToBottom(); socket.emit('message:seen', { senderId: userId }); }
}

function renderMessages(msgs) {
    messagesList.innerHTML = msgs.map(m => createMessageHTML(m, m.sender_id === currentUser.id)).join('');
}

function createMessageHTML(m, out) {
    if (m.is_deleted) {
        return `<div class="message ${out ? 'message-outgoing' : 'message-incoming'} message-deleted" id="msg-${m.id}">
            <div class="message-content" style="color: var(--text-tertiary); font-style: italic;">
                🚫 This message was deleted
            </div>
            <div class="message-meta">
                <span class="message-time">${formatTime(m.created_at)}</span>
            </div>
        </div>`;
    }

    const replyHTML = m.reply ? `
        <div class="reply-quote" onclick="scrollToMessage(${m.reply_to_id})">
            <span class="reply-quote-name">${escapeHtml(m.reply.sender_name)}</span>
            <span class="reply-quote-text">${m.reply.is_deleted ? '🚫 This message was deleted' : escapeHtml(m.reply.content)}</span>
        </div>` : '';
    
    const senderName = m.sender_name || (out ? currentUser.username : activeChat.username);
    const safeName = senderName.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const safeContent = m.message_type === 'text' ? m.content.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ") : 'Attachment';

    let contentHTML = escapeHtml(m.content);
    if (m.message_type === 'image') {
        contentHTML = `<div class="message-image"><img src="/uploads/attachments/${m.content}" alt="Image"></div>`;
    } else if (m.message_type === 'audio') {
        contentHTML = `<div class="message-audio"><audio src="/uploads/attachments/${m.content}" controls></audio></div>`;
    } else if (m.message_type === 'document') {
        contentHTML = `<a href="/uploads/attachments/${m.content}" target="_blank" class="message-doc">
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <div class="message-doc-info"><span class="message-doc-name">Document</span><span class="message-doc-meta">Click to download</span></div>
        </a>`;
    }

    const dropdownHTML = `
        <div class="message-dropdown">
            <button class="msg-dropdown-trigger" onclick="toggleMessageMenu(event, ${m.id})">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2.9 2-2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="msg-dropdown-menu" id="msg-menu-${m.id}" style="display:none;">
                <button onclick="triggerReply(${m.id}, '${safeName}', '${safeContent}')">Reply</button>
                <button onclick="triggerDeleteMe(${m.id})">Delete for Me</button>
                ${out ? `<button onclick="triggerDeleteEveryone(${m.id})">Delete for Everyone</button>` : ''}
            </div>
        </div>`;

    return `<div class="message ${out ? 'message-outgoing' : 'message-incoming'}" id="msg-${m.id}">
        ${dropdownHTML}
        ${replyHTML}
        <div class="message-content">${contentHTML}</div>
        <div class="message-meta"><span class="message-time">${formatTime(m.created_at)}</span>${out ? getStatusIcon(m.status) : ''}</div>
    </div>`;
}

function appendMessage(m, out) { messagesList.insertAdjacentHTML('beforeend', createMessageHTML(m, out)); }

function scrollToBottom() { const c = $('#messages-container'); c.scrollTop = c.scrollHeight; }

// ─── REPLY LOGIC ────────────────────────────────
window.setReply = (id, name, text) => {
    replyToMessage = { id, name, text };
    $('#reply-preview-name').textContent = name;
    $('#reply-preview-text').textContent = text;
    replyPreview.style.display = 'flex';
    messageInput.focus();
};

$('#cancel-reply').onclick = () => { replyToMessage = null; replyPreview.style.display = 'none'; };

$('#send-btn').onclick = () => {
    const content = messageInput.value.trim();
    if (!content || !activeChat) return;
    socket.emit('message:send', { receiverId: activeChat.id, content, replyToId: replyToMessage?.id });
    messageInput.value = '';
    replyToMessage = null;
    replyPreview.style.display = 'none';
};

messageInput.addEventListener('input', (e) => {
    const text = e.target.value.trim();
    $('#send-btn').style.display = text ? 'block' : 'none';
    $('#mic-btn').style.display = text ? 'none' : 'block';
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        $('#send-btn').click();
    }
});

// ─── ATTACHMENTS & VOICE ────────────────────────
const attachBtn = $('#attach-btn');
const attachMenu = $('#attach-menu');
attachBtn.onclick = () => attachMenu.style.display = attachMenu.style.display === 'none' ? 'flex' : 'none';
document.addEventListener('click', (e) => { if (!e.target.closest('.attach-container')) attachMenu.style.display = 'none'; });

$('#attach-image').onclick = () => { $('#image-upload').click(); attachMenu.style.display = 'none'; };
$('#attach-doc').onclick = () => { $('#doc-upload').click(); attachMenu.style.display = 'none'; };

async function handleFileUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const data = await fetch('/api/messages/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }).then(r=>r.json());
    if (data.success && activeChat) {
        socket.emit('message:send', { receiverId: activeChat.id, content: data.filename, messageType: type, replyToId: replyToMessage?.id });
        replyToMessage = null; replyPreview.style.display = 'none';
    } else showToast(data.message || 'Upload failed', true);
    e.target.value = '';
}
$('#image-upload').onchange = (e) => handleFileUpload(e, 'image');
$('#doc-upload').onchange = (e) => handleFileUpload(e, 'document');

let mediaRecorder;
let audioChunks = [];
const micBtn = $('#mic-btn');

micBtn.onmousedown = startRecording;
micBtn.onmouseup = stopRecording;
micBtn.onmouseleave = stopRecording;
micBtn.ontouchstart = (e) => { e.preventDefault(); startRecording(); };
micBtn.ontouchend = (e) => { e.preventDefault(); stopRecording(); };

async function startRecording() {
    if (!activeChat) return showToast('Open a chat to record audio');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            if (audioChunks.length === 0) return;
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const fd = new FormData();
            fd.append('file', audioBlob, 'voicenote.webm');
            const data = await fetch('/api/messages/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }).then(r=>r.json());
            if (data.success && activeChat) {
                socket.emit('message:send', { receiverId: activeChat.id, content: data.filename, messageType: 'audio', replyToId: replyToMessage?.id });
                replyToMessage = null; replyPreview.style.display = 'none';
            }
        };
        mediaRecorder.start();
        micBtn.classList.add('recording');
    } catch (err) { showToast('Microphone access denied', true); }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        micBtn.classList.remove('recording');
    }
}

// ─── CALLING LOGIC (WebRTC) ─────────────────────
$('#audio-call-btn').onclick = () => startCall('audio');
$('#video-call-btn').onclick = () => startCall('video');

async function startCall(type) {
    callType = type;
    $('#call-overlay').style.display = 'flex';
    $('#call-name').textContent = activeChat.username;
    $('#call-state').textContent = 'Ringing...';
    socket.emit('call:initiate', { receiverId: activeChat.id, callType: type });
}

async function handleIncomingCall({ caller, callType: type }) {
    callType = type;
    incomingCallModal.style.display = 'flex';
    $('#incoming-name').textContent = caller.username;
    $('#incoming-type').textContent = `Incoming ${type} call...`;
    
    $('#accept-call-btn').onclick = async () => {
        incomingCallModal.style.display = 'none';
        $('#call-overlay').style.display = 'flex';
        $('#call-name').textContent = caller.username;
        socket.emit('call:accept', { callerId: caller.id });
        setupWebRTC(caller.id);
    };
    
    $('#reject-call-btn').onclick = () => {
        incomingCallModal.style.display = 'none';
        socket.emit('call:reject', { callerId: caller.id });
    };
}

async function handleCallAccepted({ userId }) {
    $('#call-state').textContent = 'Connecting...';
    setupWebRTC(userId, true);
}

async function setupWebRTC(targetUserId, isCaller = false) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
        if (callType === 'video') {
            $('#video-container').style.display = 'block';
            $('#local-video').srcObject = localStream;
        }

        peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            const remoteAudio = $('#remote-audio');
            if (remoteAudio && !remoteAudio.srcObject) {
                remoteAudio.srcObject = event.streams[0];
                remoteAudio.play().catch(err => console.warn('Audio play autoplay warning:', err));
            }
            if (!$('#remote-video').srcObject) {
                $('#remote-video').srcObject = event.streams[0];
                $('#remote-video').play().catch(err => console.warn('Video play autoplay warning:', err));
                startTimer();
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit('webrtc:ice-candidate', { to: targetUserId, candidate: event.candidate });
        };

        if (isCaller) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc:offer', { to: targetUserId, offer });
        }
    } catch (err) {
        console.error('Camera/Mic Error:', err);
        showToast('Could not access Camera or Microphone. Please check permissions.', true);
        socket.emit('call:end', { userId: targetUserId });
        endCallUI();
    }
}

async function handleOffer({ offer, from }) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('webrtc:answer', { to: from, answer });
}

async function handleAnswer({ answer }) { await peerConnection.setRemoteDescription(new RTCSessionDescription(answer)); }
async function handleIceCandidate({ candidate }) { if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }

function startTimer() {
    $('#call-state').style.display = 'none';
    const timerEl = $('#call-timer');
    timerEl.style.display = 'block';
    let sec = 0;
    callTimerInterval = setInterval(() => {
        sec++;
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

function endCallUI() {
    $('#call-overlay').style.display = 'none';
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    localStream = null;
    peerConnection = null;

    // Reset media elements
    const remoteVideo = $('#remote-video');
    const localVideo = $('#local-video');
    const remoteAudio = $('#remote-audio');
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localVideo) localVideo.srcObject = null;
    if (remoteAudio) remoteAudio.srcObject = null;

    clearInterval(callTimerInterval);
    $('#call-timer').textContent = '00:00';
    $('#video-container').style.display = 'none';
}

$('#end-call-btn').onclick = () => {
    socket.emit('call:end', { userId: activeChat?.id });
    endCallUI();
};

// Check existing session
(async () => {
    const t = localStorage.getItem('token');
    if (t) { token = t; const d = await api('/api/auth/me'); if (d.success) { currentUser = d.user; enterChatScreen(); } }
})();

// ─── SEARCH FILTER ──────────────────────────────
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        renderConversations(conversations);
        return;
    }
    const filtered = conversations.filter(c => 
        c.username.toLowerCase().includes(query) || 
        (c.last_message && c.last_message.toLowerCase().includes(query))
    );
    renderConversations(filtered);
});

// ─── MESSAGE MENU & DELETION ─────────────────────
window.toggleMessageMenu = (event, id) => {
    event.stopPropagation();
    $$('.msg-dropdown-menu').forEach(el => {
        if (el.id !== `msg-menu-${id}`) el.style.display = 'none';
    });
    const menu = $(`#msg-menu-${id}`);
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.message-dropdown')) {
        $$('.msg-dropdown-menu').forEach(el => el.style.display = 'none');
    }
});

window.triggerReply = (id, name, content) => {
    window.setReply(id, name, content);
    const menu = $(`#msg-menu-${id}`);
    if (menu) menu.style.display = 'none';
};

window.triggerDeleteMe = async (id) => {
    if (confirm('Delete this message for me?')) {
        const res = await api(`/api/messages/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ type: 'me' })
        });
        if (res.success) {
            const el = $(`#msg-${id}`);
            if (el) el.remove();
            loadConversations();
        } else {
            showToast(res.message || 'Failed to delete message', true);
        }
    }
};

window.triggerDeleteEveryone = async (id) => {
    if (confirm('Delete this message for everyone?')) {
        const res = await api(`/api/messages/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ type: 'everyone' })
        });
        if (!res.success) {
            showToast(res.message || 'Failed to delete message', true);
        }
    }
};
