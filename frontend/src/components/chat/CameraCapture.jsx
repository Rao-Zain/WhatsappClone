import { useCallback, useEffect, useRef, useState } from "react";
import { X, SwitchCamera, Send, RotateCcw, Loader2 } from "lucide-react";

// Pick the best video container this browser can record.
// MP4 plays everywhere (iOS included), so it is preferred over WebM.
function pickVideoMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Full-screen camera: take a photo or record a video, review it, add a
 * caption and send. `onSend(file, caption)` must return a promise.
 * `onFallback()` is called when the live camera can't be used, so the
 * parent can open the device's native camera instead.
 */
export default function CameraCapture({
  onClose,
  onSend,
  onFallback,
  uploadProgress = 0,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordedSecondsRef = useRef(0);

  const [mode, setMode] = useState("photo"); // "photo" | "video"
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [canFlip, setCanFlip] = useState(false);

  // After capture: { file, url, kind }
  const [captured, setCaptured] = useState(null);
  const [caption, setCaption] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Start (or restart) the camera whenever the facing side or mode changes.
  // Audio is requested only in video mode, so taking a photo never asks
  // for microphone permission.
  useEffect(() => {
    if (captured) return undefined;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    setError("");

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: mode === "video",
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stopStream();
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser settings."
            : err?.name === "NotFoundError"
              ? "No camera was found on this device."
              : "Could not start the camera."
        );
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [facing, mode, captured, stopStream]);

  // Release camera, recorder and timer when the screen closes.
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.onstop = null;
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      stopStream();
    },
    [stopStream]
  );

  // Revoke the review URL when it is replaced or the screen closes.
  useEffect(
    () => () => {
      if (captured?.url) URL.revokeObjectURL(captured.url);
    },
    [captured]
  );

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !ready || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // The front camera preview is mirrored; save what the person saw.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the photo. Please try again.");
          return;
        }
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopStream();
        setCaptured({ file, url: URL.createObjectURL(file), kind: "image" });
      },
      "image/jpeg",
      0.92
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !ready || isRecording) return;

    if (typeof MediaRecorder === "undefined") {
      setError("Video recording isn't supported by this browser.");
      return;
    }

    const mimeType = pickVideoMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError("Video recording isn't supported by this browser.");
      return;
    }

    chunksRef.current = [];
    recordedSecondsRef.current = 0;

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearInterval(timerRef.current);
      setIsRecording(false);

      const actual = recorder.mimeType || mimeType || "video/webm";
      // Strip codec parameters so the server's MIME check accepts it.
      const baseType = actual.split(";")[0];
      const blob = new Blob(chunksRef.current, { type: baseType });

      if (!blob.size || recordedSecondsRef.current < 1) {
        setError("Recording was too short. Hold the button a little longer.");
        return;
      }

      const extension = baseType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video-${Date.now()}.${extension}`, {
        type: baseType,
      });

      stopStream();
      setCaptured({ file, url: URL.createObjectURL(file), kind: "video" });
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setError("");
    setSeconds(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      recordedSecondsRef.current += 1;
      setSeconds(recordedSecondsRef.current);
    }, 1000);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function handleShutter() {
    if (mode === "photo") takePhoto();
    else if (isRecording) stopRecording();
    else startRecording();
  }

  function retake() {
    setCaptured(null);
    setCaption("");
    setSendError("");
    setSeconds(0);
  }

  async function handleSend() {
    if (!captured || isSending) return;
    setIsSending(true);
    setSendError("");

    try {
      await onSend(captured.file, caption.trim());
      onClose();
    } catch (err) {
      setSendError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to send. Please try again."
      );
      setIsSending(false);
    }
  }

  const btn =
    "grid size-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition active:scale-95 disabled:opacity-40";

  /* ---------------------------- Review screen ---------------------------- */
  if (captured) {
    return (
      <div className="fixed inset-0 z-[100] flex h-dvh flex-col bg-black text-white">
        <div className="relative min-h-0 flex-1">
          {captured.kind === "image" ? (
            <img
              src={captured.url}
              alt="Captured"
              className="h-full w-full object-contain"
            />
          ) : (
            <video
              src={captured.url}
              controls
              playsInline
              autoPlay
              loop
              className="h-full w-full object-contain"
            />
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={retake}
              disabled={isSending}
              aria-label="Retake"
              title="Retake"
              className={btn}
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              aria-label="Discard"
              title="Discard"
              className={btn}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="bg-black px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          {sendError && (
            <p className="mb-2 px-2 text-xs text-red-400">{sendError}</p>
          )}
          {isSending && (
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[var(--wa-accent,#00a884)] transition-[width] duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Add a caption"
              aria-label="Caption"
              disabled={isSending}
              className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-[15px] text-white outline-none placeholder:text-white/60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              aria-label="Send"
              title="Send"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--wa-accent,#00a884)] text-white transition active:scale-95 disabled:opacity-60"
            >
              {isSending ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Send size={21} fill="currentColor" className="-translate-x-px" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------- Live camera ------------------------------ */
  return (
    <div className="fixed inset-0 z-[100] flex h-dvh flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-cover"
          style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
        />

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 size={30} className="animate-spin text-white/70" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-xs text-center">
              <p className="text-sm text-white/90">{error}</p>
              {onFallback && (
                <button
                  type="button"
                  onClick={onFallback}
                  className="mt-4 rounded-full bg-[var(--wa-accent,#00a884)] px-5 py-2 text-sm font-medium text-white"
                >
                  Use device camera
                </button>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            title="Close"
            className={btn}
          >
            <X size={22} />
          </button>

          {isRecording && (
            <span className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-medium tabular-nums backdrop-blur">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              {formatTime(seconds)}
            </span>
          )}

          <button
            type="button"
            onClick={() =>
              setFacing((side) => (side === "environment" ? "user" : "environment"))
            }
            disabled={!canFlip || isRecording}
            aria-label="Switch camera"
            title="Switch camera"
            className={`${btn} ${canFlip ? "" : "invisible"}`}
          >
            <SwitchCamera size={21} />
          </button>
        </div>
      </div>

      <div className="bg-black pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 flex justify-center gap-6 text-sm font-medium">
          {["photo", "video"].map((value) => (
            <button
              key={value}
              type="button"
              disabled={isRecording}
              onClick={() => setMode(value)}
              className={`px-2 py-1 capitalize transition ${
                mode === value ? "text-white" : "text-white/50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleShutter}
            disabled={!ready}
            aria-label={
              mode === "photo"
                ? "Take photo"
                : isRecording
                  ? "Stop recording"
                  : "Start recording"
            }
            className="grid size-[74px] place-items-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40"
          >
            {mode === "photo" ? (
              <span className="size-[56px] rounded-full bg-white" />
            ) : isRecording ? (
              <span className="size-7 rounded-md bg-red-500" />
            ) : (
              <span className="size-[56px] rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
