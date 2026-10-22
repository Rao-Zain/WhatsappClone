import { useState } from "react";
import { AtSign, Check, Copy, Pencil, Phone } from "lucide-react";

const LABEL = "block text-sm leading-5 text-[color:var(--wa-text-secondary)]";

const VALUE =
  "min-w-0 flex-1 truncate text-base leading-6 text-[color:var(--wa-text-primary)]";

const ROW_ICON = "text-[color:var(--wa-icon)]";

function IconButton({ label, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[color:var(--wa-icon)] transition-colors hover:bg-[var(--wa-hover)] hover:text-[color:var(--wa-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wa-accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SavingIndicator() {
  return (
    <span className="size-5 animate-spin rounded-full border-2 border-[color:var(--wa-icon)] border-t-transparent" />
  );
}

/** Shared layout for About and Name. */
export function EditableField({
  label,
  value,
  onSave,
  icon,
  maxLength = 100,
  className = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const start = () => {
    setDraft(value ?? "");
    setError("");
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;

    setDraft(value ?? "");
    setError("");
    setEditing(false);
  };

  const saveValue = async () => {
    if (saving) return;

    const next = draft.trim();

    if (!next && label === "Name") {
      setError("Name cannot be empty.");
      return;
    }

    if (next === (value ?? "")) {
      setEditing(false);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const success = await onSave(next);

      if (success === true) {
        setEditing(false);
      } else {
        setError("Unable to save. Please try again.");
      }
    } catch {
      setError("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>

      <div className="mt-2 flex min-h-11 items-center gap-3">
        {icon && (
          <span className={`flex size-6 shrink-0 items-center justify-center ${ROW_ICON}`}>
            {icon}
          </span>
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={maxLength}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveValue();
              if (event.key === "Escape") cancel();
            }}
            aria-label={label}
            className={`${VALUE} h-9 border-0 border-b-2 border-[color:var(--wa-accent)] bg-transparent px-0 caret-[color:var(--wa-accent)] outline-none focus:ring-0 disabled:opacity-60`}
          />
        ) : (
          <span className={VALUE}>{value || " "}</span>
        )}

        <IconButton
          label={saving ? `Saving ${label}` : editing ? `Save ${label}` : `Edit ${label}`}
          onClick={editing ? saveValue : start}
          disabled={saving}
        >
          {saving ? (
            <SavingIndicator />
          ) : editing ? (
            <Check size={21} strokeWidth={2} />
          ) : (
            <Pencil size={19} strokeWidth={1.8} />
          )}
        </IconButton>
      </div>

      {(error || editing) && (
        <p
          className={`mt-1.5 text-xs leading-5 ${
            error ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-text-secondary)]"
          }`}
        >
          {error ||
            (saving
              ? `Saving ${label.toLowerCase()}...`
              : "Press Enter to save or Escape to cancel.")}
        </p>
      )}
    </section>
  );
}

/** Username with a consistent row and vertically aligned action button. */
export function UsernameField({ username, pin, onSave, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = () => {
    setDraft(username || "");
    setError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (saving) return;

    setDraft(username || "");
    setError("");
    setEditing(false);
  };

  const saveUsername = async () => {
    if (saving) return;

    const next = draft.trim();

    if (next.length < 3 || next.length > 30) {
      setError("Username must be between 3 and 30 characters.");
      return;
    }

    if (next === username) {
      setEditing(false);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const success = await onSave(next);

      if (success === true) {
        setEditing(false);
      } else {
        setError("Unable to update username. Please try again.");
      }
    } catch {
      setError("Unable to update username. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`min-w-0 ${className}`}>
      <span className={LABEL}>Username</span>

      <div className="mt-2 flex min-h-11 items-center gap-3">
        <span className={`flex size-6 shrink-0 items-center justify-center ${ROW_ICON}`}>
          <AtSign size={22} strokeWidth={1.7} />
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={30}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveUsername();
                if (event.key === "Escape") cancelEditing();
              }}
              className="h-9 w-full border-0 border-b-2 border-[color:var(--wa-accent)] bg-transparent p-0 text-base leading-6 text-[color:var(--wa-text-primary)] caret-[color:var(--wa-accent)] outline-none focus:ring-0 disabled:opacity-60"
              aria-label="Username"
            />
          ) : (
            <p className="truncate text-base leading-6 text-[color:var(--wa-text-primary)]">
              {username || " "}
            </p>
          )}
        </div>

        <IconButton
          label={saving ? "Saving username" : editing ? "Save username" : "Edit username"}
          onClick={editing ? saveUsername : startEditing}
          disabled={saving}
        >
          {saving ? (
            <SavingIndicator />
          ) : editing ? (
            <Check size={21} strokeWidth={2} />
          ) : (
            <Pencil size={19} strokeWidth={1.8} />
          )}
        </IconButton>
      </div>

      {(error || editing) && (
        <p
          className={`mt-1.5 pl-9 text-xs leading-5 ${
            error ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-text-secondary)]"
          }`}
        >
          {error ||
            (saving
              ? "Saving username..."
              : "Use 3–30 characters. Press Enter to save or Escape to cancel.")}
        </p>
      )}
    </section>
  );
}

/** Phone number with a vertically centered copy button. */
export function PhoneField({ phone, className = "" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in the current browser context.
    }
  };

  return (
    <section className={`min-w-0 ${className}`}>
      <span className={LABEL}>Phone</span>

      <div className="mt-2 flex min-h-11 items-center gap-3">
        <Phone size={22} strokeWidth={1.7} className={`size-6 shrink-0 ${ROW_ICON}`} />

        <span className={VALUE}>{phone || " "}</span>

        <IconButton
          label={copied ? "Phone number copied" : "Copy phone number"}
          onClick={copy}
        >
          {copied ? (
            <Check size={21} strokeWidth={2} className="text-[color:var(--wa-accent)]" />
          ) : (
            <Copy size={19} strokeWidth={1.8} />
          )}
        </IconButton>
      </div>

      {copied && (
        <p className="mt-1.5 text-xs leading-5 text-[color:var(--wa-accent)]">
          Phone number copied
        </p>
      )}
    </section>
  );
}