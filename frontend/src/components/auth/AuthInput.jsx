import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export default function AuthInput({
  id,
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
  icon: Icon,
  labelAction = null,
  disabled = false,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[13px] font-semibold text-[color:var(--wa-text-strong)]"
        >
          {label}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--wa-icon)]"
          />
        )}

        <input
          id={id}
          name={name}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 w-full rounded-xl border bg-[var(--wa-auth-input-bg)] text-[15px] text-[color:var(--wa-text-primary)] outline-none transition placeholder:text-[color:var(--wa-search-placeholder)] focus:bg-[var(--wa-auth-card-bg)] focus:ring-4 disabled:opacity-60 ${
            Icon ? "pl-11" : "pl-3.5"
          } ${isPassword ? "pr-11" : "pr-3.5"} ${
            error
              ? "border-[color:var(--wa-danger)] focus:border-[color:var(--wa-danger)] focus:ring-[var(--wa-auth-error-border)]"
              : "border-[color:var(--wa-auth-input-border)] focus:border-[color:var(--wa-accent)] focus:ring-[var(--wa-auth-ring)]"
          }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[color:var(--wa-icon)] transition hover:bg-[var(--wa-hover)] hover:text-[color:var(--wa-text-primary)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[color:var(--wa-danger)]"
        >
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}