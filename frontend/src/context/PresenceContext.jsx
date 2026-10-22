import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { getSocket } from "../../lib/socket";

/**
 * Small external store: one socket listener for the whole app, and each
 * component re-renders only when the user it displays changes.
 */
function createPresenceStore() {
  const entries = new Map(); // userId -> { isOnline, lastSeen }
  const listeners = new Map(); // userId -> Set<callback>

  function set(userId, next) {
    const previous = entries.get(userId);

    const entry = {
      isOnline: Boolean(next.isOnline),
      lastSeen: next.lastSeen ?? previous?.lastSeen ?? null,
    };

    if (
      previous &&
      previous.isOnline === entry.isOnline &&
      previous.lastSeen === entry.lastSeen
    ) {
      return;
    }

    entries.set(userId, entry);
    listeners.get(userId)?.forEach((callback) => callback());
  }

  function subscribe(userId, callback) {
    const set = listeners.get(userId) || new Set();

    set.add(callback);
    listeners.set(userId, set);

    return () => {
      set.delete(callback);
      if (set.size === 0) listeners.delete(userId);
    };
  }

  return {
    get: (userId) => entries.get(userId),
    set,
    subscribe,
  };
}

const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  const [store] = useState(createPresenceStore);

  useEffect(() => {
    const socket = getSocket();

    // Sent by the server on every (re)connection.
    function handleSnapshot(list) {
      for (const item of list || []) {
        store.set(String(item.userId), item);
      }
    }

    // Sent only when a contact goes online or offline.
    function handleUpdate(payload) {
      if (!payload?.userId) return;
      store.set(String(payload.userId), payload);
    }

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [store]);

  return (
    <PresenceContext.Provider value={store}>
      {children}
    </PresenceContext.Provider>
  );
}

/**
 * usePresence(userId, fallback)
 * fallback = { isOnline, lastSeen } from the API, used until live data arrives.
 */
export function usePresence(userId, fallback) {
  const store = useContext(PresenceContext);
  const id = userId ? String(userId) : "";

  const subscribe = useCallback(
    (callback) => (store && id ? store.subscribe(id, callback) : () => {}),
    [store, id]
  );

  const getSnapshot = useCallback(
    () => (store && id ? store.get(id) : undefined),
    [store, id]
  );

  const live = useSyncExternalStore(subscribe, getSnapshot);

  return {
    isOnline: live ? live.isOnline : Boolean(fallback?.isOnline),
    lastSeen: live?.lastSeen ?? fallback?.lastSeen ?? null,
  };
}