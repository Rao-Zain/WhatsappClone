import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

export default function SettingsSearch({ value, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <label className="flex h-10 items-center gap-3 rounded-full border-2 border-transparent bg-[var(--wa-search-bg)] px-[15px] transition-colors duration-150 focus-within:border-[color:var(--wa-search-border-focus)] focus-within:bg-[var(--wa-search-bg-focus)]">
      <Search size={17} strokeWidth={2} className="shrink-0 text-[color:var(--wa-search-icon)]" />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && value && onChange("")}
        placeholder="Search"
        aria-label="Search settings"
        autoComplete="off"
        className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-[color:var(--wa-search-text)] caret-[color:var(--wa-accent)] outline-none placeholder:text-[color:var(--wa-search-placeholder)] placeholder:opacity-100 focus:ring-0"
      />

      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="text-[color:var(--wa-icon)] hover:text-[color:var(--wa-text-primary)]"
        >
          <X size={16} />
        </button>
      )}
    </label>
  );
}