import { ArrowDownLeft, ArrowUpRight, MessageCircle, Phone, Video } from "lucide-react";
import { callKind, describeCall, formatCallDay, formatClock, formatDuration, initialsOf } from "./callUtils";

/**
 * Right side of the calls page: details of the selected call and every call
 * with the same person / group.
 */
export default function CallsMain({ call, calls, onCall, onMessage, canCall }) {
  if (!call) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--wa-chat-bg)] px-8 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]">
          <Phone size={34} />
        </span>
        <h2 className="text-[22px] font-light text-[color:var(--wa-text-primary)]">Calls</h2>
        <p className="max-w-sm text-[14px] text-[color:var(--wa-text-secondary)]">
          Select a call to see its details. To start a new call, open any chat and use the voice or video button.
        </p>
      </div>
    );
  }

  const related = calls.filter((item) => item.chat.id === call.chat.id);

  const actionButton =
    "flex flex-col items-center gap-1.5 rounded-xl px-5 py-3 text-[13px] text-[color:var(--wa-text-primary)] transition-colors hover:bg-[var(--wa-hover)] disabled:opacity-40";

  return (
    <div className="whatsapp-scrollbar h-full overflow-y-auto bg-[var(--wa-chat-bg)] px-6 py-10">
      <div className="mx-auto flex max-w-xl flex-col items-center">
        {call.chat.avatar ? (
          <img src={call.chat.avatar} alt="" className="size-[110px] rounded-full object-cover" />
        ) : (
          <span className="grid size-[110px] select-none place-items-center rounded-full bg-[var(--wa-avatar-bg)] text-[38px] font-medium text-[color:var(--wa-avatar-fg)]">
            {initialsOf(call.chat.name)}
          </span>
        )}

        <h2 className="mt-4 max-w-full truncate text-[24px] text-[color:var(--wa-text-primary)]">{call.chat.name}</h2>
        <p className="text-[14px] text-[color:var(--wa-text-secondary)]">{call.isGroup ? "Group" : "Contact"}</p>

        <div className="mt-5 flex gap-2">
          <button type="button" className={actionButton} onClick={() => onMessage(call.chat.id)}>
            <MessageCircle size={22} />
            Message
          </button>
          <button type="button" className={actionButton} disabled={!canCall} onClick={() => onCall(call.chat.id, "audio")}>
            <Phone size={22} />
            Voice
          </button>
          <button type="button" className={actionButton} disabled={!canCall} onClick={() => onCall(call.chat.id, "video")}>
            <Video size={22} />
            Video
          </button>
        </div>

        <section className="mt-8 w-full overflow-hidden rounded-xl border border-[color:var(--wa-border)] bg-[var(--wa-sidebar-bg)]">
          <h3 className="px-5 pb-1 pt-4 text-[14px] text-[color:var(--wa-text-secondary)]">Call history</h3>

          {related.map((item) => {
            const { label, isMissed } = describeCall(item);
            const ArrowIcon = item.direction === "outgoing" ? ArrowUpRight : ArrowDownLeft;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 border-t border-[color:var(--wa-border)] px-5 py-3 first:border-t-0 ${
                  item.id === call.id ? "bg-[var(--wa-row-active)]" : ""
                }`}
              >
                <ArrowIcon
                  size={18}
                  strokeWidth={2.4}
                  className={`shrink-0 ${isMissed ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-accent)]"}`}
                />

                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] ${isMissed ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-text-primary)]"}`}>
                    {callKind(item)} · {label}
                  </p>
                  <p className="text-[13px] text-[color:var(--wa-text-secondary)]">
                    {formatCallDay(item.startedAt)}, {formatClock(item.startedAt)}
                    {item.isGroup && item.outcome === "answered" && ` · ${item.participantCount} people`}
                  </p>
                </div>

                <span className="shrink-0 text-[13px] text-[color:var(--wa-text-secondary)]">
                  {item.outcome === "answered" ? formatDuration(item.durationSeconds) : ""}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}