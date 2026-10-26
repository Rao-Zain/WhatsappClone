import { Check, CheckCheck, FileText, Image as ImageIcon, Mic, Pin, Video } from "lucide-react";
import PresenceStatus from "../chat/PresenceStatus";

const initialsOf = (name = "") =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

// Helper to extract preview text and icon dynamically
function getMessagePreview(chat) {
  const lastMsg = chat.lastMessage || chat;
  const text = lastMsg.text || chat.message;
  const attachments = lastMsg.attachments || chat.attachments || [];
  const type = lastMsg.type || chat.type;

  // Voice / Audio Note
  if (type === "voice" || type === "audio" || attachments.some((a) => a.mimeType?.startsWith("audio/"))) {
    return {
      icon: <Mic size={16} className="shrink-0 text-[color:var(--wa-voice-icon)]" />,
      text: "Voice message",
    };
  }

  // Visual Attachments (Image/Video) or Documents
  if (attachments.length > 0) {
    const first = attachments[0];
    const mime = first.mimeType || "";

    if (mime.startsWith("image/")) {
      return {
        icon: <ImageIcon size={16} className="shrink-0 text-[color:var(--wa-preview-icon)]" />,
        text: text?.trim() || (attachments.length > 1 ? `${attachments.length} Photos` : "Photo"),
      };
    }

    if (mime.startsWith("video/")) {
      return {
        icon: <Video size={17} className="shrink-0 text-[color:var(--wa-preview-icon)]" />,
        text: text?.trim() || (attachments.length > 1 ? `${attachments.length} Videos` : "Video"),
      };
    }

    return {
      icon: <FileText size={16} className="shrink-0 text-[color:var(--wa-preview-icon)]" />,
      text: text?.trim() || first.originalName || "Document",
    };
  }

  // Plain Text
  if (text && text.trim()) {
    return {
      icon: null,
      text,
    };
  }

  return {
    icon: null,
    text: "No messages yet",
  };
}

export default function ChatItem({ chat, active, onClick }) {
  const unread = chat.unread ?? chat.unreadCount ?? 0;
  const hasUnread = unread > 0;
  const preview = getMessagePreview(chat);

  const status = chat.lastMessage?.status || chat.status;
  const isMe = chat.lastMessage?.sender === "me" || chat.sent || chat.isMe;

  return (
    <div className="shrink-0 sm:px-2.5">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-[72px] w-full items-center gap-3.5 px-4 text-left transition-colors sm:h-[76px] sm:rounded-xl sm:px-3 ${
          active ? "bg-[var(--wa-row-active)]" : "hover:bg-[var(--wa-row-hover)]"
        }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {chat.avatar ? (
            <img src={chat.avatar} alt="" className="size-[49px] rounded-full object-cover" />
          ) : (
            <span className="grid size-[49px] select-none place-items-center rounded-full bg-[var(--wa-avatar-bg)] text-[18px] font-medium text-[color:var(--wa-avatar-fg)]">
              {initialsOf(chat.name)}
            </span>
          )}

          {chat.type === "personal" && chat.userId && (
            <PresenceStatus
              userId={chat.userId}
              fallback={{ isOnline: chat.isOnline, lastSeen: chat.lastSeen }}
              variant="dot"
              className="absolute bottom-0 right-0"
            />
          )}
        </div>

        {/* Text */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[5px]">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-[17px] leading-[21px] text-[color:var(--wa-text-primary)]">
              {chat.name}
            </span>
            <span
              className={`shrink-0 text-[12px] leading-[21px] ${
                hasUnread
                  ? "font-medium text-[color:var(--wa-time-unread)]"
                  : "text-[color:var(--wa-time)]"
              }`}
            >
              {chat.time}
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">

              {chat.typingText ? (
                <span className="truncate text-[14px] leading-5 text-[color:var(--wa-accent)]">
                  {chat.typingText}
                </span>
              ) : (
                <>

              {/* Status Ticks in Sidebar */}
              {isMe && (
                status === "read" ? (
                  <CheckCheck size={16} strokeWidth={2.2} className="shrink-0 text-[#53bdeb]" />
                ) : status === "delivered" ? (
                  <CheckCheck size={16} strokeWidth={2} className="shrink-0 text-[color:var(--wa-tick-sent)]" />
                ) : (
                  <Check size={16} strokeWidth={2} className="shrink-0 text-[color:var(--wa-tick-sent)]" />
                )
              )}

              {/* Dynamic Media Icon */}
              {preview.icon}

              {/* Dynamic Preview Text */}
              <span className="truncate text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
                {preview.text}
              </span>

                </>
              )}

            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {chat.pinned && <Pin size={18} className="text-[color:var(--wa-preview-icon)]" />}
              {hasUnread && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--wa-badge-bg)] px-1.5 text-[12px] font-medium leading-none text-[color:var(--wa-badge-fg)]">
                  {unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}