import { Archive } from "lucide-react";

export default function ArchivedRow({ count = 7, onClick }) {
  return (
    <div className="flex h-14 shrink-0 items-center sm:h-16 sm:px-2.5">
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full items-center gap-7 pl-6 pr-5 text-left transition-colors hover:bg-[var(--wa-row-hover)] sm:h-[50px] sm:rounded-xl sm:pl-7"
      >
        <Archive size={20} className="shrink-0 text-[color:var(--wa-icon-strong)]" />
        <span className="flex-1 text-[16px] text-[color:var(--wa-text-strong)]">Archived</span>
        <span className="text-[14px] text-[color:var(--wa-text-secondary)]">{count}</span>
      </button>
    </div>
  );
}