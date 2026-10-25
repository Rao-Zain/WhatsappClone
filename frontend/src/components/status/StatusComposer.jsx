import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, Send, X } from "lucide-react";
import { STATUS_COLORS } from "./statusUtils";

/* Full-screen "new status" editor.
   media = null                      -> text status (type words, pick a colour)
   media = { file, previewUrl }      -> photo / video status (add a caption)
   onPost(payload, onProgress) must return a promise. */
export default function StatusComposer({ media, onClose, onPost }) {
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    if (busy) return;

    if (!media && !text.trim()) {
      setError("Write something first.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setProgress(0);

      await onPost(
        media
          ? { file: media.file, caption: caption.trim() }
          : { text: text.trim(), backgroundColor: STATUS_COLORS[colorIndex] },
        setProgress
      );

      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to post your status. Please try again.");
      setBusy(false);
    }
  }

  const isVideo = media?.file.type.startsWith("video/");
  const roundButton =
    "grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-50";
  const sendButton =
    "grid size-14 shrink-0 place-items-center rounded-full bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)] shadow-lg transition-transform active:scale-95 disabled:opacity-60";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col text-white"
      style={{ background: media ? "#000" : STATUS_COLORS[colorIndex] }}
      role="dialog"
      aria-modal="true"
      aria-label="New status"
    >
      {busy && media && (
        <div className="absolute inset-x-0 top-0 h-1 bg-white/25">
          <div className="h-full bg-white transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[calc(12px+env(safe-area-inset-top))]">
        <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className={roundButton}>
          <X size={24} />
        </button>

        {!media && (
          <button
            type="button"
            aria-label="Change background colour"
            title="Change colour"
            onClick={() => setColorIndex((value) => (value + 1) % STATUS_COLORS.length)}
            className={roundButton}
          >
            <Palette size={22} />
          </button>
        )}
      </div>

      {media ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {isVideo ? (
            <video src={media.previewUrl} controls playsInline className="max-h-full max-w-full" />
          ) : (
            <img src={media.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6">
          <textarea
            autoFocus
            value={text}
            maxLength={700}
            rows={Math.min(8, Math.max(1, text.split("\n").length, Math.ceil(text.length / 18)))}
            onChange={(event) => {
              setText(event.target.value);
              setError("");
            }}
            placeholder="Type a status"
            aria-label="Status text"
            style={{ fontSize: text.length > 120 ? 20 : text.length > 40 ? 26 : 34 }}
            className="w-full max-w-[520px] resize-none bg-transparent text-center font-medium leading-snug text-white outline-none placeholder:text-white/60"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-black/50 px-3 py-2 text-center text-sm">
          {error}
        </p>
      )}

      <div className="flex shrink-0 items-center gap-3 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2">
        {media ? (
          <input
            value={caption}
            maxLength={700}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a caption…"
            aria-label="Caption"
            className="h-12 min-w-0 flex-1 rounded-full bg-white/15 px-5 text-white outline-none placeholder:text-white/60"
          />
        ) : (
          <span className="flex-1" />
        )}

        <button type="button" aria-label="Post status" title="Post" onClick={submit} disabled={busy} className={sendButton}>
          <Send size={22} />
        </button>
      </div>
    </div>,
    document.body
  );
}