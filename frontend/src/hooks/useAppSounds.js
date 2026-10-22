import { useMemo, useRef } from "react";
import useSound from "use-sound";

export default function useAppSounds() {
  const [playRingtone, { stop: stopRingtone }] = useSound("/sounds/ringtone.mp3", {
    loop: true,
    volume: 0.8,
  });
  const [playRingback, { stop: stopRingback }] = useSound("/sounds/ringback.mp3", {
    loop: true,
    volume: 0.6,
  });
  const [playMessage] = useSound("/sounds/message.mp3", {
    volume: 0.8,
    interrupt: true, // restart if two messages arrive close together
  });

  // Always point at the latest functions, but expose wrappers that never change
  const latest = useRef({});
  latest.current = {
    playRingtone,
    stopRingtone,
    playRingback,
    stopRingback,
    playMessage,
  };

  return useMemo(
    () => ({
      playRingtone: () => latest.current.playRingtone(),
      stopRingtone: () => latest.current.stopRingtone(),
      playRingback: () => latest.current.playRingback(),
      stopRingback: () => latest.current.stopRingback(),
      playMessage: () => latest.current.playMessage(),
    }),
    []
  );
}