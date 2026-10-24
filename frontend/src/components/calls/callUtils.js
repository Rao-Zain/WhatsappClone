export const initialsOf = (name = "") =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

// 75 -> "1:15", 3725 -> "1:02:05"
export function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export function formatClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "Today", "Yesterday", a weekday for the last week, otherwise the date.
export function formatCallDay(value) {
  const date = new Date(value);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "long" });

  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// What to print for a call and whether it should be shown in red.
export function describeCall(call) {
  const { direction, outcome } = call;

  if (outcome === "missed") return { label: "Missed", isMissed: true };
  if (outcome === "declined") return { label: "Declined", isMissed: false };
  if (outcome === "no-answer") return { label: "No answer", isMissed: false };

  return { label: direction === "outgoing" ? "Outgoing" : "Incoming", isMissed: false };
}

// "Voice call" / "Video call" / "Group voice call" ...
export function callKind(call) {
  const kind = call.type === "video" ? "Video" : "Voice";
  return call.isGroup ? `Group ${kind.toLowerCase()} call` : `${kind} call`;
}