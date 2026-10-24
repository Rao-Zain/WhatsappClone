import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, RefreshCw } from "lucide-react";
import api from "../../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* Shows my username + secret PIN so I can share them with someone who
   should be able to send me a chat request. */
export default function MyPinModal({ onClose }) {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(`Username: ${user.username}\nPIN: ${user.chatPin}`);
      setMessage("Copied");
    } catch {
      setMessage("Could not copy. Please select the text instead.");
    }
  }

  async function regenerate() {
    if (busy) return;

    try {
      setBusy(true);
      setMessage("");
      const response = await api.post("/auth/regenerate-pin");
      setUser((previous) => (previous ? { ...previous, chatPin: response.data.chatPin } : previous));
      setMessage("New PIN created. The old one no longer works.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Unable to create a new PIN.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My chat PIN"
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal w-full max-w-[400px] rounded-2xl bg-[var(--wa-modal-bg)] p-6"
      >
        <h2 className="text-[19px] text-[color:var(--wa-text-primary)]">My chat PIN</h2>
        <p className="mt-2 text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
          Anyone with your username and this PIN can send you a chat request. Only share it with people
          you want to hear from.
        </p>

        <dl className="mt-5 rounded-xl bg-[var(--wa-search-bg)] p-4">
          <dt className="text-[12px] uppercase tracking-wide text-[color:var(--wa-text-secondary)]">Username</dt>
          <dd className="mb-3 break-all text-[17px] text-[color:var(--wa-text-primary)]">{user?.username}</dd>

          <dt className="text-[12px] uppercase tracking-wide text-[color:var(--wa-text-secondary)]">PIN</dt>
          <dd className="text-[28px] font-medium tracking-[0.35em] text-[color:var(--wa-text-primary)]">
            {user?.chatPin || "----"}
          </dd>
        </dl>

        {message && (
          <p role="status" className="mt-3 text-[13px] text-[color:var(--wa-text-secondary)]">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--wa-border)] px-4 py-2 text-sm font-medium text-[color:var(--wa-accent)] hover:bg-[var(--wa-menu-hover)] disabled:opacity-50"
          >
            <RefreshCw size={15} /> New PIN
          </button>
          <button
            type="button"
            onClick={copyDetails}
            disabled={!user?.chatPin}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--wa-accent)] px-4 py-2 text-sm font-medium text-[color:var(--wa-accent-fg)] hover:bg-[var(--wa-accent-hover)] disabled:opacity-50"
          >
            <Copy size={15} /> Copy
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}