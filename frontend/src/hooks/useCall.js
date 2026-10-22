import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  // Add TURN before sharing with real users (see notes below):
  // { urls: "turn:YOUR_TURN_HOST:3478", username: "...", credential: "..." },
];

export default function useCall(socket) {
  const [callState, setCallState] = useState("idle"); // idle | incoming | outgoing | active
  const [callInfo, setCallInfo] = useState(null);     // { conversationId, type, isGroup, from? }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [endReason, setEndReason] = useState(null);

  const peers = useRef(new Map());
  const pending = useRef(new Map()); // queued ICE candidates
  const localRef = useRef(null);
  const infoRef = useRef(null);
  const stateRef = useRef("idle");

  const updateInfo = (v) => { infoRef.current = v; setCallInfo(v); };
  const updateState = (v) => { stateRef.current = v; setCallState(v); };

  const cleanup = useCallback(() => {
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    pending.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setMuted(false);
    setCameraOff(false);
    updateInfo(null);
    updateState("idle");
  }, []);

  const removePeer = useCallback((userId) => {
    peers.current.get(userId)?.close();
    peers.current.delete(userId);
    pending.current.delete(userId);
    setRemoteStreams((prev) => {
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const getMedia = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { width: 1280, height: 720 } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeer = useCallback((remoteId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localRef.current.getTracks().forEach((t) => pc.addTrack(t, localRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("call:signal", {
          conversationId: infoRef.current?.conversationId,
          to: remoteId,
          data: { candidate: e.candidate },
        });
      }
    };
    pc.ontrack = (e) => setRemoteStreams((prev) => ({ ...prev, [remoteId]: e.streams[0] }));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") removePeer(remoteId);
    };

    peers.current.set(remoteId, pc);
    return pc;
  }, [socket, removePeer]);

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
            pc = pc ?? createPeer(from);
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call:signal", {
              conversationId, to: from, data: { sdp: pc.localDescription },
            });
          } else if (pc) {
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from, pc);
          }
        } else if (data.candidate) {
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(data.candidate);
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
    socket.emit("call:join", { conversationId: info.conversationId }, async (res) => {
      if (!res?.ok) {
        setEndReason(res?.error ?? "failed");
        return cleanup();
      }
      // I'm the new joiner, so I send an offer to everyone already in the call
      for (const userId of res.participants) {
        const pc = createPeer(userId);
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
    callState, callInfo, localStream, remoteStreams, muted, cameraOff, endReason,
    startCall, acceptCall, declineCall, leaveCall, toggleMute, toggleCamera,
  };
}