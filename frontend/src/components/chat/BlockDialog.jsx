import { useEffect } from "react";
import { createPortal } from "react-dom";

/* Confirm blocking someone. Same look as the delete-message dialog. */
export default function BlockDialog({ name, busy = false, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={`Block ${name}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal w-full max-w-[400px] rounded-2xl bg-[var(--wa-modal-bg)] p-6"
      >
        <h2 className="text-[19px] text-[color:var(--wa-text-primary)]">Block {name}?</h2>
        <p className="mt-2 text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
          They won't be able to send you messages or call you. You can unblock them at any time from
          this chat or from Blocked contacts.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--wa-border)] px-5 py-2 text-sm font-medium text-[color:var(--wa-accent)] hover:bg-[var(--wa-menu-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-full bg-[var(--wa-danger)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Blocking..." : "Block"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}