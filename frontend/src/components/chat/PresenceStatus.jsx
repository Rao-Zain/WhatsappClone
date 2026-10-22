import { usePresence } from "../../context/PresenceContext";
import { formatLastSeen } from "../../../lib/Formatlastseen";

/**
 *   <PresenceStatus userId={id} fallback={{ isOnline, lastSeen }} />
 *       -> "online" or "last seen today at 5:42 PM" (chat header)
 *   <PresenceStatus userId={id} variant="dot" className="absolute ..." />
 *       -> small green dot, only while online (avatars in the chat list)
 */
export default function PresenceStatus({ userId, fallback, variant = "text", className = "" }) {
  const { isOnline, lastSeen } = usePresence(userId, fallback);

  if (variant === "dot") {
    if (!isOnline) return null;

    return (
      <span
        role="status"
        aria-label="Online"
        title="Online"
        className={`block size-3 rounded-full border-2 border-[color:var(--wa-presence-ring)] bg-[var(--wa-presence)] ${className}`}
      />
    );
  }

  const label = isOnline ? "online" : formatLastSeen(lastSeen);

  if (!label) return null;

  return <span className={`truncate text-[13px] text-[color:var(--wa-text-secondary)] ${className}`}>{label}</span>;
}