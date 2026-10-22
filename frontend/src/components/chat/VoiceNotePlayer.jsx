import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";

export default function VoiceNotePlayer({ audioUrl, senderAvatar, senderName, isMe }) {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState("0:00");

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isMe ? "rgba(0, 168, 132, 0.35)" : "rgba(100, 116, 139, 0.35)",
      progressColor: isMe ? "#00a884" : "#34b7f1",
      cursorWidth: 0,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height: 32,
      url: audioUrl,
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("ready", (d) => {
      const mins = Math.floor(d / 60);
      const secs = Math.floor(d % 60);
      setDuration(`${mins}:${secs < 10 ? "0" : ""}${secs}`);
    });

    waveSurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioUrl, isMe]);

  const togglePlay = () => {
    waveSurferRef.current?.playPause();
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[260px] max-w-[320px]">
      {/* Sender Avatar */}
      <div className="relative shrink-0">
        <div className="size-10 overflow-hidden rounded-full bg-slate-200 ring-1 ring-black/10">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-slate-600">
              {(senderName || "U")[0]}
            </div>
          )}
        </div>
      </div>

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-black/5"
      >
        {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
      </button>

      {/* Wavesurfer Container */}
      <div className="flex flex-1 flex-col justify-center">
        <div ref={containerRef} className="w-full" />
        <span className="text-[10px] text-slate-500 mt-0.5">{duration}</span>
      </div>
    </div>
  );
}