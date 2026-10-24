/* Replaces the message box when messaging isn't allowed because of a block. */
export default function BlockedBar({ blockedByMe, name, busy = false, onUnblock }) {
  return (
    <div className="flex min-h-[62px] w-full items-center justify-center gap-4 border-t border-[color:var(--wa-border)] bg-[var(--wa-chat-header-bg)] px-4 py-3 text-center">
      {blockedByMe ? (
        <>
          <p className="text-[14px] text-[color:var(--wa-text-secondary)]">
            You blocked {name}. You can't send or receive messages.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onUnblock}
            className="shrink-0 rounded-full bg-[var(--wa-accent)] px-5 py-2 text-sm font-medium text-[color:var(--wa-accent-fg)] hover:bg-[var(--wa-accent-hover)] disabled:opacity-50"
          >
            {busy ? "Unblocking..." : "Unblock"}
          </button>
        </>
      ) : (
        <p className="text-[14px] text-[color:var(--wa-text-secondary)]">
          You can't send messages to this contact.
        </p>
      )}
    </div>
  );
}