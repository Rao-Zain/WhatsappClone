import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";

// Used only when the server can't give us TURN details. STUN alone is NOT enough:
// on mobile data, office Wi-Fi and many home routers the two phones can't reach each
// other directly, so the call "sometimes works and sometimes doesn't".
const FALLBACK_ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const ICE_CACHE_MS = 30 * 60 * 1000; // TURN logins from the server last 1 hour
const DISCONNECT_GRACE_MS = 3000;    // wait this long before treating "disconnected" as a problem
const RETRY_EVERY_MS = 8000;         // while a connection is broken, try to repair it this often
const MAX_ICE_RESTARTS = 3;          // then give up

let iceCache = { servers: null, loadedAt: 0 };

// STUN + TURN servers from our backend (GET /api/calls/ice-servers).
async function loadIceServers() {
  if (iceCache.servers && Date.now() - iceCache.loadedAt < ICE_CACHE_MS) {
    return iceCache.servers;
  }

  try {
    const { data } = await api.get("/calls/ice-servers");

    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      iceCache = { servers: data.iceServers, loadedAt: Date.now() };
      return data.iceServers;
    }
  } catch {
    /* fall back to STUN only */
  }

  return FALLBACK_ICE_SERVERS;
}

export default function useCall(socket) {
  const [callState, setCallState] = useState("idle"); // idle | incoming | outgoing | active
  const [callInfo, setCallInfo] = useState(null);     // { conversationId, type, isGroup, from? }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [endReason, setEndReason] = useState(null);

  const peers = useRef(new Map());
  const peerMeta = useRef(new Map());    // userId -> { isOfferer, restarts, timer }
  const remoteMedia = useRef(new Map()); // userId -> MediaStream (when the browser gives none)
  const trouble = useRef(new Set());     // people whose connection is currently struggling
  const pending = useRef(new Map());     // queued ICE candidates
  const localRef = useRef(null);
  const infoRef = useRef(null);
  const stateRef = useRef("idle");
  const iceRef = useRef(FALLBACK_ICE_SERVERS);

  const updateInfo = (v) => { infoRef.current = v; setCallInfo(v); };
  const updateState = (v) => { stateRef.current = v; setCallState(v); };
  const updateReconnecting = () => setReconnecting(trouble.current.size > 0);

  // Get the TURN details ready before the first call.
  useEffect(() => {
    if (!socket) return;

    loadIceServers().then((servers) => {
      iceRef.current = servers;
    });
  }, [socket]);

  const clearPeerState = (userId) => {
    clearTimeout(peerMeta.current.get(userId)?.timer);
    peerMeta.current.delete(userId);
    remoteMedia.current.delete(userId);
    trouble.current.delete(userId);
    pending.current.delete(userId);
  };

  const cleanup = useCallback(() => {
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    [...peerMeta.current.keys()].forEach(clearPeerState);
    trouble.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setMuted(false);
    setCameraOff(false);
    setReconnecting(false);
    updateInfo(null);
    updateState("idle");
  }, []);

  const removePeer = useCallback((userId) => {
    peers.current.get(userId)?.close();
    peers.current.delete(userId);
    clearPeerState(userId);
    updateReconnecting();
    setRemoteStreams((prev) => {
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const getMedia = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video:
        type === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeer = useCallback((remoteId, isOfferer) => {
    const pc = new RTCPeerConnection({
      iceServers: iceRef.current,
      iceCandidatePoolSize: 2,
      bundlePolicy: "max-bundle",
    });

    peerMeta.current.set(remoteId, { isOfferer, restarts: 0, timer: null });
    localRef.current.getTracks().forEach((t) => pc.addTrack(t, localRef.current));

    // The connection broke for good: end the call if nobody is left.
    const giveUp = () => {
      removePeer(remoteId);

      if (peers.current.size === 0) {
        socket.emit("call:leave");
        setEndReason("The connection was lost. Please try calling again.");
        cleanup();
      }
    };

    // Ask both phones to find a new network path (new WebRTC offer with iceRestart).
    const restartIce = async () => {
      const meta = peerMeta.current.get(remoteId);

      if (!meta || peers.current.get(remoteId) !== pc) return;
      if (pc.connectionState === "connected" || pc.connectionState === "closed") return;
      if (meta.restarts >= MAX_ICE_RESTARTS) return giveUp();

      meta.restarts += 1;

      try {
        pc.restartIce?.();
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit("call:signal", {
          conversationId: infoRef.current?.conversationId,
          to: remoteId,
          data: { sdp: pc.localDescription },
        });
      } catch (error) {
        console.error("ICE restart failed:", error);
      }

      // Still not connected after a while? Try again.
      clearTimeout(meta.timer);
      meta.timer = setTimeout(restartIce, RETRY_EVERY_MS);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("call:signal", {
          conversationId: infoRef.current?.conversationId,
          to: remoteId,
          data: { candidate: e.candidate },
        });
      }
    };

    pc.ontrack = (e) => {
      // Some browsers give no stream with the track: build one ourselves.
      let stream = e.streams[0];

      if (!stream) {
        stream = remoteMedia.current.get(remoteId) ?? new MediaStream();
        stream.addTrack(e.track);
      }

      remoteMedia.current.set(remoteId, stream);
      setRemoteStreams((prev) => ({ ...prev, [remoteId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      const meta = peerMeta.current.get(remoteId);
      if (!meta || peers.current.get(remoteId) !== pc) return;

      clearTimeout(meta.timer);

      if (pc.connectionState === "connected") {
        meta.restarts = 0;
        trouble.current.delete(remoteId);
        updateReconnecting();
      } else if (pc.connectionState === "disconnected") {
        // Often fixes itself in a second or two (e.g. switching Wi-Fi to mobile data).
        trouble.current.add(remoteId);
        updateReconnecting();
        meta.timer = setTimeout(restartIce, DISCONNECT_GRACE_MS);
      } else if (pc.connectionState === "failed") {
        trouble.current.add(remoteId);
        updateReconnecting();
        restartIce();
      }
    };

    peers.current.set(remoteId, pc);
    return pc;
  }, [socket, removePeer, cleanup]);

  const flushCandidates = async (userId, pc) => {
    for (const c of pending.current.get(userId) ?? []) {
      try { await pc.addIceCandidate(c); } catch (e) { console.error(e); }
    }
    pending.current.delete(userId);
  };

  // ---------- Socket events ----------
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (info) => {
      if (stateRef.current !== "idle") return; // server also guards busy users
      setEndReason(null);
      updateInfo(info);
      updateState("incoming");
    };

    const onUserJoined = ({ conversationId }) => {
      if (conversationId !== infoRef.current?.conversationId) return;
      updateState("active"); // the joiner will send us an offer
    };

    const onUserLeft = ({ conversationId, userId }) => {
      if (conversationId === infoRef.current?.conversationId) removePeer(userId);
    };

    const onEnded = ({ conversationId, reason }) => {
      if (conversationId !== infoRef.current?.conversationId) return;
      setEndReason(reason);
      cleanup();
    };

    const onSignal = async ({ conversationId, from, data }) => {
      if (conversationId !== infoRef.current?.conversationId || !localRef.current) return;
      let pc = peers.current.get(from);
      try {
        if (data.sdp) {
          if (data.sdp.type === "offer") {
            pc = pc ?? createPeer(from, false);

            // Both sides sent an offer at the same moment: the one who started
            // the connection wins, the other steps back and accepts.
            const collision = pc.signalingState !== "stable";
            if (collision && peerMeta.current.get(from)?.isOfferer) return;
            if (collision) await pc.setLocalDescription({ type: "rollback" });

            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call:signal", {
              conversationId, to: from, data: { sdp: pc.localDescription },
            });
          } else if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from, pc);
          }
        } else if (data.candidate) {
          if (pc?.remoteDescription) {
            // Old candidates from before a restart can be refused: that's fine.
            await pc.addIceCandidate(data.candidate).catch(() => {});
          } else {
            pending.current.set(from, [...(pending.current.get(from) ?? []), data.candidate]);
          }
        }
      } catch (err) {
        console.error("Signal error:", err);
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:user-joined", onUserJoined);
    socket.on("call:user-left", onUserLeft);
    socket.on("call:ended", onEnded);
    socket.on("call:signal", onSignal);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:user-joined", onUserJoined);
      socket.off("call:user-left", onUserLeft);
      socket.off("call:ended", onEnded);
      socket.off("call:signal", onSignal);
    };
  }, [socket, createPeer, removePeer, cleanup]);

  // ---------- Actions ----------
  const startCall = useCallback(async (conversationId, type) => {
    if (stateRef.current !== "idle") return;
    setEndReason(null);
    try {
      await getMedia(type);
    } catch {
      setEndReason("media-denied");
      return;
    }
    iceRef.current = await loadIceServers();
    socket.emit("call:start", { conversationId, type }, (res) => {
      if (!res?.ok) {
        setEndReason(res?.error ?? "failed");
        return cleanup();
      }
      updateInfo(res.call);
      updateState("outgoing");
    });
  }, [socket, cleanup]);

  const acceptCall = useCallback(async () => {
    const info = infoRef.current;
    if (!info) return;
    try {
      await getMedia(info.type);
    } catch {
      setEndReason("media-denied");
      socket.emit("call:reject", { conversationId: info.conversationId });
      return cleanup();
    }
    iceRef.current = await loadIceServers();
    socket.emit("call:join", { conversationId: info.conversationId }, async (res) => {
      if (!res?.ok) {
        setEndReason(res?.error ?? "failed");
        return cleanup();
      }
      // I'm the new joiner, so I send an offer to everyone already in the call
      for (const userId of res.participants) {
        const pc = createPeer(userId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:signal", {
          conversationId: info.conversationId,
          to: userId,
          data: { sdp: pc.localDescription },
        });
      }
      updateState("active");
    });
  }, [socket, createPeer, cleanup]);

  const declineCall = useCallback(() => {
    const info = infoRef.current;
    if (info) socket.emit("call:reject", { conversationId: info.conversationId });
    cleanup();
  }, [socket, cleanup]);

  const leaveCall = useCallback(() => {
    socket.emit("call:leave");
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = () => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  };

  return {
    callState, callInfo, localStream, remoteStreams, muted, cameraOff, reconnecting, endReason,
    startCall, acceptCall, declineCall, leaveCall, toggleMute, toggleCamera,
  };
}