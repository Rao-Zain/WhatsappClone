import { Pencil, X } from "lucide-react";

// Strip above the composer while editing a sent message.
export default function EditPreview({ message, onCancel }) {
  return (
    <div className="wa-shadow-float mb-2 flex items-stretch gap-3 overflow-hidden rounded-xl bg-[var(--wa-reply-bg)] px-3 py-2">
      <span className="w-1 shrink-0 rounded-full bg-[var(--wa-accent)]" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[color:var(--wa-accent)]">
          <Pencil size={13} /> Edit message
        </p>
        <p className="truncate text-[13px] text-[color:var(--wa-text-secondary)]">{message.text}</p>
      </div>

      <button
        type="button"
        aria-label="Cancel edit"
        title="Cancel edit"
        onClick={onCancel}
        className="grid size-8 shrink-0 place-items-center self-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}