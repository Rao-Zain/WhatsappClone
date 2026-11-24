import { Phone, Video, PhoneMissed } from "lucide-react";

function duration(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function CallMessage({ message }) {
  const isMe = message.sender === "me";
  const c = message.call || {};
  const kind = c.callType === "video" ? "video" : "voice";
  const missed = !c.answered && !isMe;

  let title = isMe ? `${kind[0].toUpperCase()}${kind.slice(1)} call` : `${kind[0].toUpperCase()}${kind.slice(1)} call`;
  let sub = c.answered
    ? duration(c.durationSeconds || 0)
    : isMe
      ? c.endReason === "rejected" ? "Declined" : "No answer"
      : "";
  if (missed) title = `Missed ${kind} call`;

  const Icon = missed ? PhoneMissed : c.callType === "video" ? Video : Phone;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`wa-shadow-bubble flex min-w-[190px] items-center gap-3 rounded-lg px-3 py-2 ${isMe ? "bg-[var(--wa-bubble-out-bg)]" : "bg-[var(--wa-bubble-in-bg)]"}`}>
        <span className={`grid size-9 place-items-center rounded-full ${missed ? "bg-red-500/15 text-red-500" : "bg-black/10"}`}>
          <Icon size={18} />
        </span>
        <div className="flex-1">
          <div className={`text-[14.5px] ${missed ? "text-red-500" : ""}`}>{title}</div>
          {sub && <div className="text-[12.5px] opacity-70">{sub}</div>}
        </div>
        <span className="self-end text-[11px] opacity-60">{message.time}</span>
      </div>
    </div>
  );
}