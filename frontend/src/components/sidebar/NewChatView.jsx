import { useEffect, useState } from "react";
import { RefreshCw, UserRound } from "lucide-react";
import api from "../../../lib/api";
import PanelHeader from "./PanelHeader";
import PanelSearch from "./PanelSearch";

export default function NewChatView({ onBack, onSelectUser }) {
  const [phone, setPhone] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = phone.trim();

    setUsers([]);
    setError("");

    if (value.replace(/\D/g, "").length < 7) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.get("/conversations/search-users", { params: { phone: value } });
        if (!cancelled) setUsers(response.data.users || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Unable to search users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  const searched = phone.trim().replace(/\D/g, "").length >= 7;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="New chat" onBack={onBack} />

      <PanelSearch
        type="tel"
        value={phone}
        onChange={setPhone}
        placeholder="Search by phone number"
        onEscape={onBack}
      />

      <p className="shrink-0 px-6 pb-2 text-[12px] text-[color:var(--wa-text-secondary)]">
        Enter full phone number with country code.
      </p>

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Searching contacts...
          </div>
        )}

        {!loading && error && (
          <p role="alert" className="px-6 py-6 text-center text-sm text-[color:var(--wa-danger)]">
            {error}
          </p>
        )}

        {!loading && !error && searched && users.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
            No WhatsApp account found for this phone number.
          </p>
        )}

        {!loading &&
          users.map((user) => (
            <button
              key={user._id}
              type="button"
              onClick={() => onSelectUser(user)}
              className="flex h-[72px] w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-[var(--wa-row-hover)] active:bg-[var(--wa-row-active)]"
            >
              {user.profilePicture ? (
                <img src={user.profilePicture} alt="" className="size-[49px] shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-[49px] shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]">
                  <UserRound size={26} />
                </span>
              )}

              <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-[color:var(--wa-border)]">
                <span className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                  {user.name || user.username}
                </span>
                <span className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">{user.phone}</span>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
}