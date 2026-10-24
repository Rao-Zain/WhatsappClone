import { useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import PanelHeader from "../sidebar/PanelHeader";
import Avatar from "./Avatar";

function SectionTitle({ children }) {
  return (
    <h3 className="px-6 pb-1 pt-4 text-[13px] font-medium uppercase tracking-wide text-[color:var(--wa-accent)]">
      {children}
    </h3>
  );
}

const pill =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors disabled:opacity-50";

export default function ChatRequestsView({ requests, onBack, onAccepted }) {
  const { incoming, outgoing, loading, error, respond, cancel } = requests;
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function run(id, task) {
    if (busyId) return;

    try {
      setBusyId(id);
      setActionError("");
      await task();
    } catch (err) {
      setActionError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const accept = (request) =>
    run(request.id, async () => {
      const data = await respond(request.id, "accept");
      if (data.conversation) onAccepted?.(data.conversation);
    });

  const reject = (request) => run(request.id, () => respond(request.id, "reject"));
  const cancelRequest = (request) => run(request.id, () => cancel(request.id));

  const nothing = !loading && incoming.length === 0 && outgoing.length === 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[var(--wa-sidebar-bg)]">
      <PanelHeader title="Chat requests" onBack={onBack} />

      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--wa-text-secondary)]">
            <RefreshCw size={16} className="animate-spin text-[color:var(--wa-accent)]" />
            Loading requests...
          </div>
        )}

        {(error || actionError) && (
          <p role="alert" className="px-6 py-3 text-center text-sm text-[color:var(--wa-danger)]">
            {actionError || error}
          </p>
        )}

        {nothing && !error && (
          <p className="px-6 py-8 text-center text-sm text-[color:var(--wa-text-secondary)]">
            No chat requests. When someone wants to message you, their request shows up here.
          </p>
        )}

        {incoming.length > 0 && (
          <>
            <SectionTitle>Wants to message you</SectionTitle>

            {incoming.map((request) => (
              <div key={request.id} className="flex items-center gap-3.5 px-4 py-3">
                <Avatar user={request.user} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                    {request.user.name || request.user.username}
                  </p>
                  <p className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">
                    @{request.user.username}
                  </p>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => accept(request)}
                      className={`${pill} bg-[var(--wa-accent)] text-[color:var(--wa-accent-fg)] hover:bg-[var(--wa-accent-hover)]`}
                    >
                      <Check size={16} /> Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => reject(request)}
                      className={`${pill} border border-[color:var(--wa-border)] text-[color:var(--wa-danger)] hover:bg-[var(--wa-menu-hover)]`}
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <p className="px-6 pt-1 text-[12px] leading-4 text-[color:var(--wa-text-secondary)]">
              Rejecting blocks this person from messaging you. You can unblock them later from
              Blocked contacts.
            </p>
          </>
        )}

        {outgoing.length > 0 && (
          <>
            <SectionTitle>Requests you sent</SectionTitle>

            {outgoing.map((request) => (
              <div key={request.id} className="flex items-center gap-3.5 px-4 py-3">
                <Avatar user={request.user} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] text-[color:var(--wa-text-primary)]">
                    {request.user.name || request.user.username}
                  </p>
                  <p className="truncate text-[14px] text-[color:var(--wa-text-secondary)]">
                    {request.status === "rejected" ? "Declined" : "Waiting for them to accept"}
                  </p>
                </div>

                {request.status === "pending" && (
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => cancelRequest(request)}
                    className={`${pill} border border-[color:var(--wa-border)] text-[color:var(--wa-accent)] hover:bg-[var(--wa-menu-hover)]`}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}