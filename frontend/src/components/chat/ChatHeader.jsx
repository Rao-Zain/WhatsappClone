import { ArrowLeft, MoreVertical, Phone, Search, Video } from "lucide-react";
import PresenceStatus from "./PresenceStatus";

const initialsOf = (name = "") =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

export default function ChatHeader({ chat, onBack, onOpenInfo, onStartCall  }) {
  const showPresence = chat.type === "personal" && chat.userId;

  const iconBtn =
    "grid size-11 shrink-0 place-items-center rounded-full text-[color:var(--wa-chat-header-icon)] transition-colors hover:bg-[var(--wa-hover)] active:bg-[var(--wa-pressed)]";

  return (
    <header className="relative z-10 flex h-[65px] w-full shrink-0 select-none items-center justify-between border-b border-[color:var(--wa-chat-header-border)] bg-[var(--wa-chat-header-bg)] pl-1 pr-2 sm:px-4">
      {/* Left: back (phone), avatar, name, presence */}
      <div className="flex min-w-0 flex-1 items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chat list"
            className={`${iconBtn} size-10 sm:hidden`}
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={onOpenInfo}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onOpenInfo?.();
          }}
          className="flex min-w-0 cursor-pointer items-center gap-4 py-1 pl-1 pr-2 outline-none sm:pl-0"
        >
          {chat.avatar ? (
            <img src={chat.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[15px] font-medium text-[color:var(--wa-avatar-neutral-fg)]">
              {initialsOf(chat.name)}
            </span>
          )}

          <div className="flex min-w-0 flex-col justify-center text-left">
            <h2 className="truncate text-[16px] font-normal leading-[21px] text-[color:var(--wa-chat-title)]">
              {chat.name}
            </h2>

            <div className="truncate text-[13px] leading-[17px]">
              {showPresence ? (
                <PresenceStatus
                  userId={chat.userId}
                  fallback={{ isOnline: chat.isOnline, lastSeen: chat.lastSeen }}
                  className="block text-[color:var(--wa-chat-subtitle)]"
                />
              ) : (
                chat.type === "group" && (
                  <span className="text-[color:var(--wa-chat-subtitle)]">click here for group info</span>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: plain icons, 44px targets, 12px apart (like WhatsApp Web) */}
      <div className="flex shrink-0 items-center sm:gap-3">
       <button
  type="button"
  aria-label="Video call"
  title="Video call"
  className={iconBtn}
  disabled={!onStartCall}
  onClick={() => onStartCall?.(chat.id, "video")}
>
  <Video size={22} strokeWidth={2.1} />
</button>
<button
  type="button"
  aria-label="Voice call"
  title="Voice call"
  className={iconBtn}
  disabled={!onStartCall}
  onClick={() => onStartCall?.(chat.id, "audio")}
>
  <Phone size={21} strokeWidth={2.1} />
</button>
        <button type="button" aria-label="Search inside chat" title="Search" className={`${iconBtn} hidden sm:grid`}>
          <Search size={21} strokeWidth={2.2} />
        </button>
        <button type="button" aria-label="More options" title="Menu" className={iconBtn}>
          <MoreVertical size={22} />
        </button>
      </div>
    </header>
  );
}