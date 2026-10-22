// Small pill under a bubble that summarises its reactions.
export default function MessageReactions({ reactions, currentUserId, isMe }) {
  if (!reactions || reactions.length === 0) return null;

  const counts = new Map();

  reactions.forEach((reaction) => {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const mine = reactions.some((reaction) => reaction.userId === String(currentUserId));
  const title = sorted.map(([emoji, count]) => `${emoji} ${count}`).join("   ");

  return (
    <div
      className={`relative z-10 -mt-[3px] flex ${isMe ? "justify-end pr-2.5" : "justify-start pl-2.5"}`}
    >
      <span
        title={title}
        className={`wa-shadow-float flex h-6 min-w-6 items-center justify-center gap-1 rounded-full border bg-[var(--wa-reaction-bg)] px-1.5 text-[15px] leading-none ${
          mine
            ? "border-[color:var(--wa-reaction-mine-border)]"
            : "border-[color:var(--wa-reaction-border)]"
        }`}
      >
        {sorted.slice(0, 3).map(([emoji]) => (
          <span key={emoji}>{emoji}</span>
        ))}

        {reactions.length > 1 && (
          <span className="text-[12px] text-[color:var(--wa-reaction-text)]">{reactions.length}</span>
        )}
      </span>
    </div>
  );
}