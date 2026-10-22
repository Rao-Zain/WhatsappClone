import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker from "emoji-picker-react";
import { Reply, Copy, Download, Smile, Forward, Star, StarOff, Trash2 } from "lucide-react";
import ReactionBar from "./ReactionBar";
import ContextMenuItem from "./ContextMenuItem";
import useTheme from "../../theme/useTheme";

const MARGIN = 8;

/**
 * Right-click menu for a message.
 * menu = { message, x, y, mode } (x/y are the click position in the viewport).
 * mode "full" (default): reactions + full menu. mode "reactions": only the reaction bar.
 */
export default function MessageContextMenu({
  menu,
  myReaction,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDownload,
  onForward,
  onStar,
  onDelete,
}) {
  const containerRef = useRef(null);
  const [view, setView] = useState("menu"); // "menu" | "picker"
  const [position, setPosition] = useState(null);
  const [visible, setVisible] = useState(false);
  const { isDark } = useTheme();

  const { message, x, y, mode = "full" } = menu;
  const isDeleted = message.deletedForEveryone;
  const hasText = Boolean(message.text);
  const hasFiles = (message.attachments?.length || 0) > 0;

  // Measure after render, then keep the menu fully inside the viewport.
  useLayoutEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const { width, height } = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;

    if (left + width > viewportWidth - MARGIN) left = x - width;
    if (top + height > viewportHeight - MARGIN) top = y - height;

    left = Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN));

    setPosition({ left, top });
  }, [x, y, view]);

  useEffect(() => {
    if (position) setVisible(true);
  }, [position]);

  useEffect(() => {
    containerRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = [...(containerRef.current?.querySelectorAll('[role="menuitem"]') || [])];

      if (items.length === 0) return;

      event.preventDefault();

      const current = items.indexOf(document.activeElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;

      items[next].focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      onMouseDown={onClose}
      onWheel={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={containerRef}
        role="menu"
        aria-label="Message options"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        style={{
          left: position?.left ?? x,
          top: position?.top ?? y,
          visibility: position ? "visible" : "hidden",
        }}
        className={`fixed origin-top-left outline-none transition duration-100 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {view === "picker" ? (
          <div className="wa-shadow-menu overflow-hidden rounded-2xl bg-[var(--wa-menu-bg)]">
            <EmojiPicker
              onEmojiClick={(emojiData) => onReact(emojiData.emoji)}
              width={320}
              height={380}
              theme={isDark ? "dark" : "light"}
              previewConfig={{ showPreview: false }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {!isDeleted && (
              <ReactionBar selected={myReaction} onPick={onReact} onMore={() => setView("picker")} />
            )}

            {mode !== "reactions" && (
            <div className="wa-shadow-menu w-[230px] overflow-hidden rounded-2xl bg-[var(--wa-menu-bg)] py-2">
              {!isDeleted && <ContextMenuItem icon={Reply} label="Reply" onClick={onReply} />}

              {hasText && !isDeleted && <ContextMenuItem icon={Copy} label="Copy" onClick={onCopy} />}

              {hasFiles && !isDeleted && (
                <ContextMenuItem icon={Download} label="Download" onClick={onDownload} />
              )}

              {!isDeleted && (
                <ContextMenuItem icon={Smile} label="React" onClick={() => setView("picker")} />
              )}

              {!isDeleted && <ContextMenuItem icon={Forward} label="Forward" onClick={onForward} />}

              {!isDeleted && (
                <ContextMenuItem
                  icon={message.starred ? StarOff : Star}
                  label={message.starred ? "Unstar" : "Star"}
                  onClick={onStar}
                />
              )}

              {!isDeleted && <div className="my-1 h-px bg-[var(--wa-menu-divider)]" />}

              <ContextMenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
            </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}