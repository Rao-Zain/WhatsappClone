import { Lock } from "lucide-react";

// Shown on desktop when no conversation is selected.
export default function EmptyChat() {
  return (
    <main className="relative hidden h-full w-full flex-1 select-none flex-col items-center justify-between border-b-[6px] border-[color:var(--wa-empty-border)] bg-[var(--wa-empty-bg)] p-6 text-center sm:flex">
      <div />

      <div className="flex max-w-[460px] flex-col items-center">
        <div className="mb-8 flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
          <svg viewBox="0 0 357 206" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="10" width="230" height="150" rx="12" className="fill-[var(--wa-empty-art-frame)]" />
            <rect x="25" y="20" width="210" height="130" rx="6" className="fill-[var(--wa-sidebar-bg)]" />
            <rect x="40" y="35" width="100" height="10" rx="4" className="fill-[var(--wa-empty-art-line)]" />
            <rect x="40" y="55" width="140" height="8" rx="4" className="fill-[var(--wa-empty-art-line)]" />
            <rect x="40" y="70" width="120" height="8" rx="4" className="fill-[var(--wa-empty-art-line)]" />
            <rect x="220" y="45" width="115" height="150" rx="14" className="fill-[var(--wa-empty-art-phone)]" />
            <rect x="225" y="52" width="105" height="136" rx="10" className="fill-[var(--wa-sidebar-bg)]" />
            <rect x="238" y="70" width="60" height="8" rx="4" className="fill-[var(--wa-accent)]" />
            <rect x="238" y="85" width="80" height="6" rx="3" className="fill-[var(--wa-empty-art-line)]" />
            <rect x="238" y="97" width="70" height="6" rx="3" className="fill-[var(--wa-empty-art-line)]" />
            <circle cx="277" cy="172" r="5" className="fill-[var(--wa-empty-art-frame)]" />
          </svg>
        </div>

        <h1 className="text-[32px] font-light leading-tight text-[color:var(--wa-empty-title)]">
          Download WhatsApp for Windows
        </h1>
        <p className="mt-4 text-sm leading-6 text-[color:var(--wa-empty-text)]">
          Make calls, share your screen and get a faster experience when you download the Windows app.
        </p>
        <button
          type="button"
          className="mt-8 rounded-full bg-[var(--wa-accent)] px-6 py-2.5 text-sm font-medium text-[color:var(--wa-accent-fg)] transition hover:bg-[var(--wa-accent-hover)] active:scale-95"
        >
          Get from Microsoft Store
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[color:var(--wa-empty-text)]">
        <Lock size={12} />
        <span>Your personal messages are end-to-end encrypted</span>
      </div>
    </main>
  );
}