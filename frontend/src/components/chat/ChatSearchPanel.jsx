import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import api from "../../../lib/api";
import HighlightedText from "./HighlightedText";
import { makeSnippet } from "./searchUtils";

function formatDay(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Right-hand "Search messages" panel for ONE chat.
 * The text lives in ChatWindow (query / onQueryChange) so the matches can also
 * be highlighted inside the message bubbles.
 */
export default function ChatSearchPanel({
  chat,
  currentUserId,
  query,
  onQueryChange,
  onClose,
  onSelect,
}) {
  const me = String(currentUserId);
  const trimmed = query.trim();
  const key = `${chat.id}:${trimmed}`;

  // The last finished search, tagged with what it was for.
  const [found, setFound] = useState({ key: "", total: 0, messages: [], error: "" });
  const [activeId, setActiveId] = useState(null);

  const current = trimmed && found.key === key ? found : null;
  const searching = Boolean(trimmed) && !current;

  useEffect(() => {
    if (!trimmed) return undefined;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/conversations/${chat.id}/search`, {
          params: { q: trimmed },
        });

        if (!cancelled) {
          setFound({
            key,
            total: response.data.total || 0,
            messages: response.data.messages || [],
            error: "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setFound({
            key,
            total: 0,
            messages: [],
            error: err.response?.data?.message || "Unable to search messages.",
          });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, chat.id, key]);

  const messages = current?.messages || [];

  return (
    <aside className="relative z-40 flex h-full w-[380px] shrink-0 flex-col border-l border-[color:var(--wa-border)] bg-[var(--wa-sidebar-bg)] text-[color:var(--wa-text-primary)] max-[1100px]:absolute max-[1100px]:right-0 max-[1100px]:top-0 max-[1100px]:w-[min(380px,100%)] max-[1100px]:shadow-2xl">
      <header className="flex h-[65px] shrink-0 items-center gap-5 border-b border-[color:var(--wa-border)] px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="grid size-9 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
        >
          <X size={22} />
        </button>
        <h2 className="text-[17px] font-medium">Search messages</h2>
      </header>

      <div className="shrink-0 px-4 py-3">
        <label className="flex h-9 items-center gap-3 rounded-lg bg-[var(--wa-search-bg)] px-3">
          <Search size={16} className="shrink-0 text-[color:var(--wa-icon)]" />
          <input
            autoFocus
            value={query}
            maxLength={100}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && onClose()}
            placeholder="Search…"
            aria-label="Search messages"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-[color:var(--wa-text-secondary)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="text-[color:var(--wa-icon)]"
            >
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
        {!trimmed && (
          <p className="px-8 py-10 text-center text-[14px] text-[color:var(--wa-text-secondary)]">
            Search for messages in {chat.name}
          </p>
        )}

        {searching && (
          <p className="px-8 py-10 text-center text-[14px] text-[color:var(--wa-text-secondary)]">Searching…</p>
        )}

        {current?.error && (
          <p role="alert" className="px-8 py-10 text-center text-[14px] text-[color:var(--wa-danger)]">
            {current.error}
          </p>
        )}

        {current && !current.error && messages.length === 0 && (
          <p className="px-8 py-10 text-center text-[14px] text-[color:var(--wa-text-secondary)]">
            No messages found
          </p>
        )}

        {current && messages.length > 0 && (
          <p className="px-5 pb-1 text-[13px] text-[color:var(--wa-text-secondary)]">
            {current.total} {current.total === 1 ? "result" : "results"}
            {current.total > messages.length && ` · showing the ${messages.length} most recent`}
          </p>
        )}

        {messages.map((message) => {
          const id = String(message._id);
          const senderId = String(message.sender?._id || message.sender);
          const senderName =
            senderId === me ? "You" : message.sender?.name?.trim() || message.sender?.username || "";

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveId(id);
                onSelect(id);
              }}
              className={`block w-full border-b border-[color:var(--wa-border)] px-5 py-3 text-left transition-colors hover:bg-[var(--wa-row-hover)] ${
                activeId === id ? "bg-[var(--wa-row-active)]" : ""
              }`}
            >
              <span className="flex items-baseline justify-between gap-3 text-[13px] text-[color:var(--wa-text-secondary)]">
                <span className="truncate">{senderName}</span>
                <span className="shrink-0">{formatDay(message.createdAt)}</span>
              </span>
              <span className="mt-0.5 block truncate text-[14.5px]">
                <HighlightedText text={makeSnippet(message.text, trimmed)} query={trimmed} />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}