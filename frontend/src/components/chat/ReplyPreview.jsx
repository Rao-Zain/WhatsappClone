import { X } from "lucide-react";
import { getPreviewLabel } from "../../../lib/messagePreview";

// Strip above the composer while replying to a message.
export default function ReplyPreview({ message, onCancel }) {
  const isMine = message.sender === "me";
  const author = isMine ? "You" : message.senderName || "Contact";

  const label = getPreviewLabel({
    text: message.text,
    type: message.type,
    fileName: message.attachments?.[0]?.originalName,
  });

  return (
    <div className="wa-shadow-float mb-2 flex items-stretch gap-3 overflow-hidden rounded-xl bg-[var(--wa-reply-bg)] px-3 py-2">
      <span
        className={`w-1 shrink-0 rounded-full ${
          isMine ? "bg-[var(--wa-quote-mine-bar)]" : "bg-[var(--wa-quote-other-bar)]"
        }`}
      />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] font-medium ${
            isMine ? "text-[color:var(--wa-quote-mine-text)]" : "text-[color:var(--wa-quote-other-text)]"
          }`}
        >
          {author}
        </p>
        <p className="truncate text-[13px] text-[color:var(--wa-text-secondary)]">{label}</p>
      </div>

      <button
        type="button"
        aria-label="Cancel reply"
        title="Cancel reply"
        onClick={onCancel}
        className="grid size-8 shrink-0 place-items-center self-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}