import { useCallback, useEffect, useRef } from "react";
import { getSocket } from "../../lib/socket";

const RESEND_MS = 1; // tell the server again at most this often while typing
const IDLE_MS = 1000;   // no keystroke for this long = stopped typing

/* Sends "I'm typing" to the other people in a chat.
   notifyTyping(): call on every keystroke.  stopTyping(): call when sending, clearing the box, or leaving. */
export default function useTypingEmitter(conversationId) {
  const lastSentAt = useRef(0);
  const idleTimer = useRef(null);
  const active = useRef(false);

  const send = useCallback(
    (isTyping) => {
      if (!conversationId) return;

      const socket = getSocket();

      if (socket.connected) socket.emit("typing", { conversationId, isTyping });
    },
    [conversationId]
  );

  const stopTyping = useCallback(() => {
    clearTimeout(idleTimer.current);

    if (active.current) {
      active.current = false;
      send(false);
    }
  }, [send]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();

    if (!active.current || now - lastSentAt.current > RESEND_MS) {
      active.current = true;
      lastSentAt.current = now;
      send(true);
    }

    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, IDLE_MS);
  }, [send, stopTyping]);

  // Switching chats or closing the window counts as "stopped typing".
  useEffect(() => stopTyping, [stopTyping]);

  return { notifyTyping, stopTyping };
}