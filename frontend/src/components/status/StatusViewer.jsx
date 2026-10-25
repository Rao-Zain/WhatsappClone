import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, Trash2, X } from "lucide-react";
import api from "../../../lib/api";
import StatusAvatar from "./StatusAvatar";
import useStatusMedia from "./useStatusMedia";
import { formatStatusTime } from "./statusUtils";

const SLIDE_MS = 5000; // how long a text or photo status stays on screen
const HOLD_MS = 220;   // pressing longer than this pauses instead of "tapping"

const firstUnseen = (group) => {
  const index = group.statuses.findIndex((status) => !status.viewed);
  return group.isMine || index < 0 ? 0 : index;
};

// Bigger letters for short texts.
const fontSizeFor = (text) =>
  text.length <= 40 ? 34 : text.length <= 120 ? 26 : text.length <= 300 ? 20 : 16;

/* ---------------- Who viewed my status ---------------- */
function ViewersSheet({ statusId, onClose }) {
  const [state, setState] = useState({ id: null, viewers: [], error: "" });

  useEffect(() => {
    let cancelled = false;

    api
      .get(`/statuses/${statusId}/viewers`)
      .then((response) => {
        if (!cancelled) setState({ id: statusId, viewers: response.data.viewers || [], error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            id: statusId,
            viewers: [],
            error: err.response?.data?.message || "Unable to load the viewers.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusId]);

  const loading = state.id !== statusId;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 max-h-[65%] overflow-hidden rounded-t-2xl bg-[var(--wa-modal-bg)] text-[color:var(--wa-text-primary)]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="text-[16px] font-medium">{loading ? "Viewed by" : `Viewed by ${state.viewers.length}`}</h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full hover:bg-[var(--wa-hover)]"
        >
          <X size={20} />
        </button>
      </div>

      <div className="whatsapp-scrollbar max-h-[50vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {loading && <p className="px-5 py-6 text-center text-sm text-[color:var(--wa-text-secondary)]">Loading…</p>}

        {state.error && (
          <p role="alert" className="px-5 py-6 text-center text-sm text-[color:var(--wa-danger)]">
            {state.error}
          </p>
        )}

        {!loading && !state.error && state.viewers.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-[color:var(--wa-text-secondary)]">No views yet.</p>
        )}

        {state.viewers.map(({ user, viewedAt }) => (
          <div key={user._id} className="flex items-center gap-3 px-5 py-2.5">
            <StatusAvatar user={user} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">{user.name || user.username}</p>
              <p className="text-[13px] text-[color:var(--wa-text-secondary)]">{formatStatusTime(viewedAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- One status on screen (re-created for every status) ---------------- */
function Slide({ status, index, segments, paused, onDone }) {
  const [progress, setProgress] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const media = useStatusMedia(status.type === "text" ? null : status.mediaUrl);
  const videoRef = useRef(null);
  const pausedRef = useRef(paused);
  const doneRef = useRef(onDone);

  // The timer below reads the latest values without being restarted.
  useEffect(() => {
    pausedRef.current = paused;
    doneRef.current = onDone;
  });

  const ready = status.type === "text" || (status.type === "image" && imageReady);

  // Text and photo: a 5-second timer that stands still while paused.
  useEffect(() => {
    if (!ready) return undefined;

    let frame;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now) => {
      if (!pausedRef.current) elapsed += now - last;
      last = now;

      const value = Math.min(elapsed / SLIDE_MS, 1);
      setProgress(value);

      if (value >= 1) {
        doneRef.current();
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [ready]);

  // Video: pause / resume with the hold gesture.
  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused, media.url]);

  return (
    <div className="absolute inset-0 bg-black">
      {/* progress bars */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-2 pt-[calc(8px+env(safe-area-inset-top))]">
        {Array.from({ length: segments }).map((_, position) => (
          <span key={position} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
            <span
              className="block h-full bg-white"
              style={{ width: `${(position < index ? 1 : position === index ? progress : 0) * 100}%` }}
            />
          </span>
        ))}
      </div>

      {status.type === "text" && (
        <div
          className="flex h-full items-center justify-center px-8 text-center"
          style={{ background: status.backgroundColor }}
        >
          <p
            className="whitespace-pre-wrap break-words font-medium leading-snug text-white"
            style={{ fontSize: fontSizeFor(status.text) }}
          >
            {status.text}
          </p>
        </div>
      )}

      {status.type !== "text" && (
        <div className="flex h-full items-center justify-center">
          {media.loading && <p className="text-sm text-white/70">Loading…</p>}
          {media.failed && <p className="px-6 text-center text-sm text-white/80">Unable to load this status.</p>}

          {media.url && status.type === "image" && (
            <img
              src={media.url}
              alt=""
              onLoad={() => setImageReady(true)}
              className="h-full w-full object-contain"
            />
          )}

          {media.url && status.type === "video" && (
            <video
              ref={videoRef}
              src={media.url}
              autoPlay
              playsInline
              onTimeUpdate={(event) => {
                const { currentTime, duration } = event.currentTarget;
                if (duration) setProgress(currentTime / duration);
              }}
              onEnded={() => doneRef.current()}
              className="h-full w-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- The full-screen viewer ----------------
   groups: [{ user, statuses, isMine? }]  (one entry per person, in the order they play)
   The viewer keeps its own position; the parent keeps `groups` up to date. */
export default function StatusViewer({ groups, startGroup = 0, startIndex = 0, onClose, onViewed, onDelete }) {
  const [position, setPosition] = useState({ group: startGroup, index: startIndex });
  const [holding, setHolding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const press = useRef({ timer: null, held: false });

  const group = groups[position.group];
  const index = group ? Math.min(position.index, group.statuses.length - 1) : 0;
  const status = group?.statuses[index];
  const paused = holding || sheetOpen;

  // Nothing left to show (e.g. the last status was deleted).
  useEffect(() => {
    if (!status) onClose();
  }, [status, onClose]);

  // Opening somebody else's status counts as a view.
  useEffect(() => {
    if (status && group && !group.isMine && !status.viewed) onViewed?.(group.user._id, status.id);
  }, [status, group, onViewed]);

  const next = useCallback(() => {
    if (!group) return;

    if (index < group.statuses.length - 1) {
      setPosition({ group: position.group, index: index + 1 });
    } else if (position.group < groups.length - 1) {
      setPosition({ group: position.group + 1, index: firstUnseen(groups[position.group + 1]) });
    } else {
      onClose();
    }
  }, [group, groups, index, position.group, onClose]);

  const previous = useCallback(() => {
    if (index > 0) setPosition({ group: position.group, index: index - 1 });
    else if (position.group > 0) setPosition({ group: position.group - 1, index: 0 });
  }, [index, position.group]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        if (sheetOpen) setSheetOpen(false);
        else onClose();
      } else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, onClose, sheetOpen]);

  // Hold = pause. Quick tap on the left third = back, anywhere else = next.
  function handlePointerDown() {
    press.current.held = false;
    clearTimeout(press.current.timer);
    press.current.timer = setTimeout(() => {
      press.current.held = true;
      setHolding(true);
    }, HOLD_MS);
  }

  function handlePointerUp(event) {
    clearTimeout(press.current.timer);

    if (press.current.held) {
      press.current.held = false;
      setHolding(false);
      return;
    }

    const box = event.currentTarget.getBoundingClientRect();

    if (event.clientX - box.left < box.width * 0.3) previous();
    else next();
  }

  function handlePointerCancel() {
    clearTimeout(press.current.timer);

    if (press.current.held) {
      press.current.held = false;
      setHolding(false);
    }
  }

  async function handleDelete() {
    if (!status || !window.confirm("Delete this status update?")) return;

    try {
      await onDelete?.(status.id);
    } catch {
      window.alert("Unable to delete this status. Please try again.");
    }
  }

  if (!status) return null;

  const isMine = Boolean(group.isMine);
  const chevron =
    "absolute top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 sm:grid";

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Status">
      {/* desktop arrows */}
      <button type="button" aria-label="Previous" onClick={previous} className={`${chevron} left-6`}>
        <ChevronLeft size={26} />
      </button>
      <button type="button" aria-label="Next" onClick={next} className={`${chevron} right-6`}>
        <ChevronRight size={26} />
      </button>

      <div className="relative mx-auto h-full w-full overflow-hidden bg-black sm:max-w-[440px]">
        <Slide
          key={status.id}
          status={status}
          index={index}
          segments={group.statuses.length}
          paused={paused}
          onDone={next}
        />

        {/* tap zones: they sit under the buttons */}
        <div
          className="absolute inset-0 z-[5] touch-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
        />

        {/* header */}
        <div className="absolute inset-x-0 top-[calc(20px+env(safe-area-inset-top))] z-10 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-2">
          <StatusAvatar user={group.user} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">
              {isMine ? "My status" : group.user.name || group.user.username}
            </p>
            <p className="text-[12px] text-white/75">{formatStatusTime(status.createdAt)}</p>
          </div>

          {isMine && (
            <button
              type="button"
              aria-label="Delete status"
              title="Delete"
              onClick={handleDelete}
              className="grid size-10 place-items-center rounded-full hover:bg-white/15"
            >
              <Trash2 size={20} />
            </button>
          )}

          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full hover:bg-white/15"
          >
            <X size={22} />
          </button>
        </div>

        {/* caption */}
        {status.caption && (
          <p
            className={`absolute inset-x-0 z-10 whitespace-pre-wrap break-words bg-gradient-to-t from-black/70 to-transparent px-6 pb-4 pt-10 text-center text-[16px] ${
              isMine ? "bottom-14" : "bottom-0"
            }`}
          >
            {status.caption}
          </p>
        )}

        {/* my own status: who has seen it */}
        {isMine && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-black/40 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 text-[14px]"
          >
            <Eye size={18} /> {status.viewerCount ?? 0}
          </button>
        )}

        {sheetOpen && <ViewersSheet statusId={status.id} onClose={() => setSheetOpen(false)} />}
      </div>
    </div>,
    document.body
  );
}