import { getPreviewLabel } from "../../../lib/messagePreview";

// The quoted message shown at the top of a reply bubble.
export default function QuotedMessage({ reply, onClick }) {
  const author = reply.isMine ? "You" : reply.senderName || "Contact";

  const label = getPreviewLabel({
    text: reply.text,
    type: reply.type,
    deleted: reply.deleted,
  });

  return (
    <div className="-mx-[5px] -mt-[2px] mb-1">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-w-[160px] items-stretch overflow-hidden rounded-md bg-[var(--wa-bubble-overlay)] text-left transition-[filter] hover:brightness-95"
      >
        <span
          className={`w-1 shrink-0 ${
            reply.isMine ? "bg-[var(--wa-quote-mine-bar)]" : "bg-[var(--wa-quote-other-bar)]"
          }`}
        />

        <span className="min-w-0 flex-1 py-2 pl-2 pr-2.5">
          <span
            className={`block truncate text-[13px] font-medium leading-[18px] ${
              reply.isMine
                ? "text-[color:var(--wa-quote-mine-text)]"
                : "text-[color:var(--wa-quote-other-text)]"
            }`}
          >
            {author}
          </span>

          <span
            className={`line-clamp-2 block text-[13.5px] leading-[18px] text-[color:var(--wa-bubble-meta)] ${
              reply.deleted ? "italic" : ""
            }`}
          >
            {label}
          </span>
        </span>
      </button>
    </div>
  );
}