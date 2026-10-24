import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

// Newest first, one entry per call id.
function mergeCalls(first, second) {
  const byId = new Map();
  [...first, ...second].forEach((call) => byId.set(call.id, call));

  return [...byId.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/**
 * The person's call history. It loads the first time `enabled` becomes true
 * (the calls page is opened), loads older calls on request, and adds new calls
 * the moment the server announces them ("calls:new").
 */
export function useCallHistory({ enabled }) {
  const [state, setState] = useState({
    calls: [],
    hasMore: false,
    loaded: false,
    error: "",
    loadingMore: false,
  });

  const started = useRef(false);

  const loadFirstPage = useCallback(async () => {
    started.current = true;

    try {
      const response = await api.get("/calls", { params: { limit: 30 } });

      setState((previous) => ({
        ...previous,
        calls: mergeCalls(previous.calls, response.data.calls || []),
        hasMore: Boolean(response.data.hasMore),
        loaded: true,
        error: "",
      }));
    } catch (err) {
      started.current = false;

      setState((previous) => ({
        ...previous,
        loaded: true,
        error: err.response?.data?.message || "Unable to load your calls.",
      }));
    }
  }, []);

  // First time the calls page is opened.
  useEffect(() => {
    if (enabled && !started.current) loadFirstPage();
  }, [enabled, loadFirstPage]);

  // New calls, live.
  useEffect(() => {
    const socket = getSocket();

    function handleNewCall({ call }) {
      if (!call) return;

      setState((previous) => ({
        ...previous,
        calls: mergeCalls([call], previous.calls),
      }));
    }

    socket.on("calls:new", handleNewCall);

    return () => {
      socket.off("calls:new", handleNewCall);
    };
  }, []);

  const loadMore = useCallback(async () => {
    const oldest = state.calls[state.calls.length - 1];

    if (!oldest || !state.hasMore || state.loadingMore) return;

    setState((previous) => ({ ...previous, loadingMore: true }));

    try {
      const response = await api.get("/calls", {
        params: { limit: 30, before: oldest.id },
      });

      setState((previous) => ({
        ...previous,
        calls: mergeCalls(previous.calls, response.data.calls || []),
        hasMore: Boolean(response.data.hasMore),
        loadingMore: false,
      }));
    } catch {
      setState((previous) => ({ ...previous, loadingMore: false }));
    }
  }, [state.calls, state.hasMore, state.loadingMore]);

  return {
    calls: state.calls,
    hasMore: state.hasMore,
    error: state.error,
    loadingMore: state.loadingMore,
    isLoading: enabled && !state.loaded,
    loadMore,
    reload: loadFirstPage,
  };
}