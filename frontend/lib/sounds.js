import useSound from "use-sound";

const [playRingtone, { stop: stopRingtone }] = useSound("/sounds/ringtone.mp3", {
  loop: true,
  volume: 0.8,
});
const [playMessage] = useSound("/sounds/message.mp3", { volume: 0.8 });