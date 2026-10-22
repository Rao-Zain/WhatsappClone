import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

/* Search pill with the green focus ring. Autofocuses on open.
   Escape clears the text first, then (if already empty) calls onEscape. */
export default function PanelSearch({
  value,
  onChange,
  placeholder = "Search",
  type = "text",
  ariaLabel,
  onEscape,
  autoFocus = true,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="shrink-0 px-4 pb-2 pt-0.5 sm:px-5">
      <label className="flex h-10 w-full items-center gap-3.5 rounded-full border-2 border-transparent bg-[var(--wa-search-bg)] pl-4 pr-3 transition-colors focus-within:border-[color:var(--wa-search-border-focus)] focus-within:bg-[var(--wa-search-bg-focus)]">
        <Search size={18} strokeWidth={2.4} className="shrink-0 text-[color:var(--wa-search-icon)]" />

        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;

            if (value) onChange("");
            else onEscape?.();
          }}
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[color:var(--wa-search-text)] caret-[color:var(--wa-accent)] outline-none ring-0 placeholder:text-[color:var(--wa-search-placeholder)] focus:outline-none focus:ring-0"
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
    </div>
  );
}