import { useEffect, useRef } from "react";
import { Ban, Smile } from "lucide-react";
import MessageBubble from "./MessageBubble";
import MessageReactions from "./MessageReactions";

const LONG_PRESS_MS = 500;

/**
 * Wraps one MessageBubble: opens the context menu (right click, long-press,
 * or the hover smiley), shows reactions, handles deleted-for-everyone rows.
 */
export default function MessageRow({
  message,
  currentUserId,
  highlighted,
  grouped = false,
  showSender = false,
  highlight = "",
  className = "",
  onOpenMenu,
  onJumpToMessage,
  onMediaClick,
}) {
  const isMe = message.sender === "me";
  const pressTimer = useRef(null);

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  function handleContextMenu(event) {
    event.preventDefault();
    onOpenMenu(message, { x: event.clientX, y: event.clientY });
  }

  function handleTouchStart(event) {
    const { clientX, clientY } = event.touches[0];

    pressTimer.current = setTimeout(() => {
      onOpenMenu(message, { x: clientX, y: clientY });
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(pressTimer.current);
  }

  const reactButton = (
    <button
      type="button"
      aria-label="React to message"
      title="React"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onOpenMenu(message, { x: rect.left, y: rect.bottom + 4, mode: "reactions" });
      }}
      className="wa-shadow-float hidden size-[26px] shrink-0 place-items-center rounded-full bg-[var(--wa-hoverbtn-bg)] text-[color:var(--wa-hoverbtn-icon)] opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:grid"
    >
      <Smile size={17} strokeWidth={1.9} />
    </button>
  );

  return (
    <div
      id={`message-${message.id}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onTouchCancel={cancelPress}
      className={`group rounded-lg transition-colors duration-700 ${
        highlighted ? "bg-[var(--wa-row-flash)]" : ""
      } ${className}`}
    >
      {message.deletedForEveryone ? (
        <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
          <div
            className={`wa-shadow-bubble flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] italic text-[color:var(--wa-deleted-text)] ${
              isMe ? "bg-[var(--wa-bubble-out-bg)]" : "bg-[var(--wa-bubble-in-bg)]"
            }`}
          >
            <Ban size={14} className="shrink-0" />
            <span>{isMe ? "You deleted this message" : "This message was deleted"}</span>
            <span className="self-end text-[11px] not-italic">{message.time}</span>
          </div>
        </div>
      ) : (
        <>
          <div className={`flex w-full items-center gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
            {isMe && reactButton}
            <MessageBubble
              message={message}
              showTail={!grouped}
              showSender={showSender}
               highlight={highlight}
              onJumpToMessage={onJumpToMessage}
              onOpenMenu={onOpenMenu}
              onMediaClick={onMediaClick}
            />
            {!isMe && reactButton}
          </div>

          <MessageReactions
            reactions={message.reactions}
            currentUserId={currentUserId}
            isMe={isMe}
          />
        </>
      )}
    </div>
  );
}