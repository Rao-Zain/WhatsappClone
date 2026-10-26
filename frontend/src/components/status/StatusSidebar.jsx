import { useRef, useState } from "react";
import { Camera, Pencil, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import MobileBottomNav from "../sidebar/MobileBottomNav";
import StatusAvatar from "./StatusAvatar";
import StatusComposer from "./StatusComposer";
import StatusViewer from "./StatusViewer";
import { checkStatusFile, formatStatusTime } from "./statusUtils";

const ASIDE =
  "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--wa-sidebar-bg)] text-[color:var(--wa-text-primary)]";

const rowClass =
  "flex h-[72px] w-full cursor-pointer items-center gap-3.5 px-4 text-left outline-none transition-colors hover:bg-[var(--wa-row-hover)] sm:rounded-xl sm:px-3";

function SectionTitle({ children }) {
  return (
    <h3 className="px-5 pb-1 pt-4 text-[13px] font-medium uppercase tracking-wide text-[color:var(--wa-accent)] sm:px-6">
      {children}
    </h3>
  );
}

function Row({ onClick, avatar, title, subtitle }) {
  return (
    <div className="shrink-0 sm:px-2.5">
      <button type="button" onClick={onClick} className={rowClass}>
        {avatar}
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-[17px] leading-[21px]">{title}</span>
          <span className="truncate text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">{subtitle}</span>
        </span>
      </button>
    </div>
  );
}

/* "Status" tab: my status, recent updates, viewed updates.
   `statuses` is the result of useStatuses() (created once in AppLayout). */
export default function StatusSidebar({ statuses }) {
  const { user } = useAuth();
  const { mine, contacts, loading, error, reload, markViewed, postStatus, removeStatus } = statuses;

  const [viewer, setViewer] = useState(null); // { kind: "mine" } | { kind: "contacts", order: [userId], start, index }
  const [composer, setComposer] = useState(null); // { media: null | { file, previewUrl } }
  const [fileError, setFileError] = useState("");
  const fileInput = useRef(null);

  const me = {
    _id: String(user?.id || user?._id || ""),
    name: user?.name || "",
    username: user?.username || "",
    profilePicture: user?.profilePicture || "",
  };

  const recent = contacts.filter((group) => !group.allViewed);
  const viewed = contacts.filter((group) => group.allViewed);

  /* ----- viewer: groups are rebuilt from live data; the ORDER is frozen when it opens ----- */
  let viewerGroups = [];

  if (viewer?.kind === "mine") {
    viewerGroups = [{ user: me, statuses: mine, isMine: true }];
  } else if (viewer) {
    viewerGroups = viewer.order
      .map((id) => contacts.find((group) => group.user._id === id))
      .filter(Boolean);
  }

  function openMine() {
    if (mine.length > 0) setViewer({ kind: "mine" });
    else setComposer({ media: null });
  }

  function openContact(group) {
    const order = [...recent, ...viewed].map((item) => item.user._id);
    const start = order.indexOf(group.user._id);
    const firstUnseen = group.statuses.findIndex((status) => !status.viewed);

    setViewer({ kind: "contacts", order, start, index: Math.max(0, firstUnseen) });
  }

  function handleFileChosen(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const problem = checkStatusFile(file);

    if (problem) {
      setFileError(problem);
      return;
    }

    setFileError("");
    setComposer({ media: { file, previewUrl: URL.createObjectURL(file) } });
  }

  function closeComposer() {
    if (composer?.media) URL.revokeObjectURL(composer.media.previewUrl);
    setComposer(null);
  }

  const iconButton =
    "grid size-10 place-items-center rounded-full text-[color:var(--wa-icon)] transition-colors hover:bg-[var(--wa-hover)]";

  const nothingYet = !loading && !error && contacts.length === 0;

  return (
    <aside className={ASIDE}>
      <header className="flex h-[calc(56px+env(safe-area-inset-top))] shrink-0 select-none items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:h-[65px] sm:px-5 sm:pt-0">
        <h1 className="text-[24px] font-bold leading-none sm:text-[22px]">Status</h1>

        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" aria-label="Add photo or video" title="Photo or video" onClick={() => fileInput.current?.click()} className={iconButton}>
            <Camera size={22} />
          </button>
          <button type="button" aria-label="Add text status" title="Text status" onClick={() => setComposer({ media: null })} className={iconButton}>
            <Pencil size={21} />
          </button>
        </div>
      </header>

      <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChosen} />

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto pb-2 max-sm:pb-40">
        {fileError && (
          <p role="alert" className="px-6 py-2 text-center text-sm text-[color:var(--wa-danger)]">
            {fileError}
          </p>
        )}

        <Row
          onClick={openMine}
          avatar={
            <StatusAvatar
              user={me}
              segments={mine.length}
              seenCount={0}
              showPlus={mine.length === 0}
            />
          }
          title="My status"
          subtitle={
            mine.length === 0
              ? "Tap to add status update"
              : `${mine.length} update${mine.length === 1 ? "" : "s"} · ${formatStatusTime(mine[mine.length - 1].createdAt)}`
          }
        />

        {loading && (
          <p className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Loading updates...
          </p>
        )}

        {!loading && error && (
          <div className="px-6 py-8 text-center text-sm">
            <p role="alert" className="text-[color:var(--wa-danger)]">{error}</p>
            <button type="button" onClick={reload} className="mt-3 font-medium text-[color:var(--wa-accent)] hover:underline">
              Try again
            </button>
          </div>
        )}

        {nothingYet && (
          <p className="px-8 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
            No recent updates. Status updates from the people you chat with appear here.
          </p>
        )}

        {recent.length > 0 && (
          <>
            <SectionTitle>Recent updates</SectionTitle>
            {recent.map((group) => (
              <Row
                key={group.user._id}
                onClick={() => openContact(group)}
                avatar={
                  <StatusAvatar
                    user={group.user}
                    segments={group.statuses.length}
                    seenCount={group.statuses.filter((status) => status.viewed).length}
                  />
                }
                title={group.user.name || group.user.username}
                subtitle={formatStatusTime(group.latestAt)}
              />
            ))}
          </>
        )}

        {viewed.length > 0 && (
          <>
            <SectionTitle>Viewed updates</SectionTitle>
            {viewed.map((group) => (
              <Row
                key={group.user._id}
                onClick={() => openContact(group)}
                avatar={<StatusAvatar user={group.user} segments={group.statuses.length} seenCount={group.statuses.length} />}
                title={group.user.name || group.user.username}
                subtitle={formatStatusTime(group.latestAt)}
              />
            ))}
          </>
        )}
      </div>

      {/* Phone: pencil + camera buttons, like WhatsApp */}
      <div className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-10 flex flex-col items-end gap-3 sm:hidden">
        <button
          type="button"
          aria-label="Add text status"
          onClick={() => setComposer({ media: null })}
          className="grid size-11 place-items-center rounded-2xl bg-[var(--wa-search-bg)] text-[color:var(--wa-text-primary)] shadow-lg active:scale-95"
        >
          <Pencil size={20} />
        </button>
        <button
          type="button"
          aria-label="Add photo or video"
          onClick={() => fileInput.current?.click()}
          className="grid size-14 place-items-center rounded-2xl bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)] shadow-lg active:scale-95"
        >
          <Camera size={24} />
        </button>
      </div>

      <MobileBottomNav />

      {viewer && (
        <StatusViewer
          groups={viewerGroups}
          startGroup={viewer.kind === "mine" ? 0 : Math.max(0, viewer.start)}
          startIndex={viewer.kind === "mine" ? 0 : viewer.index}
          onClose={() => setViewer(null)}
          onViewed={markViewed}
          onDelete={removeStatus}
        />
      )}

      {composer && <StatusComposer media={composer.media} onClose={closeComposer} onPost={postStatus} />}
    </aside>
  );
}