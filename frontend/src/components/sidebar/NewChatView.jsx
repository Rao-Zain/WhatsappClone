import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import api from "../../../lib/api";
import PanelHeader from "./PanelHeader";
import PanelSearch from "./PanelSearch";
import Avatar from "../chatRequests/Avatar";

const TABS = [
  { id: "phone", label: "Phone number" },
  { id: "pin", label: "Username + PIN" },
];

const primaryButton =
  "h-10 w-full rounded-full bg-[var(--wa-accent)] px-5 text-[15px] font-medium text-[color:var(--wa-accent-fg)] transition-colors hover:bg-[var(--wa-accent-hover)] disabled:opacity-50";

const fieldClass =
  "h-11 w-full rounded-lg border border-[color:var(--wa-border)] bg-transparent px-3 text-[15px] text-[color:var(--wa-text-primary)] outline-none placeholder:text-[color:var(--wa-text-secondary)] focus:border-[color:var(--wa-accent)]";

/* New chat: find someone by phone number, or by username + their secret PIN.
   Either way this only sends a REQUEST. Chatting starts once they accept. */
export default function NewChatView({ onBack, onOpenConversation }) {
  const [tab, setTab] = useState("phone");

  // Phone tab
  const [phone, setPhone] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [picked, setPicked] = useState(null);

  // Username + PIN tab
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  // Sending
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentTo, setSentTo] = useState(null);

  function resetFeedback() {
    setSendError("");
    setSentTo(null);
  }

  useEffect(() => {
    const value = phone.trim();

    setUsers([]);
    setSearchError("");
    setPicked(null);

    if (value.replace(/\D/g, "").length < 7) {
      setSearching(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.get("/conversations/search-users", { params: { phone: value } });
        if (!cancelled) setUsers(response.data.users || []);
      } catch (err) {
        if (!cancelled) setSearchError(err.response?.data?.message || "Unable to search users.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  const searched = phone.trim().replace(/\D/g, "").length >= 7;

  async function sendRequest(payload) {
    if (sending) return;

    try {
      setSending(true);
      setSendError("");
      setSentTo(null);

      const response = await api.post("/chat-requests", payload);

      if (response.data.status === "connected") {
        // Already friends (or they had asked you first): open the chat.
        onOpenConversation?.(response.data.conversation);
        return;
      }

      setSentTo(response.data.request?.user || {});
      setPin("");
    } catch (err) {
      setSendError(err.response?.data?.message || "Unable to send the request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const pinValid = /^\d{4}$/.test(pin);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="New chat" onBack={onBack} />

      <div role="tablist" className="flex shrink-0 gap-2 px-4 pb-3 sm:px-5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id);
              resetFeedback();
            }}
            className={`h-9 flex-1 rounded-full text-[14px] font-medium transition-colors ${
              tab === item.id
                ? "bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)]"
                : "border border-[color:var(--wa-border)] text-[color:var(--wa-text-secondary)] hover:bg-[var(--wa-row-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {sentTo && (
        <div
          role="status"
          className="mx-4 mb-3 flex items-start gap-3 rounded-xl bg-[var(--wa-search-bg)] p-3 text-[14px] text-[color:var(--wa-text-primary)] sm:mx-5"
        >
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[color:var(--wa-accent)]" />
          <span>
            Request sent{sentTo.name || sentTo.username ? ` to ${sentTo.name || sentTo.username}` : ""}. You
            can message each other once they accept.
          </span>
        </div>
      )}

      {sendError && (
        <p role="alert" className="px-6 pb-3 text-center text-sm text-[color:var(--wa-danger)]">
          {sendError}
        </p>
      )}

      {tab === "phone" ? (
        <>
          <PanelSearch
            type="tel"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              resetFeedback();
            }}
            placeholder="Search by phone number"
            onEscape={onBack}
          />

          <p className="shrink-0 px-6 pb-2 text-[12px] text-[color:var(--wa-text-secondary)]">
            Enter full phone number with country code.
          </p>

          <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
            {searching && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--wa-text-secondary)]">
                <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
                Searching...
              </div>
            )}

            {!searching && searchError && (
              <p role="alert" className="px-6 py-6 text-center text-sm text-[color:var(--wa-danger)]">
                {searchError}
              </p>
            )}

            {!searching && !searchError && searched && users.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
                No WhatsApp account found for this phone number.
              </p>
            )}

            {!searching &&
              users.map((user) => (
                <div key={user._id} className="border-b border-[color:var(--wa-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(picked?._id === user._id ? null : user);
                      resetFeedback();
                    }}
                    className="flex h-[72px] w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-[var(--wa-row-hover)] active:bg-[var(--wa-row-active)]"
                  >
                    <Avatar user={user} />

                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                        {user.name || user.username}
                      </span>
                      <span className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">
                        {user.phone}
                      </span>
                    </div>
                  </button>

                  {picked?._id === user._id && (
                    <div className="px-4 pb-4">
                      <p className="pb-3 text-[13px] text-[color:var(--wa-text-secondary)]">
                        They will get a request and must accept before you can message them.
                      </p>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => sendRequest({ phone: user.phone })}
                        className={primaryButton}
                      >
                        {sending ? "Sending..." : "Send chat request"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      ) : (
        <form
          className="flex flex-col gap-3 px-4 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (username.trim() && pinValid) sendRequest({ username: username.trim(), pin });
          }}
        >
          <p className="text-[13px] text-[color:var(--wa-text-secondary)]">
            Ask the person for their username and their secret 4-digit PIN. They can find both in
            their menu under <span className="font-medium">My chat PIN</span>.
          </p>

          <input
            autoFocus
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              resetFeedback();
            }}
            placeholder="Username"
            aria-label="Username"
            autoComplete="off"
            maxLength={30}
            className={fieldClass}
          />

          <input
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              resetFeedback();
            }}
            placeholder="4-digit PIN"
            aria-label="4-digit PIN"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className={`${fieldClass} tracking-[0.4em]`}
          />

          <button type="submit" disabled={sending || !username.trim() || !pinValid} className={primaryButton}>
            {sending ? "Sending..." : "Send chat request"}
          </button>
        </form>
      )}
    </section>
  );
}