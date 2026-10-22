export default function ContextMenuItem({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-[40px] w-full items-center gap-4 px-5 text-left text-[15px] text-[color:var(--wa-menu-text)] outline-none transition-colors hover:bg-[var(--wa-menu-hover)] focus-visible:bg-[var(--wa-menu-hover)]"
    >
      <Icon
        size={18}
        strokeWidth={1.8}
        className={`shrink-0 ${danger ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-menu-icon)]"}`}
      />
      <span>{label}</span>
    </button>
  );
}