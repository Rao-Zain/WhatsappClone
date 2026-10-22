import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, Send, X } from "lucide-react";

const MAX_TARGETS = 5;

export default function ForwardModal({ chats, isForwarding, error, onClose, onForward }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isForwarding) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isForwarding]);

  const visibleChats = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return chats;

    return chats.filter((chat) => (chat.name || "").toLowerCase().includes(text));
  }, [chats, query]);

  function toggle(id) {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id);
      if (previous.length >= MAX_TARGETS) return previous;
      return [...previous, id];
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={() => !isForwarding && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Forward message to"
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-[var(--wa-modal-bg)]"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-label="Close"
            disabled={isForwarding}
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
          >
            <X size={20} />
          </button>
          <h2 className="text-[17px] text-[color:var(--wa-text-primary)]">Forward message to</h2>
        </div>

        <div className="px-4 pb-2">
          <label className="flex h-[38px] items-center gap-3.5 rounded-full border border-transparent bg-[var(--wa-search-bg)] pl-[18px] pr-3 focus-within:border-[color:var(--wa-search-border-focus)] focus-within:bg-[var(--wa-search-bg-focus)]">
            <Search size={17} className="text-[color:var(--wa-search-icon)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search chats"
              className="w-full bg-transparent text-sm text-[color:var(--wa-search-text)] outline-none placeholder:text-[color:var(--wa-search-placeholder)]"
            />
          </label>
        </div>

        <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
          {visibleChats.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">No chats found</p>
          ) : (
            visibleChats.map((chat) => {
              const isSelected = selected.includes(chat.id);
              const isLimitReached = !isSelected && selected.length >= MAX_TARGETS;

              return (
                <button
                  key={chat.id}
                  type="button"
                  disabled={isLimitReached}
                  onClick={() => toggle(chat.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--wa-row-hover)] disabled:opacity-40"
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded border ${
                      isSelected
                        ? "border-[color:var(--wa-accent)] bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)]"
                        : "border-[color:var(--wa-chip-border)]"
                    }`}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </span>

                  {chat.avatar ? (
                    <img src={chat.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]">
                      {(chat.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}

                  <span className="truncate text-[15px] text-[color:var(--wa-text-primary)]">{chat.name}</span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <p role="alert" className="px-4 py-2 text-sm text-[color:var(--wa-danger)]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between bg-[var(--wa-modal-footer-bg)] px-4 py-3">
          <span className="text-sm text-[color:var(--wa-icon)]">
            {selected.length === 0 ? `Select up to ${MAX_TARGETS} chats` : `${selected.length} selected`}
          </span>

          <button
            type="button"
            aria-label="Forward"
            disabled={selected.length === 0 || isForwarding}
            onClick={() => onForward(selected)}
            className="grid size-11 place-items-center rounded-full bg-[var(--wa-send-bg)] text-[color:var(--wa-send-fg)] hover:bg-[var(--wa-send-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}