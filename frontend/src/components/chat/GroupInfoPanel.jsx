import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  LogOut,
  MoreVertical,
  Pencil,
  RefreshCw,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import api from "../../../lib/api";
import CropModal from "../settings/CropModal";

const MAX_NAME_LENGTH = 50;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function Avatar({ src, size = 44, children }) {
  const style = { width: size, height: size };

  return src ? (
    <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]"
    >
      {children || <UserRound size={Math.round(size / 2)} />}
    </span>
  );
}

/**
 * Right-hand "Group info" panel.
 * Admins can rename the group, change its photo, add / remove people and make
 * other admins. Everyone can exit the group.
 *
 * `chat` comes from the live chats list, so it re-renders by itself whenever the
 * server announces a change.
 */
export default function GroupInfoPanel({ chat, currentUserId, onClose, onGroupUpdated, onGroupLeft }) {
  const me = String(currentUserId);
  const isAdmin = Boolean(chat.isAdmin);
  const base = `/conversations/${chat.id}/group`;

  const fileRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [cropSrc, setCropSrc] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("");
  // The last finished search, tagged with the number it was for.
  const [found, setFound] = useState({ query: "", users: [], error: "" });

  const members = [...(chat.members || [])].sort((a, b) => {
    if (a.id === me) return -1;
    if (b.id === me) return 1;
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const memberIds = new Set(members.map((member) => member.id));

  // Close the member menu when clicking anywhere else.
  useEffect(() => {
    if (!menuFor) return undefined;

    const close = (event) => {
      if (!event.target.closest("[data-member-menu]")) setMenuFor(null);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  // Phone search for "Add members" (waits until the number looks complete).
  const query = phone.trim();
  const searchable = adding && query.replace(/\D/g, "").length >= 7;
  const current = searchable && found.query === query ? found : null;
  const results = current?.users || [];
  const searchError = current?.error || "";
  const searching = searchable && !current;

  useEffect(() => {
    if (!searchable) return undefined;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/conversations/search-users", { params: { phone: query } });
        if (!cancelled) setFound({ query, users: response.data.users || [], error: "" });
      } catch (err) {
        if (!cancelled) {
          setFound({ query, users: [], error: err.response?.data?.message || "Unable to search users." });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchable]);

  // Runs a request, shows its error, and applies the updated group straight away.
  async function run(request) {
    try {
      setBusy(true);
      setError("");

      const response = await request();

      if (response?.data?.conversation) {
        onGroupUpdated?.(response.data.conversation);
      }

      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const name = nameDraft.trim();

    if (!name) return;
    if (name === chat.name) return setEditingName(false);

    if (await run(() => api.patch(base, { name }))) setEditingName(false);
  }

  function handlePickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function savePicture(dataUrl) {
    // Close the cropper first so any error is visible in the panel.
    setCropSrc(null);
    await run(() => api.patch(`${base}/picture`, { picture: dataUrl }));
  }

  async function handleLeave() {
    if (!window.confirm("Exit this group? You won't be able to see its messages any more.")) return;

    try {
      setBusy(true);
      setError("");
      await api.post(`${base}/leave`);
      onGroupLeft?.(chat.id);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to exit the group.");
      setBusy(false);
    }
  }

  function handleRemove(member) {
    setMenuFor(null);

    if (window.confirm(`Remove ${member.name} from the group?`)) {
      run(() => api.delete(`${base}/members/${member.id}`));
    }
  }

  function handleToggleAdmin(member) {
    setMenuFor(null);
    run(() => api.patch(`${base}/admins/${member.id}`, { isAdmin: !member.isAdmin }));
  }

  const row = "flex w-full items-center gap-3 px-6 py-2.5 text-left";
  const menuButton =
    "block w-full px-4 py-2.5 text-left text-[14.5px] text-[color:var(--wa-text-primary)] hover:bg-[var(--wa-hover)]";

  return (
    <aside className="relative z-40 flex h-full w-[380px] shrink-0 flex-col border-l border-[color:var(--wa-border)] bg-[var(--wa-sidebar-bg)] text-[color:var(--wa-text-primary)] max-[1100px]:absolute max-[1100px]:right-0 max-[1100px]:top-0 max-[1100px]:w-[min(380px,100%)] max-[1100px]:shadow-2xl">
      <header className="flex h-[65px] shrink-0 items-center gap-5 border-b border-[color:var(--wa-border)] px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close group info"
          className="grid size-9 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
        >
          <X size={22} />
        </button>
        <h2 className="text-[17px] font-medium">Group info</h2>
      </header>

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto">
        {/* Photo + name */}
        <section className="flex flex-col items-center px-6 pb-6 pt-7">
          <div className="relative">
            <Avatar src={chat.avatar} size={160}>
              <Users size={72} />
            </Avatar>

            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                aria-label="Change group photo"
                title="Change group photo"
                className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
              >
                <Camera size={30} />
              </button>
            )}

            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={handlePickFile} />
          </div>

          {isAdmin && chat.avatar && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.patch(`${base}/picture`, { picture: null }))}
              className="mt-3 text-[13px] text-[color:var(--wa-danger)] hover:underline"
            >
              Remove photo
            </button>
          )}

          {editingName ? (
            <div className="mt-5 flex w-full items-center gap-2 border-b-2 border-[color:var(--wa-accent)] pb-1">
              <input
                autoFocus
                value={nameDraft}
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveName();
                  if (event.key === "Escape") setEditingName(false);
                }}
                aria-label="Group name"
                className="min-w-0 flex-1 bg-transparent text-[20px] outline-none"
              />
              <button type="button" onClick={saveName} disabled={busy || !nameDraft.trim()} aria-label="Save name" className="text-[color:var(--wa-accent)] disabled:opacity-40">
                <Check size={22} />
              </button>
              <button type="button" onClick={() => setEditingName(false)} aria-label="Cancel" className="text-[color:var(--wa-icon)]">
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex max-w-full items-center gap-2">
              <h3 className="truncate text-[22px] leading-7">{chat.name}</h3>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(chat.name);
                    setEditingName(true);
                  }}
                  aria-label="Edit group name"
                  title="Edit group name"
                  className="shrink-0 text-[color:var(--wa-icon)] hover:text-[color:var(--wa-text-primary)]"
                >
                  <Pencil size={18} />
                </button>
              )}
            </div>
          )}

          <p className="mt-1 text-[14px] text-[color:var(--wa-text-secondary)]">
            Group · {members.length} {members.length === 1 ? "member" : "members"}
          </p>

          {error && (
            <p role="alert" className="mt-3 text-center text-[13.5px] text-[color:var(--wa-danger)]">
              {error}
            </p>
          )}
        </section>

        <div className="h-2 bg-[var(--wa-border)] opacity-40" />

        {/* Members */}
        <section className="py-2">
          <p className="px-6 pb-1 pt-3 text-[14px] text-[color:var(--wa-text-secondary)]">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAdding((value) => !value);
                  setPhone("");
                }}
                className={`${row} hover:bg-[var(--wa-row-hover)]`}
              >
                <span className="grid size-11 place-items-center rounded-full bg-[var(--wa-accent)] text-white">
                  <UserPlus size={20} />
                </span>
                <span className="text-[16px]">{adding ? "Done adding" : "Add members"}</span>
              </button>

              {adding && (
                <div className="px-6 pb-3">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Full phone number with country code"
                    aria-label="Search by phone number"
                    className="w-full rounded-lg bg-[var(--wa-search-bg)] px-3 py-2 text-[14.5px] outline-none placeholder:text-[color:var(--wa-text-secondary)]"
                  />

                  {searching && (
                    <p className="flex items-center gap-2 pt-3 text-[13.5px] text-[color:var(--wa-text-secondary)]">
                      <RefreshCw size={14} className="animate-spin" /> Searching…
                    </p>
                  )}

                  {searchError && <p className="pt-3 text-[13.5px] text-[color:var(--wa-danger)]">{searchError}</p>}

                  {current && !searchError && results.length === 0 && (
                    <p className="pt-3 text-[13.5px] text-[color:var(--wa-text-secondary)]">No account found for this number.</p>
                  )}

                  {results.map((user) => (
                    <div key={user._id} className="flex items-center gap-3 pt-3">
                      <Avatar src={user.profilePicture} size={40} />
                      <span className="min-w-0 flex-1 truncate text-[15px]">{user.name || user.username}</span>

                      {memberIds.has(String(user._id)) ? (
                        <span className="text-[13px] text-[color:var(--wa-text-secondary)]">In group</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(() => api.post(`${base}/members`, { userIds: [user._id] }))}
                          className="rounded-full bg-[var(--wa-accent)] px-3.5 py-1 text-[13px] font-medium text-white disabled:opacity-50"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {members.map((member) => {
            const isMe = member.id === me;

            return (
              <div key={member.id} className="relative flex items-center gap-3 px-6 py-2.5 hover:bg-[var(--wa-row-hover)]">
                <Avatar src={member.avatar} size={44} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px]">{isMe ? "You" : member.name}</p>
                  {member.about && (
                    <p className="truncate text-[13.5px] text-[color:var(--wa-text-secondary)]">{member.about}</p>
                  )}
                </div>

                {member.isAdmin && (
                  <span className="shrink-0 rounded border border-[color:var(--wa-accent)] px-1.5 py-px text-[11.5px] text-[color:var(--wa-accent)]">
                    Group admin
                  </span>
                )}

                {isAdmin && !isMe && (
                  <div data-member-menu className="relative shrink-0">
                    <button
                      type="button"
                      aria-label={`Options for ${member.name}`}
                      onClick={() => setMenuFor((current) => (current === member.id ? null : member.id))}
                      className="grid size-8 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {menuFor === member.id && (
                      <div role="menu" className="absolute right-0 top-9 z-10 w-52 overflow-hidden rounded-lg border border-[color:var(--wa-border)] bg-[var(--wa-modal-bg)] py-1 shadow-xl">
                        <button type="button" role="menuitem" disabled={busy} className={menuButton} onClick={() => handleToggleAdmin(member)}>
                          {member.isAdmin ? "Dismiss as admin" : "Make group admin"}
                        </button>
                        <button type="button" role="menuitem" disabled={busy} className={`${menuButton} text-[color:var(--wa-danger)]`} onClick={() => handleRemove(member)}>
                          Remove from group
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="h-2 bg-[var(--wa-border)] opacity-40" />

        <button
          type="button"
          disabled={busy}
          onClick={handleLeave}
          className={`${row} py-4 text-[16px] text-[color:var(--wa-danger)] hover:bg-[var(--wa-row-hover)] disabled:opacity-50`}
        >
          <LogOut size={20} />
          Exit group
        </button>
      </div>

      {cropSrc && (
        <CropModal
          key={cropSrc}
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onUploadAnother={() => fileRef.current?.click()}
          onConfirm={savePicture}
        />
      )}
    </aside>
  );
}