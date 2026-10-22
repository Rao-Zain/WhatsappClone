function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// "last seen today at 5:42 PM", "last seen yesterday at ...", etc.
export function formatLastSeen(value, now = new Date()) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(date)) / 86400000
  );

  if (dayDiff <= 0) return `last seen today at ${time}`;
  if (dayDiff === 1) return `last seen yesterday at ${time}`;

  if (dayDiff < 7) {
    const weekday = date.toLocaleDateString([], { weekday: "long" });
    return `last seen ${weekday} at ${time}`;
  }

  const day = date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `last seen ${day}`;
}