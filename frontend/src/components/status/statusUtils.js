// Background colours for text statuses (the first one is the default).
export const STATUS_COLORS = [
  "#128c7e",
  "#075e54",
  "#25d366",
  "#34b7f1",
  "#7f66ff",
  "#a855f7",
  "#e91e63",
  "#ef4444",
  "#f97316",
  "#ca8a04",
  "#0f172a",
  "#6b7280",
];

export const MAX_STATUS_FILE_BYTES = 30 * 1024 * 1024;

export function initialsOf(name = "") {
  return (
    name
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// "Today, 3:42 PM" / "Yesterday, 9:10 AM" / "12 Oct, 6:05 PM"
export function formatStatusTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const clock = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (date.toDateString() === today.toDateString()) return `Today, ${clock}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${clock}`;

  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${clock}`;
}

// Photo / video check used before uploading.
export function checkStatusFile(file) {
  if (!file) return "Choose a photo or video.";

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return "Only photos and videos can be posted as a status.";
  }

  if (file.size > MAX_STATUS_FILE_BYTES) {
    return "The file must be 30 MB or smaller.";
  }

  return "";
}