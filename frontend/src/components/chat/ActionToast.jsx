import { useEffect } from "react";

// Small message at the bottom of the screen ("Message copied").
export default function ActionToast({ notice, onDone }) {
  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [notice, onDone]);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="wa-shadow-menu pointer-events-none fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 rounded-lg bg-[var(--wa-toast-bg)] px-4 py-2 text-sm text-[color:var(--wa-toast-fg)]"
    >
      {notice.text}
    </div>
  );
}