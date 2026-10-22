import { Plus } from "lucide-react";

export const DEFAULT_FILTERS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread", count: 83 },
  { label: "Favorites", value: "favorites" },
  { label: "Groups", value: "groups", count: 21 },
];

export default function ChatFilters({ activeFilter, onChange, filters = DEFAULT_FILTERS }) {
  return (
    <div className="flex shrink-0 select-none items-center gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
      {filters.map((filter) => {
        const active = activeFilter === filter.value;

        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={`flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14.5px] font-medium leading-none transition-colors ${
              active
                ? "border-[color:var(--wa-chip-active-border)] bg-[var(--wa-chip-active-bg)] text-[color:var(--wa-chip-active-text)]"
                : "border-[color:var(--wa-chip-border)] bg-[var(--wa-chip-bg)] text-[color:var(--wa-chip-text)] hover:bg-[var(--wa-chip-hover)]"
            }`}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className="text-[13px] font-normal opacity-80">{filter.count}</span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Add filter"
        title="Add filter"
        className="grid size-[34px] shrink-0 place-items-center rounded-full border border-[color:var(--wa-chip-border)] bg-[var(--wa-chip-bg)] text-[color:var(--wa-chip-text)] transition-colors hover:bg-[var(--wa-chip-hover)]"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}