import { useSyncExternalStore } from "react";

// Same width where Tailwind's `sm:` classes switch on (640px).
export const MOBILE_QUERY = "(max-width: 639px)";

// Plain check for event handlers and other places that are not components.
export function isMobileNow() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function subscribe(onChange) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

/* true on phones, false on tablets and computers. Updates when the window is resized or rotated. */
export default function useIsMobile() {
  return useSyncExternalStore(subscribe, isMobileNow, () => false);
}