import { Search } from "lucide-react";

export default function SearchBar({ value, onChange }) {
  return (
    <div className="shrink-0 px-4 pt-0.5 sm:px-5">
      <label
        className="flex h-[38px] w-full items-center gap-3.5 rounded-full border border-transparent bg-[var(--wa-search-bg)] pl-[18px] pr-4 transition-colors focus-within:border-[color:var(--wa-search-border-focus)] focus-within:bg-[var(--wa-search-bg-focus)]"
      >
        <Search size={18} strokeWidth={2.4} className="shrink-0 text-[color:var(--wa-search-icon)]" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search or start a new chat"
          aria-label="Search conversations"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[14.5px] text-[color:var(--wa-search-text)] outline-none ring-0 placeholder:text-[color:var(--wa-search-placeholder)] focus:outline-none focus:ring-0"
        />
      </label>
    </div>
  );
}