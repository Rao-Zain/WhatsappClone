import { Plus } from "lucide-react";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ReactionBar({ selected, onPick, onMore }) {
  return (
    <div
      role="group"
      aria-label="Quick reactions"
      className="wa-shadow-menu flex w-fit items-center gap-0.5 rounded-full bg-[var(--wa-menu-bg)] px-2 py-1.5"
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`React with ${emoji}`}
          aria-pressed={selected === emoji}
          onClick={() => onPick(emoji)}
          className={`grid size-9 place-items-center rounded-full text-[24px] leading-none transition-transform hover:scale-125 ${
            selected === emoji ? "bg-[var(--wa-chip-active-bg)]" : ""
          }`}
        >
          {emoji}
        </button>
      ))}

      <button
        type="button"
        aria-label="More reactions"
        onClick={onMore}
        className="grid size-9 place-items-center rounded-full bg-[var(--wa-hover)] text-[color:var(--wa-menu-icon)] hover:bg-[var(--wa-pressed)]"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}