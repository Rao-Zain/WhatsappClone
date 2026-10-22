import { FileText, UserPlus, Video } from "lucide-react";

/* Illustration colors come from the theme (inline style so var() always resolves). */
const INK = "var(--wa-text-primary)";
const FILL_BASE = { fill: "var(--wa-chip-active-bg)", stroke: INK };
const FILL_PAGE = { fill: "var(--wa-chat-bg)", stroke: INK };
const FILL_SIDE = { fill: "var(--wa-accent)", stroke: INK };

function CallsIllustration() {
  return (
    <svg viewBox="0 0 134 88" width="134" height="88" fill="none" aria-hidden="true">
      <path d="M1 79h132l-5 8H6z" style={FILL_BASE} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="26" y="1" width="107" height="75" rx="3" style={FILL_PAGE} strokeWidth="1.5" />
      <rect x="26" y="1" width="34" height="75" rx="3" style={FILL_SIDE} strokeWidth="1.5" />
      <path d="M33 25h20M33 33h20M33 41h20M33 49h14" style={{ stroke: INK }} strokeWidth="1.5" strokeLinecap="round" />
      <g transform="translate(84 26) scale(1.25)">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          style={{ stroke: "var(--wa-accent)" }}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/* Meta AI keeps its fixed brand colors on purpose */
function MetaAiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <circle cx="12" cy="5" r="3" fill="#a855f7" />
      <circle cx="19" cy="10" r="3" fill="#6366f1" />
      <circle cx="16.5" cy="18" r="3" fill="#ec4899" />
      <circle cx="7.5" cy="18" r="3" fill="#a855f7" />
      <circle cx="5" cy="10" r="3" fill="#3b82f6" />
    </svg>
  );
}

const ACTIONS = [
  { id: "document", label: "Send document", icon: <FileText size={24} /> },
  { id: "contact", label: "Add contact", icon: <UserPlus size={24} /> },
  { id: "call", label: "New call", icon: <Video size={24} /> },
  { id: "ai", label: "Ask Meta AI", icon: <MetaAiIcon /> },
];

export default function SettingsWorkspace({ onGoToCalls }) {
  return (
    <main className="flex h-full min-w-0 flex-1 items-center justify-center overflow-auto bg-[var(--wa-rail-bg)] p-4 text-[color:var(--wa-text-primary)] max-[700px]:hidden">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-8">
        <div className="flex w-full max-w-[352px] flex-col items-center rounded-3xl bg-[var(--wa-sidebar-bg)] px-7 pb-6 pt-[46px] text-center">
          <CallsIllustration />

          <h2 className="mt-[46px] text-2xl font-normal leading-7">
            Voice and video calling is now available
          </h2>
          <p className="mt-2 text-[15px] leading-5 text-[color:var(--wa-text-secondary)]">
            Now you can make and join calls on WhatsApp Web.
          </p>

          <button
            type="button"
            onClick={onGoToCalls}
            className="mt-[25px] h-8 rounded-full bg-[var(--wa-chip-active-bg)] px-4 text-sm font-medium text-[color:var(--wa-chip-active-text)] transition-[filter] hover:brightness-95"
          >
            Go to Calls
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-5">
          {ACTIONS.map(({ id, label, icon }) => (
            <button key={id} type="button" className="group flex min-w-[60px] flex-col items-center gap-2">
              <span className="flex h-12 w-[60px] items-center justify-center rounded-full bg-[var(--wa-rail-item-hover)] text-[color:var(--wa-icon)] group-hover:bg-[var(--wa-rail-item-active)]">
                {icon}
              </span>
              <span className="whitespace-nowrap text-xs leading-4">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}