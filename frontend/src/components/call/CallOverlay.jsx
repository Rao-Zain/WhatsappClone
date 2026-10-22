import { useEffect, useRef } from "react";

function StreamVideo({ stream, muted = false, mirror = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  // A <video> element also plays audio-only streams, so this covers voice calls too
  return (
    <video ref={ref} autoPlay playsInline muted={muted}
      style={{
        width: "100%", height: "100%", objectFit: "cover",
        transform: mirror ? "scaleX(-1)" : "none", background: "#111"
      }} />
  );
}

export default function CallOverlay({ call, getUserName, getCallTitle }) {
  const { callState, callInfo, localStream, remoteStreams, muted, cameraOff,
    acceptCall, declineCall, leaveCall, toggleMute, toggleCamera } = call;

  if (callState === "idle") return null;

  const remotes = Object.entries(remoteStreams);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0b141a", color: "#fff",
      zIndex: 1000, display: "flex", flexDirection: "column"
    }}>
      {callState === "incoming" && (
        <div style={{ margin: "auto", textAlign: "center" }}>
          <h2>{getCallTitle(callInfo.conversationId)}</h2>
          <p>
            {callInfo.isGroup ? `${getUserName(callInfo.from)} is starting a ` : "Incoming "}
            {callInfo.type} call…
          </p>
          <button className="bg-green-500 py-2 px-5 text-white rounded" onClick={acceptCall}>Accept</button>{" "}
          <button className="bg-red-500 py-2 px-5 text-white rounded" onClick={declineCall}>Decline</button>
        </div>
      )}

      {callState === "outgoing" && (
        <div style={{ margin: "auto", textAlign: "center" }}>
          <p>Calling…</p>
          <button className="bg-red-500 py-2 px-5 text-white rounded" onClick={leaveCall}>Cancel</button>
        </div>
      )}

      {callState === "active" && (
        <>
          <div style={{
            flex: 1, display: "grid", gap: 8, padding: 8,
            gridTemplateColumns: `repeat(${remotes.length > 1 ? 2 : 1}, 1fr)`
          }}>
            {remotes.map(([userId, stream]) => (
              <div key={userId} style={{ position: "relative", minHeight: 0 }}>
                <StreamVideo stream={stream} />
                <span style={{ position: "absolute", left: 8, bottom: 8 }}>{getUserName(userId)}</span>
              </div>
            ))}
          </div>

          {/* Local preview */}
          {callInfo.type === "video" && (
            <div style={{ position: "absolute", right: 16, bottom: 90, width: 160, height: 120 }}>
              <StreamVideo stream={localStream} muted mirror />
            </div>
          )}

          <div style={{ padding: 16, textAlign: "center" }}>
            <button className="bg-blue-500 py-2 px-5 text-white rounded" onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>{" "}
            {callInfo.type === "video" && (
              <button className="bg-blue-500 py-2 px-5 text-white rounded" onClick={toggleCamera}>{cameraOff ? "Camera on" : "Camera off"}</button>
            )}{" "}
            <button className="bg-red-500 py-2 px-5 text-white rounded" onClick={leaveCall}>End</button>
          </div>
        </>
      )}
    </div>
  );
}