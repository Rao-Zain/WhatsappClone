import { useEffect, useState } from "react";
import { isMobileNow } from "./useIsMobile";

// Output devices whose names look like these are the phone's earpiece / loudspeaker.
const EARPIECE = /earpiece|receiver|handset/i;
const SPEAKER = /speaker/i;

// Picks the earpiece and the loudspeaker out of the browser's list of audio outputs.
export function pickOutputs(devices) {
  const outputs = devices.filter((device) => device.kind === "audiooutput");

  const earpiece = outputs.find((device) => EARPIECE.test(device.label));

  const speaker =
    outputs.find((device) => SPEAKER.test(device.label) && !EARPIECE.test(device.label)) ||
    outputs.find((device) => device.deviceId === "default" && !EARPIECE.test(device.label));

  return { earpiece, speaker };
}

/* Where the other person's voice comes out of: the earpiece (default for voice
   calls, private) or the loudspeaker (default for video calls, like WhatsApp).

   Websites cannot always control this, it depends on the browser:
   - Chrome / Edge (Android and computers): we pick the output device by name
     (setSinkId). Works only if the phone lists an earpiece and a speaker.
   - Safari (iPhone): we tell the system "this is a phone call" (audioSession).
   - Others (e.g. Firefox): the phone decides. Then `canToggleSpeaker` is false
     and the speaker button is not shown.
   Only phones get the button: on a computer there is nothing to switch. */
export default function useCallAudio(isVideo) {
  const [speakerOn, setSpeakerOn] = useState(isVideo);
  const [outputs, setOutputs] = useState({});

  const onPhone = isMobileNow();
  const hasSink =
    typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  const hasSession = typeof navigator !== "undefined" && "audioSession" in navigator;

  // Look for the earpiece and the speaker (and again when headphones are plugged in).
  useEffect(() => {
    if (!onPhone || !hasSink || !navigator.mediaDevices?.enumerateDevices) return undefined;

    let cancelled = false;

    const refresh = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (!cancelled) setOutputs(pickOutputs(devices));
        })
        .catch(() => {});

    refresh();
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
    };
  }, [onPhone, hasSink]);

  const canRouteBySink = onPhone && hasSink && Boolean(outputs.earpiece && outputs.speaker);
  const canRouteBySession = onPhone && hasSession && !canRouteBySink;

  // Safari: "play-and-record" = phone call (earpiece), "playback" = loudspeaker.
  useEffect(() => {
    if (!canRouteBySession) return undefined;

    try {
      navigator.audioSession.type = speakerOn ? "playback" : "play-and-record";
    } catch {
      /* not supported: ignore */
    }

    return () => {
      try {
        navigator.audioSession.type = "auto";
      } catch {
        /* ignore */
      }
    };
  }, [canRouteBySession, speakerOn]);

  return {
    speakerOn,
    canToggleSpeaker: canRouteBySink || canRouteBySession,
    toggleSpeaker: () => setSpeakerOn((value) => !value),
    // Used by the <video> elements that play the other person's voice.
    sinkId: canRouteBySink
      ? speakerOn
        ? outputs.speaker.deviceId
        : outputs.earpiece.deviceId
      : undefined,
  };
}