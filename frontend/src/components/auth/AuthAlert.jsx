import { AlertCircle, CheckCircle2 } from "lucide-react";

/* kind: "error" | "success" */
export default function AuthAlert({ kind = "error", children }) {
  const isError = kind === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-5 ${
        isError
          ? "border-[color:var(--wa-auth-error-border)] bg-[var(--wa-auth-error-bg)] text-[color:var(--wa-danger)]"
          : "border-[color:var(--wa-reaction-mine-border)] bg-[var(--wa-chip-active-bg)] text-[color:var(--wa-chip-active-text)]"
      }`}
    >
      {isError ? (
        <AlertCircle size={17} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}