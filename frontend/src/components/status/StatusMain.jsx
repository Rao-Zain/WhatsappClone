import { CircleDashed } from "lucide-react";

/* Right-hand side on computers while the Status tab is open. (Hidden on phones.) */
export default function StatusMain() {
  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--wa-chat-bg)] px-8 text-center">
      <CircleDashed size={72} strokeWidth={1.2} className="text-[color:var(--wa-text-secondary)]" />
      <h2 className="text-[26px] font-light text-[color:var(--wa-text-primary)]">Share status updates</h2>
      <p className="max-w-[420px] text-[14px] leading-5 text-[color:var(--wa-text-secondary)]">
        Post a photo, video or text that disappears after 24 hours. People you chat with can see it, and you
        can see theirs. Click a contact on the left to view their updates.
      </p>
    </section>
  );
}