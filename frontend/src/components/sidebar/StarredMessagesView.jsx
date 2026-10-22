import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, RefreshCw, Star } from "lucide-react";
import api from "../../../lib/api";
import { getPreviewLabel } from "../../../lib/messagePreview";
import PanelHeader from "./PanelHeader";
import PanelSearch from "./PanelSearch";

// GET -> { messages: [{ _id, text, type, attachments, createdAt, sender, conversation }] }
const STARRED_ENDPOINT = "/messages/starred";

function getCurrentUserId() {
  try {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    const user = stored ? JSON.parse(stored) : null;
    return user?._id || user?.id || null;
  } catch {
    return null;
  }
}

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";

const formatTime = (date) =>
  date ? new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

export default function StarredMessagesView({ chats = [], onBack, onOpenChat }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(STARRED_ENDPOINT);
      setMessages(response.data.messages || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load starred messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const conversationIdOf = (message) => String(message.conversation?._id || message.conversation);

  // Work out author / chat / preview text once, then filter on them.
  const items = useMemo(() => {
    const myId = getCurrentUserId();

    return messages.map((message) => {
      const conversationId = String(message.conversation?._id || message.conversation);
      const chat = chats.find((item) => String(item.id) === conversationId);
      const senderId = message.sender?._id || message.sender;
      const mine = Boolean(myId) && String(senderId) === String(myId);

      const author = mine
        ? "You"
        : message.sender?.name?.trim() || message.sender?.username || chat?.name || "Contact";

      const label = getPreviewLabel({
        text: message.text,
        type: message.type,
        fileName: message.attachments?.[0]?.originalName,
      });

      return { message, conversationId, chat, mine, author, label };
    });
  }, [messages, chats]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (!text) return items;

    return items.filter(({ label, author, chat }) =>
      [label, author, chat?.name].some((value) => (value || "").toLowerCase().includes(text))
    );
  }, [items, query]);

  async function handleUnstar(message) {
    setMessages((previous) => previous.filter((item) => item._id !== message._id));

    try {
      await api.post(`/conversations/${conversationIdOf(message)}/messages/${message._id}/star`);
    } catch {
      load(); // put it back if the server refused
    }
  }

  async function handleUnstarAll() {
    setMenuOpen(false);

    const current = messages;
    setMessages([]);

    await Promise.allSettled(
      current.map((message) =>
        api.post(`/conversations/${conversationIdOf(message)}/messages/${message._id}/star`)
      )
    );

    load(); // resync in case some requests failed
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="Starred messages" onBack={onBack}>
        <div className="relative">
          <button
            type="button"
            aria-label="Menu"
            title="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-full text-[color:var(--wa-header-icon)] transition-colors hover:bg-[var(--wa-hover)] active:bg-[var(--wa-pressed)]"
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
                <button
                  type="button"
                  role="menuitem"
                  disabled={messages.length === 0}
                  onClick={handleUnstarAll}
                  className="flex h-10 w-full items-center px-5 text-left text-[15px] text-[color:var(--wa-menu-text)] hover:bg-[var(--wa-menu-hover)] disabled:opacity-40"
                >
                  Unstar all
                </button>
              </div>
            </>
          )}
        </div>
      </PanelHeader>

      <PanelSearch
        value={query}
        onChange={setQuery}
        placeholder="Search"
        ariaLabel="Search starred messages"
        onEscape={onBack}
      />

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Loading starred messages...
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p role="alert" className="text-sm text-[color:var(--wa-danger)]">{error}</p>
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-[var(--wa-accent)] px-5 py-2 text-xs font-medium text-[color:var(--wa-accent-fg)] hover:bg-[var(--wa-accent-hover)]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <span className="mb-4 grid size-16 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]">
              <Star size={28} />
            </span>
            <p className="text-[17px] text-[color:var(--wa-text-primary)]">No starred messages</p>
            <p className="mt-2 max-w-[260px] text-[13.5px] leading-5 text-[color:var(--wa-text-secondary)]">
              Right-click a message, or use the arrow on it, and choose Star. It will show up here.
            </p>
          </div>
        )}

        {!loading && !error && messages.length > 0 && visible.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-[color:var(--wa-text-secondary)]">
            No starred messages found
          </p>
        )}

        {!loading &&
          visible.map(({ message, conversationId, chat, mine, author, label }) => (
            <div
              key={message._id}
              className="flex items-start border-b border-[color:var(--wa-border)] hover:bg-[var(--wa-row-hover)]"
            >
              <button
                type="button"
                onClick={() => onOpenChat(conversationId)}
                className="min-w-0 flex-1 px-4 py-3 text-left"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px] text-[color:var(--wa-text-secondary)]">
                  <span className="truncate">
                    <span className="text-[color:var(--wa-text-primary)]">{author}</span>
                    {chat && chat.name !== author && <span> · {chat.name}</span>}
                  </span>
                  <span className="shrink-0">{formatDate(message.createdAt)}</span>
                </div>

                <div
                  className={`wa-shadow-bubble inline-block max-w-full rounded-lg px-[9px] py-[6px] ${
                    mine ? "bg-[var(--wa-bubble-out-bg)]" : "bg-[var(--wa-bubble-in-bg)]"
                  }`}
                >
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-[color:var(--wa-bubble-text)]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-right text-[11px] leading-[14px] text-[color:var(--wa-bubble-meta)]">
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </button>

              <button
                type="button"
                aria-label="Remove star"
                title="Remove star"
                onClick={() => handleUnstar(message)}
                className="m-2 grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
              >
                <Star size={18} className="fill-current" />
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}