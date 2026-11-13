import { useEffect, useRef, useState } from "react";
import { ChevronsRight,  Mic,  MicOff,  Phone,  PhoneOff,  Video,  VideoOff,  Volume2,} from "lucide-react";
import useCallAudio from "../../hooks/useCallAudio";
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

function StreamVideo({ stream, muted = false, mirror = false, sinkId, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream;
    // Browsers sometimes block autoplay: ask again.
    element.play?.().catch(() => {});
  }, [stream]);

  // Earpiece / loudspeaker (only where the browser allows choosing)
  useEffect(() => {
    const element = ref.current;
    if (!element || !sinkId || !element.setSinkId) return;

    element.setSinkId(sinkId).catch(() => {});
  }, [sinkId, stream]);

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
            className={`grid size-14 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-16 ${tone}`}
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

              {/* Phone: slide to answer / decline */}
        <div className="flex w-full flex-col items-center gap-4 sm:hidden">
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

      
        {/* Computer: plain buttons */}
        <div className="hidden items-center gap-10 sm:flex">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onDecline}
              aria-label="Decline call"
              className="grid size-16 place-items-center rounded-full bg-[#ea3d3d] text-white transition-colors hover:bg-[#d93232] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <PhoneOff size={26} />
            </button>
            <span className="text-sm text-white/70">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onAccept}
              aria-label="Answer call"
              className="grid size-16 place-items-center rounded-full bg-[#25d366] text-white transition-colors hover:bg-[#1fbd5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {info.type === "video" ? <Video size={26} /> : <Phone size={26} />}
            </button>
            <span className="text-sm text-white/70">Answer</span>
          </div>
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
  avatar,
  getUserName,
  getUserAvatar,
}) {
  const {
    callInfo,
    localStream,
    remoteStreams,
    muted,
    cameraOff,
    reconnecting,
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
  const { speakerOn, canToggleSpeaker, toggleSpeaker, sinkId } = useCallAudio(isVideo);
  const remotes = Object.entries(remoteStreams);
  const single = remotes.length <= 1;

  return (
    // min-h-0 + overflow-hidden: the screen can never grow taller than the window,
    // so the buttons stay visible no matter how big the video is.
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Picture / avatars fill the whole screen; everything else floats on top */}
      <div className="absolute inset-0">
        {isVideo && remotes.length > 0 && (
          <div
            className={`grid size-full gap-2 p-2 ${
              single ? "grid-cols-1 grid-rows-1" : "auto-rows-fr grid-cols-2"
            }`}
          >
            {remotes.map(([userId, stream]) => (
              <div
                key={userId}
                className="relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[#111b21]"
              >
                <StreamVideo
                  stream={stream}
                  sinkId={sinkId}
                  className={`absolute inset-0 size-full ${
                    single ? "object-cover sm:object-contain" : "object-cover"
                  }`}
                />
                <span className="absolute bottom-24 left-3 rounded-full bg-black/50 px-3 py-1 text-sm sm:bottom-28">
                  {getUserName(userId)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Voice call, or a video call that is still connecting */}
        {(!isVideo || remotes.length === 0) && (
          <div className="flex size-full flex-wrap items-center justify-center gap-10 p-6">
            {remotes.length === 0 ? (
              <div className="flex flex-col items-center gap-3">
                <Avatar src={avatar} name={title} pulse />
                <span className="text-[15px] text-white/70">Connecting…</span>
              </div>
            ) : (
              remotes.map(([userId]) => (
                <div key={userId} className="flex flex-col items-center gap-3">
                  <Avatar
                    src={getUserAvatar(userId)}
                    name={getUserName(userId)}
                    size={remotes.length > 1 ? "size-24" : "size-40"}
                    text={remotes.length > 1 ? "text-3xl" : "text-5xl"}
                  />
                  <span className="text-[15px]">{getUserName(userId)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Voice call: these play the other person's voice without showing anything */}
        {!isVideo &&
          remotes.map(([userId, stream]) => (
            <StreamVideo
              key={userId}
              stream={stream}
              sinkId={sinkId}
              className="pointer-events-none absolute size-0 opacity-0"
            />
          ))}
      </div>

      {/* Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-[calc(20px+env(safe-area-inset-top))] text-center">
        <h2 className="max-w-xs truncate text-lg">{title}</h2>
        <p className="text-sm tabular-nums text-white/70">
          {reconnecting ? "Reconnecting…" : formatDuration(seconds)}
        </p>
      </div>

      {/* Local preview */}
      {isVideo && localStream && (
        <div className="absolute bottom-28 right-4 z-10 h-36 w-28 overflow-hidden rounded-xl bg-[#111b21] shadow-xl ring-1 ring-white/20 sm:bottom-32 sm:h-40 sm:w-56">
          <StreamVideo
            stream={localStream}
            muted
            mirror
            className={`size-full object-cover ${cameraOff ? "invisible" : ""}`}
          />
        </div>
      )}

      {/* Controls: pinned to the bottom of the screen */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/60 to-transparent px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-10">
        <div className="flex items-center gap-3 rounded-full bg-[#1f2c34] px-4 py-3 shadow-xl sm:gap-5 sm:px-6">
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

          {canToggleSpeaker && (
            <RoundButton
              onClick={toggleSpeaker}
              label={speakerOn ? "Speaker on (tap for earpiece)" : "Speaker off (tap to turn on)"}
              active={speakerOn}
            >
              <Volume2 size={22} />
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
           className="fixed inset-0 z-[1000] flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white"
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
                    avatar={avatar}
          getUserName={getUserName}
          getUserAvatar={getUserAvatar}
        />
      )}
    </div>
  );
}