import { useCallback, useEffect, useRef, useLayoutEffect, useState } from "react";
import MessageRow from "./MessageRow";

export default function MessageList({
  messages,
  currentUserId,
  onOpenMenu,
  onMediaClick,
  isGroup = false,
   isHistory = false,
  jumpTarget = null,
  highlight = "",
    hasMore = false,
  isLoadingOlder = false,
  olderFailed = false,
  onLoadOlder,
}) {
  const bottomRef = useRef(null);
    const scrollRef = useRef(null);
  const anchorRef = useRef(null);
  const lastTopRef = useRef(0);
  const highlightTimer = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Scroll down only when a new last message arrives. Reactions, stars
  // and deletions in the middle of the chat must not move the view.
  const lastId = messages[messages.length - 1]?.id;

  // replace the auto-scroll effect
  useEffect(() => {
    // Looking at old messages (from search): don't pull the view to the bottom.
    if (isHistory) return;

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastId, isHistory]);

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

    // ----- Loading older messages when scrolling up -----
  const firstId = messages[0]?.id;

  const requestOlder = useCallback(() => {
    const element = scrollRef.current;

    // Remember where we were, so the same message stays in view afterwards.
    if (element) {
      anchorRef.current = { height: element.scrollHeight };
    }

    onLoadOlder?.();
  }, [onLoadOlder]);

  const handleScroll = (event) => {
    const top = event.currentTarget.scrollTop;
    const scrollingUp = top < lastTopRef.current;

    lastTopRef.current = top;

    if (scrollingUp && top < 120 && hasMore && !isLoadingOlder) {
      requestOlder();
    }
  };

  // Older messages were added above: restore the position.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const anchor = anchorRef.current;

    if (!element || !anchor) return;

    anchorRef.current = null;

    // Push the view down by exactly the height that was added above, starting
    // from where the person is NOW (they may have kept scrolling meanwhile).
    element.scrollTop += element.scrollHeight - anchor.height;
  }, [firstId]);

  // The request ended without adding messages (error / cancelled): forget the position.
  useEffect(() => {
    if (!isLoadingOlder) anchorRef.current = null;
  }, [isLoadingOlder]);

  // A short chat that doesn't fill the screen can't be scrolled: load more by itself.
  useEffect(() => {
    const element = scrollRef.current;

    if (
      element &&
      hasMore &&
      !isLoadingOlder &&
      !olderFailed &&
      element.scrollHeight <= element.clientHeight + 1
    ) {
      onLoadOlder?.();
    }
  }, [messages.length, hasMore, isLoadingOlder, olderFailed, onLoadOlder]);

  // add this effect right above `return (` (after handleJumpToMessage)
  // A search result was picked: scroll to it once it is on screen.
  useEffect(() => {
    if (!jumpTarget) return undefined;

    const frame = requestAnimationFrame(() => handleJumpToMessage(jumpTarget.id));

    return () => cancelAnimationFrame(frame);
  }, [jumpTarget, handleJumpToMessage]);

  return (
       <div
      ref={scrollRef}
      onScroll={handleScroll}
      // We restore the position ourselves; the browser's own anchoring would double it.
      style={{ overflowAnchor: "none" }}
      className="whatsapp-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="flex min-h-full flex-col justify-end px-[4%] py-4 sm:px-[7%]">
     
             {/* Zero-height overlay, so showing it never pushes the messages down. */}
        {(isLoadingOlder || olderFailed) && (
          <div className="sticky top-2 z-10 flex h-0 justify-center">
            {isLoadingOlder ? (
              <span className="rounded-full bg-[var(--wa-chip-bg)] px-3 py-1 text-[12.5px] text-[color:var(--wa-chip-text)] shadow-sm">
                Loading older messages…
              </span>
            ) : (
              <button
                type="button"
                onClick={requestOlder}
                className="rounded-full bg-[var(--wa-chip-bg)] px-4 py-1 text-[12.5px] text-[color:var(--wa-chip-text)] shadow-sm"
              >
                Couldn’t load older messages. Tap to retry
              </button>
            )}
          </div>
        )}
     
        {messages.map((message, index) => {
          const previous = messages[index - 1];

          // Group notices such as "Ali added Sara" sit in the middle as a small pill.
          if (message.type === "system") {
            return (
              <div
                key={message.id}
                className={`flex justify-center ${index === 0 ? "" : "mt-3"}`}
              >
                <span className="max-w-[85%] rounded-lg bg-[var(--wa-chip-bg)] px-3 py-1 text-center text-[12.5px] leading-[19px] text-[color:var(--wa-chip-text)] shadow-sm">
                  {message.text}
                </span>
              </div>
            );
          }

          // Same sender as the message above: tight spacing and no bubble tail.
          const grouped =
            Boolean(previous) &&
            previous.type !== "system" &&
            (previous.senderId && message.senderId
              ? previous.senderId === message.senderId
              : previous.sender === message.sender);
          return (
            <MessageRow
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              grouped={grouped}
              showSender={isGroup && message.sender === "other" && !grouped}
              highlight={highlight}
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