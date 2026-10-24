import { useEffect, useState } from "react";
import { ArrowRight, Check, RefreshCw, UserRound, Users, X } from "lucide-react";
import api from "../../../lib/api";
import PanelHeader from "./PanelHeader";
import PanelSearch from "./PanelSearch";

const MAX_NAME_LENGTH = 50;

function Avatar({ user, size = 49 }) {
  const style = { width: size, height: size };

  return user.profilePicture ? (
    <img src={user.profilePicture} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]"
    >
      <UserRound size={Math.round(size / 2)} />
    </span>
  );
}

/**
 * Two steps: 1) pick members (found by phone number), 2) name the group.
 * onCreate(name, memberIds) must return a promise and throw on failure.
 */
export default function NewGroupView({ onBack, onCreate }) {
  const [step, setStep] = useState("members"); // "members" | "name"

  const [phone, setPhone] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selected, setSelected] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Phone search (same behaviour as the New chat screen)
  useEffect(() => {
    const value = phone.trim();

    setResults([]);
    setSearchError("");

    if (value.replace(/\D/g, "").length < 7) {
      setSearching(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.get("/conversations/search-users", {
          params: { phone: value },
        });
        if (!cancelled) setResults(response.data.users || []);
      } catch (err) {
        if (!cancelled) setSearchError(err.response?.data?.message || "Unable to search users.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  const searched = phone.trim().replace(/\D/g, "").length >= 7;
  const isSelected = (id) => selected.some((user) => user._id === id);

  function toggleUser(user) {
    setSelected((previous) =>
      previous.some((item) => item._id === user._id)
        ? previous.filter((item) => item._id !== user._id)
        : [...previous, user]
    );
  }

  async function handleCreate() {
    const name = groupName.trim();
    if (!name || creating) return;

    try {
      setCreating(true);
      setCreateError("");
      await onCreate(
        name,
        selected.map((user) => user._id)
      );
      // On success the parent closes this screen.
    } catch (err) {
      setCreateError(err.response?.data?.message || "Unable to create the group. Please try again.");
      setCreating(false);
    }
  }

  const fab =
    "absolute bottom-6 right-6 grid size-14 place-items-center rounded-full bg-[var(--wa-fab-bg)] text-[color:var(--wa-fab-fg)] shadow-lg transition hover:bg-[var(--wa-fab-hover)] active:scale-95 disabled:opacity-50";

  /* ---------------- Step 2: name the group ---------------- */
  if (step === "name") {
    return (
      <section className="relative flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
        <PanelHeader title="New group" onBack={() => setStep("members")} />

        <div className="flex flex-col items-center px-6 pt-6">
          <span className="grid size-[120px] place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]">
            <Users size={56} />
          </span>

          <input
            autoFocus
            value={groupName}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setGroupName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleCreate()}
            placeholder="Group name"
            aria-label="Group name"
            className="mt-8 w-full border-0 border-b-2 border-[color:var(--wa-border)] bg-transparent pb-2 text-[17px] text-[color:var(--wa-text-primary)] outline-none placeholder:text-[color:var(--wa-text-secondary)] focus:border-[color:var(--wa-accent)]"
          />

          <p className="mt-6 self-start text-[13px] text-[color:var(--wa-text-secondary)]">
            Members: {selected.length + 1} (including you)
          </p>

          {createError && (
            <p role="alert" className="mt-4 text-center text-sm text-[color:var(--wa-danger)]">
              {createError}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label="Create group"
          title="Create group"
          disabled={!groupName.trim() || creating}
          onClick={handleCreate}
          className={fab}
        >
          {creating ? <RefreshCw size={22} className="animate-spin" /> : <Check size={26} />}
        </button>
      </section>
    );
  }

  /* ---------------- Step 1: pick members ---------------- */
  return (
    <section className="relative flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="Add group members" onBack={onBack} />

      {selected.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 px-5 pb-2">
          {selected.map((user) => (
            <span
              key={user._id}
              className="flex items-center gap-1.5 rounded-full bg-[var(--wa-search-bg)] py-1 pl-1 pr-2 text-[13px] text-[color:var(--wa-text-primary)]"
            >
              <Avatar user={user} size={22} />
              {user.name || user.username}
              <button
                type="button"
                aria-label={`Remove ${user.name || user.username}`}
                onClick={() => toggleUser(user)}
                className="text-[color:var(--wa-icon)] hover:text-[color:var(--wa-text-primary)]"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <PanelSearch
        type="tel"
        value={phone}
        onChange={setPhone}
        placeholder="Search by phone number"
        onEscape={onBack}
      />

      <p className="shrink-0 px-6 pb-2 text-[12px] text-[color:var(--wa-text-secondary)]">
        Enter the full phone number with country code, then tap the person to add them.
      </p>

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto pb-24">
        {searching && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Searching contacts...
          </div>
        )}

        {!searching && searchError && (
          <p role="alert" className="px-6 py-6 text-center text-sm text-[color:var(--wa-danger)]">
            {searchError}
          </p>
        )}

        {!searching && !searchError && searched && results.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
            No WhatsApp account found for this phone number.
          </p>
        )}

        {!searching &&
          results.map((user) => (
            <button
              key={user._id}
              type="button"
              onClick={() => toggleUser(user)}
              className="flex h-[72px] w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-[var(--wa-row-hover)] active:bg-[var(--wa-row-active)]"
            >
              <Avatar user={user} />

              <div className="flex h-full min-w-0 flex-1 items-center gap-3 border-b border-[color:var(--wa-border)]">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                    {user.name || user.username}
                  </span>
                  <span className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">{user.phone}</span>
                </div>

                {isSelected(user._id) && <Check size={20} className="shrink-0 text-[color:var(--wa-accent)]" />}
              </div>
            </button>
          ))}
      </div>

      {selected.length > 0 && (
        <button type="button" aria-label="Next" title="Next" onClick={() => setStep("name")} className={fab}>
          <ArrowRight size={26} />
        </button>
      )}
    </section>
  );
}