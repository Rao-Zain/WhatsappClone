import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEMES, isDarkTheme } from "./themes";

const KEY = "wa-theme";
const listeners = new Set();

const isValid = (id) => THEMES.some((theme) => theme.id === id);

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    if (isValid(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME;
}

function apply(id) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", id);
  }
}

// Shared store: every component using useTheme() stays in sync,
// and the saved theme is applied the moment this module loads (no flash).
let current = read();
apply(current);

export function setTheme(id) {
  if (!isValid(id) || id === current) return;

  current = id;
  apply(id);

  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT_THEME;

export default function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { theme, setTheme, isDark: isDarkTheme(theme), themes: THEMES };
}