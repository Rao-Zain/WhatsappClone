/* Shared class strings for the auth pages. Colors come from theme.css. */

export const primaryButtonClass =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl " +
  "bg-[var(--wa-auth-btn-bg)] px-5 py-3 text-[15px] font-semibold " +
  "text-[color:var(--wa-accent-fg)] " +
  "shadow-[0_6px_16px_-6px_var(--wa-auth-btn-shadow)] transition " +
  "hover:bg-[var(--wa-auth-btn-hover)] active:scale-[0.99] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--wa-auth-ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

export const otpInputClass =
  "w-full rounded-xl border bg-[var(--wa-auth-input-bg)] px-3 py-3.5 text-center " +
  "font-mono text-2xl tracking-[0.4em] text-[color:var(--wa-text-primary)] outline-none transition " +
  "placeholder:text-[color:var(--wa-search-placeholder)] focus:bg-[var(--wa-auth-card-bg)] " +
  "focus:border-[color:var(--wa-accent)] focus:ring-4 focus:ring-[var(--wa-auth-ring)] " +
  "disabled:opacity-60";

export const linkClass =
  "font-semibold text-[color:var(--wa-accent)] transition hover:text-[color:var(--wa-accent-hover)] hover:underline underline-offset-4";