import { UserPlus } from "lucide-react";

/* Row at the top of the chat list, shown only while someone is waiting for an answer. */
export default function RequestsRow({ count = 0, onClick }) {
  if (count < 1) return null;

  return (
    <div className="flex h-14 shrink-0 items-center sm:h-16 sm:px-2.5">
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full items-center gap-7 pl-6 pr-5 text-left transition-colors hover:bg-[var(--wa-row-hover)] sm:h-[50px] sm:rounded-xl sm:pl-7"
      >
        <UserPlus size={20} className="shrink-0 text-[color:var(--wa-accent)]" />
        <span className="flex-1 text-[16px] font-medium text-[color:var(--wa-text-strong)]">
          Chat requests
        </span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--wa-accent)] px-1.5 text-[12px] font-medium text-[color:var(--wa-accent-fg)]">
          {count}
        </span>
      </button>
    </div>
  );
}