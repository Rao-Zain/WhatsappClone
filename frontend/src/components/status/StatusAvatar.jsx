import { Plus } from "lucide-react";
import { initialsOf } from "./statusUtils";

/* Profile picture with the status ring around it.
   segments  = how many status updates the person has (the ring is cut into that many arcs)
   seenCount = how many of them (from the first) you've already seen -> those arcs turn grey
   showPlus  = small "+" badge (used on "My status" when there is nothing posted yet) */
export default function StatusAvatar({ user, size = 52, segments = 0, seenCount = 0, showPlus = false }) {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = segments > 1 ? 4 : 0;
  const arc = segments > 0 ? circumference / segments - gap : 0;
  const inset = segments > 0 ? stroke + 3 : 0;
  const name = user?.name || user?.username || "";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {segments > 0 && (
        <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
          {Array.from({ length: segments }).map((_, index) => (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${arc} ${circumference - arc}`}
              strokeDashoffset={-index * (circumference / segments)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ stroke: index < seenCount ? "var(--wa-border)" : "var(--wa-accent)" }}
            />
          ))}
        </svg>
      )}

      <div className="absolute overflow-hidden rounded-full" style={{ inset }}>
        {user?.profilePicture ? (
          <img src={user.profilePicture} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full select-none place-items-center bg-[var(--wa-avatar-bg)] text-[18px] font-medium text-[color:var(--wa-avatar-fg)]">
            {initialsOf(name)}
          </span>
        )}
      </div>

      {showPlus && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-[color:var(--wa-sidebar-bg)] bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)]">
          <Plus size={12} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}