import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

/* The status feed: my own updates + updates from the people I chat with.
   Refreshes itself when somebody posts, deletes or views a status. */
export default function useStatuses() {
  const [mine, setMine] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const load = useCallback(
    () =>
      api
        .get("/statuses")
        .then((response) => {
          setMine(response.data.mine || []);
          setContacts(response.data.contacts || []);
          setError("");
        })
        .catch((err) => {
          setError(err.response?.data?.message || "Unable to load status updates.");
        })
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();

    const socket = getSocket();

    // Several events can arrive together: wait a moment and ask once.
    const reloadSoon = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 300);
    };

    // Statuses last 24 hours: drop the ones that ran out while the app was open.
    const sweep = setInterval(() => {
      const now = Date.now();
      const alive = (status) => new Date(status.expiresAt).getTime() > now;

      setMine((list) => (list.every(alive) ? list : list.filter(alive)));
      setContacts((list) =>
        list
          .map((group) => ({ ...group, statuses: group.statuses.filter(alive) }))
          .filter((group) => group.statuses.length > 0)
      );
    }, 60 * 1000);

    socket.on("status:changed", reloadSoon);
    socket.on("status:viewed", reloadSoon);
    socket.on("connect", load);

    return () => {
      clearTimeout(timer.current);
      clearInterval(sweep);
      socket.off("status:changed", reloadSoon);
      socket.off("status:viewed", reloadSoon);
      socket.off("connect", load);
    };
  }, [load]);

  // Called when I look at somebody's status.
  const markViewed = useCallback((userId, statusId) => {
    api.post(`/statuses/${statusId}/view`).catch(() => {});

    setContacts((list) =>
      list.map((group) => {
        if (group.user._id !== userId) return group;

        const statuses = group.statuses.map((status) =>
          status.id === statusId ? { ...status, viewed: true } : status
        );

        return { ...group, statuses, allViewed: statuses.every((status) => status.viewed) };
      })
    );
  }, []);

  // payload: { text, backgroundColor }  or  { file, caption }
  const postStatus = useCallback(
    async (payload, onProgress) => {
      if (payload.file) {
        const form = new FormData();
        form.append("file", payload.file);
        if (payload.caption) form.append("caption", payload.caption);

        await api.post("/statuses", form, {
          onUploadProgress: (event) => {
            if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
          },
        });
      } else {
        await api.post("/statuses", {
          text: payload.text,
          backgroundColor: payload.backgroundColor,
        });
      }

      await load();
    },
    [load]
  );

  const removeStatus = useCallback(async (statusId) => {
    await api.delete(`/statuses/${statusId}`);
    setMine((list) => list.filter((status) => status.id !== statusId));
  }, []);

  return { mine, contacts, loading, error, reload: load, markViewed, postStatus, removeStatus };
}