import { ArrowLeft } from "lucide-react";

/* Compact sidebar sub-panel header (Starred messages, New chat...).
   Same height as the main sidebar header, no colored banner. */
export default function PanelHeader({ title, onBack, children }) {
  return (
    <header className="flex h-[65px] shrink-0 select-none items-center justify-between px-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Back to chats"
          title="Back"
          onClick={onBack}
          className="grid size-10 shrink-0 place-items-center rounded-full text-[color:var(--wa-header-icon)] transition-colors hover:bg-[var(--wa-hover)] active:bg-[var(--wa-pressed)]"
        >
          <ArrowLeft size={22} />
        </button>

        <h2 className="truncate text-[17px] font-normal leading-none text-[color:var(--wa-text-primary)]">
          {title}
        </h2>
      </div>

      {children}
    </header>
  );
}