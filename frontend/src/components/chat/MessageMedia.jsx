import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Trash2, Video as VideoIcon, ImageOff, Loader2 } from "lucide-react";
import api from "../../../lib/api";

// Remember each file's shape so the bubble keeps its size when it re-mounts
// (switching chats, reloading history) and the chat doesn't jump.
const mediaMeta = new Map(); // fileId -> { ratio, duration }

const MIN_RATIO = 0.75; // tallest a single photo is shown (3:4)
const MAX_RATIO = 1.91; // widest a single photo is shown

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isVideoFile(file) {
  return (file.mimeType || "").startsWith("video/");
}

// Becomes true (and stays true) once the element is near the screen.
function useNearViewport(ref) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, near]);

  return near;
}

// Downloads the files (they need the login token) once the grid is near the
// screen, and hands back usable URLs.
function useMediaUrls(files, enabled) {
  const [urls, setUrls] = useState({});
  const [failed, setFailed] = useState({});
  const key = files.map((file) => file._id).join("|");

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const created = [];

    files.forEach(async (file) => {
      if (file.url) {
        setUrls((prev) => ({ ...prev, [file._id]: file.url }));
        return;
      }
      if (!file.downloadUrl) {
        setFailed((prev) => ({ ...prev, [file._id]: true }));
        return;
      }

      try {
        const response = await api.get(file.downloadUrl, { responseType: "blob" });
        const blobUrl = URL.createObjectURL(response.data);
        created.push(blobUrl);

        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        setUrls((prev) => ({ ...prev, [file._id]: blobUrl }));
      } catch {
        if (!cancelled) setFailed((prev) => ({ ...prev, [file._id]: true }));
      }
    });

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // `key` is the stable identity of the files list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return { urls, failed };
}

function Tile({
  file,
  url,
  failed,
  className = "",
  style,
  onClick,
  onMeta,
  overlay = null,
  canDelete,
  onDelete,
}) {
  const video = isVideoFile(file);
  const meta = mediaMeta.get(file._id);
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(meta?.duration ?? null);

  function remember(patch) {
    const next = { ...(mediaMeta.get(file._id) || {}), ...patch };
    mediaMeta.set(file._id, next);
    onMeta?.(next);
  }

  function handleVideoMetadata(event) {
    const el = event.currentTarget;

    if (el.videoWidth && el.videoHeight) {
      remember({ ratio: el.videoWidth / el.videoHeight });
    }

    // Recorded WebM files report an infinite length until the end is
    // reached. Seeking far ahead forces the browser to work it out.
    if (el.duration === Infinity) {
      const onTime = () => {
        el.removeEventListener("timeupdate", onTime);
        el.currentTime = 0;
        setDuration(el.duration);
        remember({ duration: el.duration });
      };
      el.addEventListener("timeupdate", onTime);
      el.currentTime = 1e101;
      return;
    }

    setDuration(el.duration);
    remember({ duration: el.duration });
  }

  return (
    <div
      className={`group/item relative overflow-hidden bg-[var(--wa-hover)] ${className}`}
      style={style}
    >
      {/* Placeholder while the file loads */}
      {!loaded && !failed && (
        <div className="absolute inset-0 grid animate-pulse place-items-center bg-black/10">
          {video && <Loader2 size={22} className="animate-spin text-white/80" />}
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 grid place-items-center text-[color:var(--wa-icon)]">
          <ImageOff size={26} />
        </div>
      )}

      {url && !failed && (
        <button
          type="button"
          onClick={onClick}
          aria-label={video ? "Play video" : "Open photo"}
          className="absolute inset-0 block h-full w-full cursor-pointer"
        >
          {video ? (
            <video
              // #t shows the first frame on iOS, which skips it otherwise.
              src={`${url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              onLoadedMetadata={handleVideoMetadata}
              onLoadedData={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={url}
              alt={file.originalName || "Photo"}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
                if (w && h) remember({ ratio: w / h });
                setLoaded(true);
              }}
              onError={() => setLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-200 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </button>
      )}

      {/* Video: play button + length, like WhatsApp */}
      {video && loaded && !failed && (
        <>
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
              <Play size={22} className="ml-0.5 fill-current" />
            </span>
          </span>
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white">
            <VideoIcon size={12} className="fill-current" />
            {formatDuration(duration)}
          </span>
        </>
      )}

      {overlay}

      {canDelete && (
        <button
          type="button"
          title="Delete this file"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="absolute right-1.5 top-1.5 z-10 hidden rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-600 group-hover/item:block"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * Photos and videos of one message, laid out like WhatsApp:
 *  1 item  -> keeps its own shape (clamped between portrait and wide)
 *  2 items -> two squares side by side
 *  3 items -> one wide on top, two squares below
 *  4+      -> 2x2 grid, "+N" on the last tile
 *
 * `timeOverlay` is shown on the bottom-right of the media when the message
 * has no caption (the time then sits on the picture, as in WhatsApp).
 */
export default function MessageMedia({
  files,
  timeOverlay = null,
  canDelete = false,
  onDelete,
  onOpen,
}) {
  const wrapperRef = useRef(null);
  const near = useNearViewport(wrapperRef);
  const { urls, failed } = useMediaUrls(files, near);
  const [, forceRender] = useState(0);

  const total = files.length;
  const shown = files.slice(0, 4);
  const extra = total - 4;

  // One slide per file that has loaded, for the full-screen viewer.
  const { slides, indexOfFile } = useMemo(() => {
    const list = [];
    const map = {};

    files.forEach((file) => {
      const src = urls[file._id];
      if (!src) return;

      map[file._id] = list.length;
      const download = { url: src, filename: file.originalName || "download" };

      list.push(
        isVideoFile(file)
          ? {
              type: "video",
              sources: [{ src, type: (file.mimeType || "video/mp4").split(";")[0] }],
              download,
            }
          : { src, alt: file.originalName || "Photo", download }
      );
    });

    return { slides: list, indexOfFile: map };
  }, [files, urls]);

  function open(file) {
    const index = indexOfFile[file._id];
    if (index === undefined) return;
    onOpen?.(slides, index);
  }

  const tileProps = (file) => ({
    file,
    url: urls[file._id],
    failed: failed[file._id],
    onClick: () => open(file),
    onMeta: () => forceRender((n) => n + 1),
    canDelete,
    onDelete: () => onDelete?.(file._id),
  });

  let body;

  if (total === 1) {
    const file = shown[0];
    const ratio = mediaMeta.get(file._id)?.ratio;
    const clamped = ratio ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) : 4 / 3;

    body = (
      <Tile
        {...tileProps(file)}
        className="w-full"
        style={{ aspectRatio: String(clamped) }}
      />
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-[2px]">
        {shown.map((file, index) => {
          const isLast = index === 3 && extra > 0;

          return (
            <Tile
              key={file._id}
              {...tileProps(file)}
              className={
                total === 3 && index === 0 ? "col-span-2 aspect-[16/10]" : "aspect-square"
              }
              overlay={
                isLast ? (
                  <button
                    type="button"
                    onClick={() => open(file)}
                    aria-label={`${extra} more`}
                    className="absolute inset-0 z-[5] grid place-items-center bg-black/55 text-3xl font-light text-white"
                  >
                    +{extra + 1}
                  </button>
                ) : null
              }
            />
          );
        })}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full overflow-hidden rounded-[6px]">
      {body}

      {timeOverlay && (
        <span className="pointer-events-none absolute bottom-0 right-0 z-10 rounded-tl-lg bg-gradient-to-tl from-black/60 to-transparent py-1 pl-6 pr-1.5">
          {timeOverlay}
        </span>
      )}
    </div>
  );
}
