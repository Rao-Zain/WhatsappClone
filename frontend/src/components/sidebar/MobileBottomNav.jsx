import { NavLink } from "react-router-dom";
import { Phone } from "lucide-react";
import { ChatFilledIcon, CommunitiesIcon, StatusIcon } from "../layout/NavigationRail";
import { useNavCounts } from "../../context/NavCountsContext";


const ITEMS = [
  { to: "/app", label: "Chats", end: true, icon: ChatFilledIcon, key: "chats" },
  { to: "/status", label: "Updates", icon: StatusIcon },
  { to: "/communities", label: "Communities", icon: CommunitiesIcon, key: "groups" },
  { to: "/app/calls", label: "Calls", icon: Phone, key: "calls" },
];

/* WhatsApp-mobile style bottom tabs. Visible below the `sm` breakpoint only. */
export default function MobileBottomNav() {
  const { counts } = useNavCounts();

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 select-none border-t border-[color:var(--wa-nav-border)] bg-[var(--wa-nav-bg)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {ITEMS.map(({ to, label, end, icon: Icon, key }) => {
        const count = key ? counts[key] : 0;

        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[12px] text-[color:var(--wa-nav-text)]"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`relative grid h-8 w-16 place-items-center rounded-full transition-colors ${
                    isActive ? "bg-[var(--wa-nav-pill)]" : ""
                  }`}
                >
                  <Icon size={23} strokeWidth={isActive ? 2.2 : 1.9} />
                  {count > 0 && (
                    <span className="absolute right-2 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--wa-badge-bg)] px-1 text-[11px] font-semibold leading-none text-[color:var(--wa-badge-fg)]">
                       {count > 99 ? "99+" : count}
                    </span>
                  )}
                 
                </span>
                <span className={isActive ? "font-semibold" : "font-medium"}>{label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}