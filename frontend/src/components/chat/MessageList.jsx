import { useCallback, useEffect, useRef, useState } from "react";
import MessageRow from "./MessageRow";

export default function MessageList({
  messages,
  currentUserId,
  onOpenMenu,
  onMediaClick,
}) {
  const bottomRef = useRef(null);
  const highlightTimer = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Scroll down only when a new last message arrives. Reactions, stars
  // and deletions in the middle of the chat must not move the view.
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastId]);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  // Jump to a quoted message and flash it.
  const handleJumpToMessage = useCallback((messageId) => {
    const element = document.getElementById(`message-${messageId}`);

    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });

    setHighlightedId(messageId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 1500);
  }, []);

  return (
    <div className="whatsapp-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full flex-col justify-end px-[4%] py-4 sm:px-[7%]">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          // Same sender as the message above: tight spacing and no bubble tail.
          const grouped = Boolean(previous) && previous.sender === message.sender;

          return (
            <MessageRow
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              grouped={grouped}
              className={index === 0 ? "" : grouped ? "mt-[3px]" : "mt-3"}
              highlighted={highlightedId === message.id}
              onOpenMenu={onOpenMenu}
              onJumpToMessage={handleJumpToMessage}
              onMediaClick={onMediaClick}
            />
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}