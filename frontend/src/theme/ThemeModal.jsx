import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import useTheme from "./useTheme";

/* Live mini-preview. data-theme scopes the CSS variables to this element,
   so it always shows the real colors from theme.css. */
function Preview({ id }) {
  return (
    <div
      data-theme={id}
      aria-hidden="true"
      className="flex h-[92px] w-full overflow-hidden rounded-lg border border-[color:var(--wa-border)] bg-[var(--wa-chat-bg)]"
    >
      <div className="w-5 shrink-0 bg-[var(--wa-rail-bg)]" />

      <div className="flex w-[34%] shrink-0 flex-col gap-1.5 bg-[var(--wa-sidebar-bg)] p-1.5">
        <span className="h-2 rounded-full bg-[var(--wa-search-bg)]" />
        <span className="h-2 w-3/4 rounded-full bg-[var(--wa-chip-active-bg)]" />
        <span className="h-2 w-1/2 rounded-full bg-[var(--wa-border)]" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-1.5 px-2">
        <span className="h-3.5 w-3/5 rounded-md rounded-tl-none bg-[var(--wa-bubble-in-bg)]" />
        <span className="ml-auto h-3.5 w-1/2 rounded-md rounded-tr-none bg-[var(--wa-bubble-out-bg)]" />
        <span className="absolute bottom-1.5 right-1.5 size-3.5 rounded-full bg-[var(--wa-accent)]" />
      </div>
    </div>
  );
}

export default function ThemeModal({ onClose }) {
  const { theme, setTheme, themes } = useTheme();

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose theme"
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal w-full max-w-[460px] rounded-2xl bg-[var(--wa-modal-bg)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[19px] text-[color:var(--wa-text-primary)]">Theme</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {themes.map((item) => {
            const active = item.id === theme;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(item.id)}
                className={`rounded-xl border-2 p-2 text-left transition-colors ${
                  active
                    ? "border-[color:var(--wa-accent)]"
                    : "border-transparent hover:bg-[var(--wa-menu-hover)]"
                }`}
              >
                <Preview id={item.id} />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[15px] text-[color:var(--wa-text-primary)]">{item.label}</span>
                  {active && <Check size={18} className="text-[color:var(--wa-accent)]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}