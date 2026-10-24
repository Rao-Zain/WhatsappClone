import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Phone, RefreshCw, Video } from "lucide-react";
import PanelSearch from "../sidebar/PanelSearch";
import MobileBottomNav from "../sidebar/MobileBottomNav";
import { callKind, describeCall, formatCallDay, formatClock, formatDuration, initialsOf } from "./callUtils";

const ASIDE =
  "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--wa-sidebar-bg)] text-[color:var(--wa-text-primary)]";

function CallRow({ call, selected, onSelect, onCall, canCall }) {
  const { label, isMissed } = describeCall(call);
  const ArrowIcon = call.direction === "outgoing" ? ArrowUpRight : ArrowDownLeft;
  const CallIcon = call.type === "video" ? Video : Phone;

  return (
    <div className="shrink-0 sm:px-2.5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(call)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(call);
        }}
        className={`flex h-[72px] w-full cursor-pointer items-center gap-3.5 px-4 text-left outline-none transition-colors sm:rounded-xl sm:px-3 ${
          selected ? "bg-[var(--wa-row-active)]" : "hover:bg-[var(--wa-row-hover)]"
        }`}
      >
        {call.chat.avatar ? (
          <img src={call.chat.avatar} alt="" className="size-[49px] shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-[49px] shrink-0 select-none place-items-center rounded-full bg-[var(--wa-avatar-bg)] text-[18px] font-medium text-[color:var(--wa-avatar-fg)]">
            {initialsOf(call.chat.name)}
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
          <span
            className={`truncate text-[17px] leading-[21px] ${
              isMissed ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-text-primary)]"
            }`}
          >
            {call.chat.name}
          </span>

          <span className="flex min-w-0 items-center gap-1 text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
            <ArrowIcon
              size={15}
              strokeWidth={2.4}
              className={`shrink-0 ${isMissed ? "text-[color:var(--wa-danger)]" : "text-[color:var(--wa-accent)]"}`}
            />
            <span className="truncate">
              {label} · {formatCallDay(call.startedAt)}, {formatClock(call.startedAt)}
              {call.outcome === "answered" && call.durationSeconds > 0 && ` · ${formatDuration(call.durationSeconds)}`}
            </span>
          </span>
        </div>

        <button
          type="button"
          disabled={!canCall}
          title={`Call back (${callKind(call)})`}
          aria-label={`Call ${call.chat.name} again`}
          onClick={(event) => {
            event.stopPropagation();
            onCall(call.chat.id, call.type);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] transition-colors hover:bg-[var(--wa-hover)] disabled:opacity-40"
        >
          <CallIcon size={20} />
        </button>
      </div>
    </div>
  );
}

/**
 * Left panel of the calls page: filter, search and the list of calls.
 * `history` is the object returned by useCallHistory().
 */
export default function CallsSidebar({ history, selectedCallId, onSelect, onCall, canCall }) {
  const [filter, setFilter] = useState("all"); // "all" | "missed"
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();

  const visible = history.calls.filter(
    (call) =>
      (filter === "all" || call.outcome === "missed") &&
      (!needle || call.chat.name.toLowerCase().includes(needle))
  );

  const pill = (active) =>
    `rounded-full border px-3.5 py-1 text-[14px] transition-colors ${
      active
        ? "border-transparent bg-[var(--wa-accent)] text-white"
        : "border-[color:var(--wa-border)] text-[color:var(--wa-text-secondary)] hover:bg-[var(--wa-hover)]"
    }`;

  return (
    <aside className={ASIDE}>
      <header className="flex h-[65px] shrink-0 select-none items-center px-4 sm:px-5">
        <h1 className="text-[22px] font-bold leading-none">Calls</h1>
      </header>

      <PanelSearch value={search} onChange={setSearch} placeholder="Search name" autoFocus={false} />

      <div className="flex shrink-0 gap-2 px-4 pb-2 sm:px-5">
        <button type="button" className={pill(filter === "all")} onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button" className={pill(filter === "missed")} onClick={() => setFilter("missed")}>
          Missed
        </button>
      </div>

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
        {history.isLoading && (
          <p className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Loading calls...
          </p>
        )}

        {!history.isLoading && history.error && (
          <div className="px-6 py-10 text-center text-sm">
            <p role="alert" className="text-[color:var(--wa-danger)]">
              {history.error}
            </p>
            <button type="button" onClick={history.reload} className="mt-3 font-medium text-[color:var(--wa-accent)] hover:underline">
              Try again
            </button>
          </div>
        )}

        {!history.isLoading && !history.error && visible.length === 0 && (
          <p className="px-8 py-10 text-center text-sm text-[color:var(--wa-text-secondary)]">
            {history.calls.length === 0
              ? "No calls yet. Start a voice or video call from any chat."
              : needle
                ? "No calls match your search."
                : "No missed calls."}
          </p>
        )}

        {visible.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            selected={call.id === selectedCallId}
            onSelect={onSelect}
            onCall={onCall}
            canCall={canCall}
          />
        ))}

        {history.hasMore && !history.error && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              disabled={history.loadingMore}
              onClick={history.loadMore}
              className="rounded-full px-4 py-1.5 text-[14px] font-medium text-[color:var(--wa-accent)] hover:bg-[var(--wa-hover)] disabled:opacity-60"
            >
              {history.loadingMore ? "Loading..." : "Load older calls"}
            </button>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </aside>
  );
}