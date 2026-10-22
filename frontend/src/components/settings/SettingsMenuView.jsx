import { useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import AvatarButton from "./AvatarButton";
import SettingsMenuItem from "./SettingsMenuItem";
import SettingsSearch from "./SettingsSearch";
import { SCROLL, SETTINGS_ITEMS } from "./constants";

export default function SettingsMenuView({
  info,
  avatar,
  onOpenProfile,
  onLogout,
  onBack, // phone only: back to the chats
}) {
  const [search, setSearch] = useState("");
  const [activeItem, setActiveItem] = useState(null);

  const query = search.trim().toLowerCase();
  const items = SETTINGS_ITEMS.filter(
    (item) =>
      !query ||
      item.label.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-[17px] sm:px-5">
        <div className="flex h-[51px] items-start gap-2">
          {onBack && (
            <button
              type="button"
              aria-label="Back to chats"
              onClick={onBack}
              className="-ml-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)] sm:hidden"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <span className="min-w-0 truncate text-[22px] leading-7">{info.name}</span>
        </div>
        <SettingsSearch value={search} onChange={setSearch} />
      </div>

      {/* Scrollable area (log out is the last row) */}
      <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain ${SCROLL}`}>
        <div className="flex flex-col items-center pb-[63px] pt-8">
          <button
            type="button"
            className="wa-shadow-float relative z-10 h-10 max-w-[calc(100%-32px)] truncate rounded-full bg-[var(--wa-menu-bg)] px-5 text-base leading-10 text-[color:var(--wa-icon)]"
          >
            What&apos;s happening?
            <span className="wa-shadow-float absolute left-[53px] top-9 h-3 w-3 rounded-full bg-[var(--wa-menu-bg)]" />
            <span className="wa-shadow-float absolute left-16 top-[52px] h-2 w-2 rounded-full bg-[var(--wa-menu-bg)]" />
          </button>

          <AvatarButton
            avatar={avatar}
            label="Edit profile"
            onClick={onOpenProfile}
            className="-mt-1.5"
          />
        </div>

        <nav className="px-3 pb-3 sm:px-4" aria-label="Settings">
          {items.map(({ id, label, description, icon }) => (
            <SettingsMenuItem
              key={id}
              icon={icon}
              title={label}
              description={description}
              active={activeItem === id}
              onClick={() => {
                setActiveItem(id);
                if (id === "profile") onOpenProfile();
              }}
            />
          ))}

          {items.length === 0 && (
            <p className="px-5 py-6 text-sm text-[color:var(--wa-text-secondary)]">No settings found.</p>
          )}

          <SettingsMenuItem icon={LogOut} title="Log out" danger onClick={onLogout} />
        </nav>
      </div>
    </div>
  );
}