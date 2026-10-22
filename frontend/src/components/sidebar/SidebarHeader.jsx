import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut, MoreVertical, Palette, Star } from "lucide-react";
import ThemeModal from "../../theme/ThemeModal";
import { useAuth } from "../../context/AuthContext";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

/* Confirmation dialog, same look as the delete-message dialog */
function LogoutDialog({ onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[var(--wa-overlay)] p-4"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Log out"
        onMouseDown={(event) => event.stopPropagation()}
        className="wa-shadow-modal w-full max-w-[400px] rounded-2xl bg-[var(--wa-modal-bg)] p-6"
      >
        <h2 className="text-[19px] text-[color:var(--wa-text-primary)]">Log out?</h2>
        <p className="mt-2 text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
          You will need to sign in again to see your chats.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--wa-border)] px-5 py-2 text-sm font-medium text-[color:var(--wa-accent)] hover:bg-[var(--wa-menu-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-[var(--wa-accent)] px-5 py-2 text-sm font-medium text-[color:var(--wa-accent-fg)] hover:bg-[var(--wa-accent-hover)]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SidebarHeader({ onNewChat, onOpenStarred, onLogout }) {
  const navigate = useNavigate();
  const auth = useAuth() || {};

  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function performLogout() {
    // Go offline for other people and stop receiving messages.
    try {
      getSocket().disconnect();
    } catch {
      /* socket not created yet */
    }

    // Same keys the signup/login flow writes.
    ["token", "user"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    if (api?.defaults?.headers?.common) {
      delete api.defaults.headers.common.Authorization;
    }

    if (typeof auth.logout === "function") auth.logout();
    else auth.setUser?.(null);

    onLogout?.();
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  }

  const iconBtn =
    "grid size-10 place-items-center rounded-full text-[color:var(--wa-header-icon)] transition-colors hover:bg-[var(--wa-hover)] active:bg-[var(--wa-pressed)]";

  const menuItem =
    "flex h-10 w-full items-center gap-4 px-5 text-left text-[15px] text-[color:var(--wa-menu-text)] outline-none transition-colors hover:bg-[var(--wa-menu-hover)] focus-visible:bg-[var(--wa-menu-hover)]";

  const run = (action) => () => {
    setMenuOpen(false);
    action?.();
  };

  return (
    <header className="flex h-[65px] shrink-0 select-none items-center justify-between px-4 sm:px-5">
      <h1 className="text-[24px] font-bold leading-none tracking-[-0.02em] text-[color:var(--wa-title)] sm:text-[22px]">
        WhatsApp
      </h1>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Camera" title="Camera" className={`${iconBtn} sm:hidden`}>
          <Camera size={22} />
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Menu"
            title="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={iconBtn}
          >
            <MoreVertical size={22} />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="wa-shadow-menu absolute right-0 top-11 z-40 w-[230px] overflow-hidden rounded-xl bg-[var(--wa-menu-bg)] py-2"
              >
                <button type="button" role="menuitem" className={menuItem} onClick={run(onOpenStarred)}>
                  <Star size={18} className="text-[color:var(--wa-menu-icon)]" />
                  Starred messages
                </button>

                <button type="button" role="menuitem" className={menuItem} onClick={run(() => setThemeOpen(true))}>
                  <Palette size={18} className="text-[color:var(--wa-menu-icon)]" />
                  Change theme
                </button>

                <div className="my-1 h-px bg-[var(--wa-menu-divider)]" />

                <button type="button" role="menuitem" className={menuItem} onClick={run(() => setLogoutOpen(true))}>
                  <LogOut size={18} className="text-[color:var(--wa-menu-icon)]" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="New chat"
          title="New chat"
          onClick={onNewChat}
          className="hidden size-10 place-items-center rounded-full bg-[var(--wa-fab-bg)] text-[color:var(--wa-fab-fg)] transition-colors hover:bg-[var(--wa-fab-hover)] active:scale-95 sm:grid"
        >
          <NewChatIcon size={21} />
        </button>
      </div>

      {themeOpen && <ThemeModal onClose={() => setThemeOpen(false)} />}
      {logoutOpen && <LogoutDialog onCancel={() => setLogoutOpen(false)} onConfirm={performLogout} />}
    </header>
  );
}

export function NewChatIcon({ size = 21 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M4.5 3h15A2.5 2.5 0 0 1 22 5.5v11a2.5 2.5 0 0 1-2.5 2.5H8l-5 4v-4H4.5A2.5 2.5 0 0 1 2 16.5v-11A2.5 2.5 0 0 1 4.5 3zm7.5 4a1 1 0 0 0-1 1v2H9a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2V8a1 1 0 0 0-1-1z" />
    </svg>
  );
}