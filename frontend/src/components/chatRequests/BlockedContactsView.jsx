import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../../lib/api";
import PanelHeader from "../sidebar/PanelHeader";
import Avatar from "./Avatar";

export default function BlockedContactsView({ onBack, onUnblocked }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/blocks")
      .then((response) => {
        if (!cancelled) setUsers(response.data.users || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Unable to load blocked contacts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function unblock(user) {
    if (busyId) return;

    try {
      setBusyId(user._id);
      setError("");
      await api.delete(`/blocks/${user._id}`);
      setUsers((list) => list.filter((item) => item._id !== user._id));
      onUnblocked?.(user._id);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to unblock this contact.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="Blocked contacts" onBack={onBack} />

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Loading...
          </div>
        )}

        {error && (
          <p role="alert" className="px-6 py-3 text-center text-sm text-[color:var(--wa-danger)]">
            {error}
          </p>
        )}

        {!loading && !error && users.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
            You have not blocked anyone.
          </p>
        )}

        {users.map((user) => (
          <div key={user._id} className="flex items-center gap-3.5 px-4 py-3">
            <Avatar user={user} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                {user.name || user.username}
              </p>
              <p className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">
                @{user.username}
              </p>
            </div>

            <button
              type="button"
              disabled={busyId === user._id}
              onClick={() => unblock(user)}
              className="inline-flex h-9 items-center rounded-full border border-[color:var(--wa-border)] px-4 text-[14px] font-medium text-[color:var(--wa-accent)] transition-colors hover:bg-[var(--wa-menu-hover)] disabled:opacity-50"
            >
              Unblock
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}