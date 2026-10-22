import { NavLink } from "react-router-dom";
import { Images, MessageCircleMore, Phone } from "lucide-react";

/* ---------- Icons (exported for the mobile bottom nav) ---------- */
export function ChatFilledIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-7l-5 4v-4H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="currentColor" />
      <path d="M7 9h10M7 13h6" stroke="var(--wa-rail-bg)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StatusIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" strokeDasharray="4.5 2.5" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

export function CommunitiesIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 19.5c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2z" />
      <circle cx="4.8" cy="9.8" r="2.2" />
      <path d="M1 18.2c0-2.2 1.6-3.8 3.8-3.8.8 0 1.5.2 2.1.5-1.1 1-1.6 2.2-1.8 3.3z" />
      <circle cx="19.2" cy="9.8" r="2.2" />
      <path d="M23 18.2c0-2.2-1.6-3.8-3.8-3.8-.8 0-1.5.2-2.1.5 1.1 1 1.6 2.2 1.8 3.3z" />
    </svg>
  );
}

/* Meta AI keeps its fixed brand colors on purpose */
const PETAL_COLORS = ["#a855f7", "#8b5cf6", "#6366f1", "#3b82f6", "#d946ef", "#ec4899"];

function MetaAiIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {PETAL_COLORS.map((color, i) => (
        <ellipse key={color} cx="12" cy="6.2" rx="2.3" ry="3.3" fill={color} transform={`rotate(${i * 60} 12 12)`} />
      ))}
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Chats", end: true, icon: ChatFilledIcon, badge: true },
  { to: "/calls", label: "Calls", icon: Phone, badge: true },
  { to: "/status", label: "Status", icon: StatusIcon, dot: true },
  { to: "/channels", label: "Channels", icon: MessageCircleMore },
  { to: "/communities", label: "Communities", icon: CommunitiesIcon },
];

const itemClass = (isActive) =>
  `relative grid size-[42px] place-items-center rounded-full transition-colors ${
    isActive
      ? "bg-[var(--wa-rail-item-active)] text-[color:var(--wa-rail-icon-active)]"
      : "text-[color:var(--wa-rail-icon)] hover:bg-[var(--wa-rail-item-hover)]"
  }`;

export default function NavigationRail({
  unreadChats = 83,
  unreadCalls = 1,
  hasStatusUpdate = true,
  profileImage,
}) {
  return (
    <aside className="hidden h-full w-16 shrink-0 select-none flex-col items-center justify-between border-r border-[color:var(--wa-rail-border)] bg-[var(--wa-rail-bg)] pb-2.5 pt-1.5 sm:flex">
      <nav aria-label="Main" className="flex flex-col items-center gap-0.5">
        {NAV_ITEMS.map(({ to, label, end, icon: Icon, badge, dot }) => {
          const badgeCount = label === "Chats" ? unreadChats : label === "Calls" ? unreadCalls : 0;

          return (
            <NavLink key={to} to={to} end={end} aria-label={label} title={label} className={({ isActive }) => itemClass(isActive)}>
              <Icon size={22} strokeWidth={1.9} />

              {badge && badgeCount > 0 && (
                <span className="absolute -right-1.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--wa-badge-bg)] px-1 text-[11px] font-semibold leading-none text-[color:var(--wa-badge-fg)]">
                  {badgeCount}
                </span>
              )}

              {dot && hasStatusUpdate && (
                <span className="absolute right-1 top-1 size-2.5 rounded-full bg-[var(--wa-badge-bg)] ring-2 ring-[var(--wa-rail-bg)]" />
              )}
            </NavLink>
          );
        })}

        <div className="my-2 h-px w-8 bg-[var(--wa-rail-divider)]" />

        <NavLink to="/meta-ai" aria-label="Meta AI" title="Meta AI" className={({ isActive }) => itemClass(isActive)}>
          <MetaAiIcon size={22} />
        </NavLink>
      </nav>

      <div className="flex flex-col items-center gap-1.5">
        <NavLink to="/media" aria-label="Media" title="Media" className={({ isActive }) => itemClass(isActive)}>
          <Images size={22} strokeWidth={1.8} />
        </NavLink>

        <NavLink
          to="/settings"
          aria-label="Profile and Settings"
          title="Settings"
          className="grid size-[42px] place-items-center rounded-full transition-colors hover:bg-[var(--wa-rail-item-hover)]"
        >
          <img src={profileImage || "https://i.pravatar.cc/100?img=12"} alt="My profile" className="size-7 rounded-full object-cover" />
        </NavLink>
      </div>
    </aside>
  );
}