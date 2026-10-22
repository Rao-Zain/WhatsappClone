export default function SettingsMenuItem({
  icon: Icon,
  title,
  description,
  onClick,
  active = false,
  danger = false,
}) {
  const colors = danger
    ? "text-[color:var(--wa-danger)] hover:bg-[color-mix(in_srgb,var(--wa-danger)_8%,transparent)]"
    : `text-[color:var(--wa-text-primary)] hover:bg-[var(--wa-row-hover)] ${
        active ? "bg-[var(--wa-row-active)]" : ""
      }`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[68px] w-full items-center gap-[22px] rounded-xl px-4 py-[13px] text-left transition-colors duration-100 sm:px-5 ${colors}`}
    >
      <span
        className={`flex w-6 shrink-0 justify-center ${
          danger ? "" : "text-[color:var(--wa-icon)]"
        }`}
      >
        <Icon size={24} strokeWidth={1.6} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base leading-5">{title}</span>
        {description && (
          <span className="truncate text-sm leading-5 text-[color:var(--wa-text-secondary)]">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}