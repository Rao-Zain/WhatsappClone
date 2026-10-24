import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { useAuth } from "./AuthContext";

const NO_COUNTS = { chats: 0, groups: 0, calls: 0 };

const NavCountsContext = createContext({
  counts: NO_COUNTS,
  refreshNavCounts: () => {},
});

/**
 * Real numbers for the navigation badges, read from the server so they are
 * right on every page (chats, settings, ...). They refresh by themselves when
 * messages or groups change; call refreshNavCounts() after something that
 * changes them (for example reading a chat).
 */
export function NavCountsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || user?._id || null;

  // Remember whose numbers these are, so a new login never shows old ones.
  const [stored, setStored] = useState({ userId: null, chats: 0, groups: 0, calls: 0 });
  const timer = useRef(null);
  const requestId = useRef(0);

  const refreshNavCounts = useCallback(() => {
    // Several events often arrive together: wait a moment and ask once.
    clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      const current = ++requestId.current;

      try {
        const response = await api.get("/conversations/unread-summary");

        // Ignore answers that arrive after a newer request was sent.
        if (current !== requestId.current) return;

        const { chats = 0, groups = 0, calls = 0 } = response.data.unread || {};
        setStored({ userId, chats, groups, calls });
      } catch {
        // Keep showing the previous numbers.
      }
    }, 300);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const socket = getSocket();

    refreshNavCounts();

    socket.on("message:new", refreshNavCounts);
    socket.on("conversation:new", refreshNavCounts);
    socket.on("conversation:updated", refreshNavCounts);
    socket.on("conversation:removed", refreshNavCounts);
    socket.on("calls:new", refreshNavCounts);
    window.addEventListener("focus", refreshNavCounts);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      clearTimeout(timer.current);
      socket.off("message:new", refreshNavCounts);
      socket.off("conversation:new", refreshNavCounts);
      socket.off("conversation:updated", refreshNavCounts);
      socket.off("conversation:removed", refreshNavCounts);
      socket.off("calls:new", refreshNavCounts);
      window.removeEventListener("focus", refreshNavCounts);
    };
  }, [userId, refreshNavCounts]);

  const value = useMemo(
    () => ({
      counts:
        userId && stored.userId === userId
          ? { chats: stored.chats, groups: stored.groups, calls: stored.calls } // calls: coming with the calls page
          : NO_COUNTS,
      refreshNavCounts,
    }),
    [userId, stored, refreshNavCounts]
  );

  return <NavCountsContext.Provider value={value}>{children}</NavCountsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNavCounts() {
  return useContext(NavCountsContext);
}