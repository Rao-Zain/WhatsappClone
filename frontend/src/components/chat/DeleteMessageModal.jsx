import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function DeleteMessageModal({
  canDeleteForEveryone,
  isBusy,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isBusy) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isBusy]);

  const button =
    "rounded-full border border-[color:var(--wa-border)] px-4 py-2 text-sm font-medium text-[color:var(--wa-accent)] hover:bg-[var(--wa-menu-hover)] disabled:opacity-50";

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={() => !isBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete message"
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal w-full max-w-[400px] rounded-2xl bg-[var(--wa-modal-bg)] p-6"
      >
        <h2 className="mb-5 text-[17px] text-[color:var(--wa-text-primary)]">Delete message?</h2>

        <div className="flex flex-col items-end gap-2">
          {canDeleteForEveryone && (
            <button type="button" disabled={isBusy} onClick={onDeleteForEveryone} className={button}>
              Delete for everyone
            </button>
          )}

          <button type="button" disabled={isBusy} onClick={onDeleteForMe} className={button}>
            Delete for me
          </button>

          <button type="button" disabled={isBusy} onClick={onClose} className={button}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}