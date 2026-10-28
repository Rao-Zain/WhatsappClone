import { useEffect } from "react";

/*
 * Tells the server whether this tab is on screen AND focused.
 * While it is, the server skips Web Push for this user (they see messages live);
 * the moment it is hidden, minimised or closed, pushes start arriving.
 */
export default function useAppState(socket) {
  useEffect(() => {
    if (!socket) return;

    const report = () =>
      socket.emit("app:state", {
        active: document.visibilityState === "visible" && document.hasFocus(),
      });

    const reportInactive = () => socket.emit("app:state", { active: false });

    // A new connection starts as "not active" on the server, so say so again.
    socket.on("connect", report);
    if (socket.connected) report();

    document.addEventListener("visibilitychange", report);
    window.addEventListener("focus", report);
    window.addEventListener("blur", report);
    window.addEventListener("pagehide", reportInactive);

    return () => {
      socket.off("connect", report);
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("focus", report);
      window.removeEventListener("blur", report);
      window.removeEventListener("pagehide", reportInactive);
    };
  }, [socket]);
}