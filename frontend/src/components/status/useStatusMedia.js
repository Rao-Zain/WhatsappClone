import { useEffect, useState } from "react";
import api from "../../../lib/api";

/* Status photos and videos are private, so they are fetched with the login token
   and shown from a temporary local address (same approach as chat attachments). */
export default function useStatusMedia(mediaUrl) {
  const [loaded, setLoaded] = useState({ source: null, objectUrl: null, failed: false });

  useEffect(() => {
    if (!mediaUrl) return undefined;

    let cancelled = false;
    let objectUrl = null;

    api
      .get(mediaUrl, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;

        objectUrl = URL.createObjectURL(response.data);
        setLoaded({ source: mediaUrl, objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ source: mediaUrl, objectUrl: null, failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl]);

  const ready = Boolean(mediaUrl) && loaded.source === mediaUrl;

  return {
    url: ready ? loaded.objectUrl : null,
    loading: Boolean(mediaUrl) && !ready,
    failed: ready && loaded.failed,
  };
}