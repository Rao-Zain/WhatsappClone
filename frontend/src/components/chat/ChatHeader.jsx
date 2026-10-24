import { useEffect, useState } from "react";
import { ArrowLeft, Ban, MoreVertical, Phone, Search, ShieldCheck, Video } from "lucide-react";
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

export default function ChatHeader({
  chat,
  onBack,
  onOpenInfo,
  onOpenSearch,
  searchActive = false,
  onStartCall,
  onBlock,
  onUnblock,
}) {
  // The menu remembers WHICH chat it was opened for, so switching chats closes it
  // without needing an effect.
  const [menuChatId, setMenuChatId] = useState(null);
  const menuOpen = menuChatId === chat.id;
  const setMenuOpen = (open) => setMenuChatId(open ? chat.id : null);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (event) => event.key === "Escape" && setMenuChatId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const isPrivate = chat.type === "personal" && Boolean(chat.userId);
  const callsBlocked = chat.blockedByMe || chat.blockedByOther;
  // Don't tell a blocked person anything extra: no presence for either side of a block.
  const showPresence = isPrivate && !callsBlocked;

  const menuItem =
    "flex h-10 w-full items-center gap-4 px-5 text-left text-[15px] text-[color:var(--wa-menu-text)] outline-none transition-colors hover:bg-[var(--wa-menu-hover)] focus-visible:bg-[var(--wa-menu-hover)]";

  const iconBtn =
    "grid size-11 shrink-0 place-items-center rounded-full text-[color:var(--wa-chat-header-icon)] transition-colors hover:bg-[var(--wa-hover)] active:bg-[var(--wa-pressed)]";

  return (
    <header className="relative z-30 flex h-[65px] w-full shrink-0 select-none items-center justify-between border-b border-[color:var(--wa-chat-header-border)] bg-[var(--wa-chat-header-bg)] pl-1 pr-2 sm:px-4">
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
                 <span className="text-[color:var(--wa-chat-subtitle)]">{chat.memberNames || "group"}</span>
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
   disabled={!onStartCall || callsBlocked} 
  onClick={() => onStartCall?.(chat.id, "video")}
>
  <Video size={22} strokeWidth={2.1} />
</button>
<button
  type="button"
  aria-label="Voice call"
  title="Voice call"
  className={iconBtn}
    disabled={!onStartCall || callsBlocked}
  onClick={() => onStartCall?.(chat.id, "audio")}
>
  <Phone size={21} strokeWidth={2.1} />
</button>
               <button
          type="button"
          aria-label="Search inside chat"
          title="Search"
          aria-pressed={searchActive}
          disabled={!onOpenSearch}
          onClick={onOpenSearch}
          className={`${iconBtn} hidden sm:grid ${searchActive ? "bg-[var(--wa-hover)]" : ""}`}
        >
          <Search size={21} strokeWidth={2.2} />
        </button>
               <div className="relative">
          <button
            type="button"
            aria-label="More options"
            title="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className={iconBtn}
          >
            <MoreVertical size={22} />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="wa-shadow-menu absolute right-0 top-11 z-40 w-[200px] overflow-hidden rounded-xl bg-[var(--wa-menu-bg)] py-2"
              >
                {isPrivate ? (
                  chat.blockedByMe ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        onUnblock?.();
                      }}
                    >
                      <ShieldCheck size={18} className="text-[color:var(--wa-menu-icon)]" />
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        onBlock?.();
                      }}
                    >
                      <Ban size={18} className="text-[color:var(--wa-menu-icon)] cursor-pointer" />
                      Block
                    </button>
                  )
                ) : (
                  <p className="px-5 py-2 text-[14px] text-[color:var(--wa-text-secondary)]">
                    No options for groups yet.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}