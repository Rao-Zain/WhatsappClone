import { useEffect, useRef, useState } from "react";
import {
  ChevronsRight,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const initialsOf = (name = "") =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

function Avatar({ src, name, size = "size-40", text = "text-5xl", pulse = false }) {
  return (
    <div className={`relative grid shrink-0 place-items-center ${size}`}>
      {pulse && (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-white/10 [animation-duration:2.4s]" />
          <span className="absolute -inset-4 rounded-full border border-white/10" />
          <span className="absolute -inset-9 rounded-full border border-white/5" />
        </>
      )}
      {src ? (
        <img
          src={src}
          alt=""
          className="relative size-full rounded-full object-cover ring-4 ring-white/10"
        />
      ) : (
        <span
          className={`relative grid size-full place-items-center rounded-full bg-[#6b7c85] font-light text-white ring-4 ring-white/10 ${text}`}
        >
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}

function StreamVideo({ stream, muted = false, mirror = false, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  // A <video> element also plays audio-only streams, so it covers voice calls too
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function RoundButton({ onClick, label, active = false, danger = false, children }) {
  const tone = danger
    ? "bg-[#ea3d3d] text-white hover:bg-[#d93232]"
    : active
      ? "bg-white text-[#111b21] hover:bg-white/90"
      : "bg-white/15 text-white hover:bg-white/25";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-14 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${tone}`}
    >
      {children}
    </button>
  );
}

/**
 * Slide-to-confirm control. Drag the knob to the end of the track to trigger
 * onComplete. Releasing early snaps it back. Enter/Space also triggers it, so
 * it still works with a keyboard.
 */
function SlideButton({ label, onComplete, tone, icon: Icon }) {
  const KNOB = 56;
  const PAD = 4;
  const TRIGGER_AT = 0.85;

  const trackRef = useRef(null);
  const startX = useRef(0);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const maxOffset = () =>
    Math.max(0, (trackRef.current?.offsetWidth ?? 0) - KNOB - PAD * 2);

  const handlePointerDown = (event) => {
    if (done) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX - x;
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    setX(Math.min(maxOffset(), Math.max(0, event.clientX - startX.current)));
  };

  const finish = () => {
    setDone(true);
    setX(maxOffset());
    onComplete();
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (maxOffset() > 0 && x / maxOffset() >= TRIGGER_AT) finish();
    else setX(0);
  };

  const progress = maxOffset() ? x / maxOffset() : 0;

  const styles =
    tone === "accept"
      ? { track: "bg-[#25d366]/20", knob: "bg-[#25d366]", fill: "bg-[#25d366]/30" }
      : { track: "bg-[#ea3d3d]/20", knob: "bg-[#ea3d3d]", fill: "bg-[#ea3d3d]/30" };

  return (
    <div
      ref={trackRef}
      className={`relative h-16 w-full max-w-sm select-none overflow-hidden rounded-full ${styles.track}`}
    >
      {/* Fill that follows the knob */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${styles.fill} ${
          dragging ? "" : "transition-[width] duration-200"
        }`}
        style={{ width: x + KNOB + PAD * 2 }}
      />

      {/* Label fades as the knob moves */}
      <span
        className="absolute inset-0 flex items-center justify-center gap-1 pl-12 text-[15px] text-white/90"
        style={{ opacity: Math.max(0, 1 - progress * 1.6) }}
      >
        {label}
        <ChevronsRight size={18} className="animate-pulse" />
      </span>

      {/* Knob */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!done) finish();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute grid cursor-grab touch-none place-items-center rounded-full text-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing ${styles.knob} ${
          dragging ? "" : "transition-transform duration-200"
        }`}
        style={{
          width: KNOB,
          height: KNOB,
          top: PAD,
          left: PAD,
          transform: `translateX(${x}px)`,
        }}
      >
        <Icon size={24} className={tone === "decline" ? "rotate-[135deg]" : ""} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function IncomingScreen({ info, title, avatar, callerName, onAccept, onDecline }) {
  const kind = info.type === "video" ? "video" : "voice";

  return (
    <div className="flex flex-1 flex-col items-center justify-between px-6 pb-12 pt-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="max-w-xs truncate text-3xl font-light">{title}</h2>
        <p className="text-[15px] text-white/70">
          {info.isGroup
            ? `${callerName} is inviting you to a group ${kind} call`
            : `WhatsApp ${kind} call`}
        </p>
      </div>

      <Avatar src={avatar} name={title} pulse />

      <div className="flex w-full flex-col items-center gap-4">
        <SlideButton
          label="Slide to answer"
          tone="accept"
          icon={info.type === "video" ? Video : Phone}
          onComplete={onAccept}
        />
        <SlideButton
          label="Slide to decline"
          tone="decline"
          icon={Phone}
          onComplete={onDecline}
        />
      </div>
    </div>
  );
}

function OutgoingScreen({ info, title, avatar, onCancel }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-between px-6 pb-12 pt-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="max-w-xs truncate text-3xl font-light">{title}</h2>
        <p className="text-[15px] text-white/70">
          {info.type === "video" ? "Video calling…" : "Calling…"}
        </p>
      </div>

      <Avatar src={avatar} name={title} pulse />

      <RoundButton onClick={onCancel} label="Cancel call" danger>
        <PhoneOff size={24} />
      </RoundButton>
    </div>
  );
}

function formatDuration(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function ActiveScreen({
  call,
  title,
  getUserName,
  getUserAvatar,
}) {
  const {
    callInfo,
    localStream,
    remoteStreams,
    muted,
    cameraOff,
    leaveCall,
    toggleMute,
    toggleCamera,
  } = call;

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const isVideo = callInfo.type === "video";
  const remotes = Object.entries(remoteStreams);
  const columns = remotes.length > 1 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Header */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-6 text-center">
        <h2 className="max-w-xs truncate text-lg">{title}</h2>
        <p className="text-sm tabular-nums text-white/70">{formatDuration(seconds)}</p>
      </div>

      {/* Participants */}
      {isVideo ? (
        <div className={`grid min-h-0 flex-1 gap-2 p-2 ${columns}`}>
          {remotes.map(([userId, stream]) => (
            <div
              key={userId}
              className="relative min-h-0 overflow-hidden rounded-2xl bg-[#111b21]"
            >
              <StreamVideo stream={stream} className="size-full object-cover" />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-sm">
                {getUserName(userId)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-10 p-6">
          {remotes.map(([userId, stream]) => (
            <div key={userId} className="flex flex-col items-center gap-3">
              <Avatar
                src={getUserAvatar(userId)}
                name={getUserName(userId)}
                size={remotes.length > 1 ? "size-24" : "size-40"}
                text={remotes.length > 1 ? "text-3xl" : "text-5xl"}
              />
              <span className="text-[15px]">{getUserName(userId)}</span>
              {/* Keeps the remote audio playing without showing anything */}
              <StreamVideo stream={stream} className="absolute size-0 opacity-0" />
            </div>
          ))}
        </div>
      )}

      {/* Local preview */}
      {isVideo && localStream && (
        <div className="absolute bottom-28 right-4 h-36 w-28 overflow-hidden rounded-xl bg-[#111b21] shadow-xl ring-1 ring-white/20 sm:h-40 sm:w-32">
          <StreamVideo
            stream={localStream}
            muted
            mirror
            className={`size-full object-cover ${cameraOff ? "invisible" : ""}`}
          />
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 flex justify-center pb-8 pt-4">
        <div className="flex items-center gap-4 rounded-full bg-[#1f2c34] px-5 py-3 shadow-xl">
          <RoundButton
            onClick={toggleMute}
            label={muted ? "Unmute" : "Mute"}
            active={muted}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </RoundButton>

          {isVideo && (
            <RoundButton
              onClick={toggleCamera}
              label={cameraOff ? "Turn camera on" : "Turn camera off"}
              active={cameraOff}
            >
              {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </RoundButton>
          )}

          <RoundButton onClick={leaveCall} label="End call" danger>
            <PhoneOff size={22} />
          </RoundButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

export default function CallOverlay({
  call,
  getUserName,
  getCallTitle,
  getCallAvatar = () => "",
  getUserAvatar = () => "",
}) {
  const { callState, callInfo, acceptCall, declineCall, leaveCall } = call;

  if (callState === "idle" || !callInfo) return null;

  const title = getCallTitle(callInfo.conversationId);
  const avatar = getCallAvatar(callInfo.conversationId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${callInfo.type} call`}
      className="fixed inset-0 z-[1000] flex flex-col bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white"
    >
      {callState === "incoming" && (
        <IncomingScreen
          info={callInfo}
          title={title}
          avatar={avatar}
          callerName={getUserName(callInfo.from)}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {callState === "outgoing" && (
        <OutgoingScreen
          info={callInfo}
          title={title}
          avatar={avatar}
          onCancel={leaveCall}
        />
      )}

      {callState === "active" && (
        <ActiveScreen
          call={call}
          title={title}
          getUserName={getUserName}
          getUserAvatar={getUserAvatar}
        />
      )}
    </div>
  );
}