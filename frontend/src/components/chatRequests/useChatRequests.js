import { useCallback, useEffect, useState } from "react";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

/* Loads chat requests and keeps them live over the socket.
   incoming: people asking to chat with me (pending)
   outgoing: requests I sent (pending, or recently declined) */
export default function useChatRequests() {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api
        .get("/chat-requests")
        .then((response) => {
          setIncoming(response.data.incoming || []);
          setOutgoing(response.data.outgoing || []);
          setError("");
        })
        .catch((err) => {
          setError(err.response?.data?.message || "Unable to load chat requests.");
        })
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();

    const socket = getSocket();

    const upsert = (list, request) => [
      request,
      ...list.filter((item) => item.id !== request.id),
    ];

    function handleNew({ direction, request }) {
      if (!request) return;

      if (direction === "incoming") setIncoming((list) => upsert(list, request));
      else setOutgoing((list) => upsert(list, request));
    }

    function handleUpdated({ id, status }) {
      // Answered requests leave the incoming list.
      setIncoming((list) => list.filter((item) => item.id !== id));

      setOutgoing((list) =>
        status === "accepted"
          ? list.filter((item) => item.id !== id)
          : list.map((item) => (item.id === id ? { ...item, status } : item))
      );
    }

    function handleRemoved({ id }) {
      setIncoming((list) => list.filter((item) => item.id !== id));
      setOutgoing((list) => list.filter((item) => item.id !== id));
    }

    // Catch up on anything missed while the connection was down.
    socket.on("connect", load);
    socket.on("chat-request:new", handleNew);
    socket.on("chat-request:updated", handleUpdated);
    socket.on("chat-request:removed", handleRemoved);

    return () => {
      socket.off("connect", load);
      socket.off("chat-request:new", handleNew);
      socket.off("chat-request:updated", handleUpdated);
      socket.off("chat-request:removed", handleRemoved);
    };
  }, [load]);

  // action: "accept" | "reject". Returns the server response data.
  const respond = useCallback(async (id, action) => {
    const response = await api.post(`/chat-requests/${id}/respond`, { action });
    setIncoming((list) => list.filter((item) => item.id !== id));
    return response.data;
  }, []);

  const cancel = useCallback(async (id) => {
    await api.delete(`/chat-requests/${id}`);
    setOutgoing((list) => list.filter((item) => item.id !== id));
  }, []);

  return { incoming, outgoing, loading, error, respond, cancel, reload: load };
}