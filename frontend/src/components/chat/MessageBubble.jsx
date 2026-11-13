import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, ChevronDown, Forward, Star, Download, FileText, Trash2 } from "lucide-react";
import api from "../../../lib/api";
import QuotedMessage from "./QuotedMessage";
import VoiceNotePlayer from "./VoiceNotePlayer";
import MessageMedia from "./MessageMedia";
// import
import HighlightedText from "./HighlightedText";


// A stable colour per sender so each person is easy to tell apart in a group.
function senderColor(id = "") {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash} 55% 48%)`;
}


function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMessageTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  message,
  showTail = true,
  showSender = false,
  highlight = "",
  onJumpToMessage,
  onOpenMenu,
  onMediaClick,
  onDeleteAttachment, // (messageId, fileId) => void
}) {
  const isMe = message.sender === "me";
  const isRead = message.status === "read";
  const isDelivered = message.status === "delivered";
  const attachments = useMemo(() => message.attachments || [], [message.attachments]);
  const attachmentKey = attachments.map((file) => file._id).join("|");

  const [objectUrls, setObjectUrls] = useState({});
  const [loadingFiles, setLoadingFiles] = useState({});

  // Download audio / voice files (photos and videos are handled by MessageMedia).
  useEffect(() => {
    let cancelled = false;
    const createdUrls = [];

    async function loadAudio() {
      const audioFiles = attachments.filter((file) => {
        const mime = file.mimeType || "";
        return (
          mime.startsWith("audio/") ||
          ((message.type === "voice" || message.type === "audio") &&
            !mime.startsWith("image/") &&
            !mime.startsWith("video/"))
        );
      });

      const entries = await Promise.all(
        audioFiles.map(async (file) => {
          if (file.url) return [file._id, file.url];
          if (!file.downloadUrl) return [file._id, null];

          try {
            const response = await api.get(file.downloadUrl, { responseType: "blob" });
            const blobUrl = URL.createObjectURL(response.data);
            createdUrls.push(blobUrl);
            return [file._id, blobUrl];
          } catch {
            return [file._id, file.downloadUrl];
          }
        })
      );

      if (!cancelled) {
        setObjectUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
    // attachmentKey is the stable identity of the attachments list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.type, attachmentKey]);

  // Separate visual media from documents & voice notes
  const visualMedia = attachments.filter((file) => {
    const mime = file.mimeType || "";
    return mime.startsWith("image/") || mime.startsWith("video/");
  });

  const otherFiles = attachments.filter((file) => {
    const mime = file.mimeType || "";
    return !mime.startsWith("image/") && !mime.startsWith("video/");
  });

  const statusLabel = isRead ? "Read" : isDelivered ? "Delivered" : "Sent";

  const meta = (
    <>
      {message.starred && (
        <Star size={11} className="fill-[var(--wa-bubble-meta)] text-[color:var(--wa-bubble-meta)]" />
      )}

            {message.isEdited && <span>Edited</span>}
            
      <span>{message.time || formatMessageTime(message.createdAt)}</span>
      {isMe && (
        <span
          aria-label={statusLabel}
          title={statusLabel}
          className={isRead ? "text-[color:var(--wa-tick-read)]" : "text-[color:var(--wa-bubble-meta)]"}
        >
          {isDelivered || isRead ? <CheckCheck size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
        </span>
      )}
    </>
  );

  const metaClass =
    "flex h-[15px] items-center gap-[3px] text-[11px] leading-[15px] text-[color:var(--wa-bubble-meta)]";

  const totalVisual = visualMedia.length;
  const hasCaption = Boolean(message.text);

  // Time + ticks drawn in white on top of the picture (no caption case).
  const overlayMeta = (
    <span className="flex items-center gap-[3px] text-[11px] leading-[15px] text-white">
      {message.isEdited && <span>Edited</span>}
      <span>{message.time || formatMessageTime(message.createdAt)}</span>
      {isMe && (
        <span
          aria-label={statusLabel}
          title={statusLabel}
          className={isRead ? "text-[color:var(--wa-tick-read)]" : "text-white"}
        >
          {isDelivered || isRead ? <CheckCheck size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
        </span>
      )}
    </span>
  );

  return (
    <div
      className={`wa-shadow-bubble relative min-w-0 max-w-[85%] rounded-lg sm:max-w-[70%] md:max-w-[55%] ${
        totalVisual > 0 ? "w-[330px] p-[3px]" : "p-[6px]"
      } ${
        isMe ? "bg-[var(--wa-bubble-out-bg)]" : "bg-[var(--wa-bubble-in-bg)]"
      } ${showTail ? (isMe ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
    >
      {showTail && (
        <span
          aria-hidden="true"
          className={`absolute top-0 h-0 w-0 border-t-[8px] border-t-transparent ${
            isMe
              ? "right-[-7px] border-l-[8px] border-l-[color:var(--wa-bubble-out-bg)]"
              : "left-[-7px] border-r-[8px] border-r-[color:var(--wa-bubble-in-bg)]"
          }`}
        />
      )}

      {/* Message Options Dropdown */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu(message, { x: rect.right, y: rect.bottom + 4, mode: "full" });
          }}
          className="absolute right-0 top-0 z-20 hidden h-7 items-start justify-end rounded-tr-lg pl-8 pr-1.5 pt-1 text-[color:var(--wa-icon)] opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:hover)]:flex"
        >
          <ChevronDown size={20} strokeWidth={2} />
        </button>
      )}

            {showSender && message.senderName && (
        <p
          className="mb-0.5 truncate px-1 text-[12.8px] font-medium leading-[18px]"
          style={{ color: senderColor(message.senderId) }}
        >
          {message.senderName}
        </p>
      )}

      {message.forwarded && (
        <p className="mb-1 px-1 flex items-center gap-1 text-[12.5px] italic text-[color:var(--wa-bubble-meta)]">
          <Forward size={13} /> Forwarded
        </p>
      )}

      {message.replyTo && (
        <div className="mb-1">
          <QuotedMessage reply={message.replyTo} onClick={() => onJumpToMessage?.(message.replyTo.id)} />
        </div>
      )}

      {/* --- Photos & videos (WhatsApp-style) --- */}
      {totalVisual > 0 && (
        <MessageMedia
          files={visualMedia}
          timeOverlay={hasCaption || otherFiles.length > 0 ? null : overlayMeta}
          canDelete={isMe && Boolean(onDeleteAttachment)}
          onDelete={(fileId) => onDeleteAttachment?.(message.id, fileId)}
          onOpen={onMediaClick}
        />
      )}

      {/* --- Other Documents & Audio Files --- */}
      {otherFiles.map((file) => {
        const url = objectUrls[file._id] || file.url || file.downloadUrl;
        const isAudio =
          file.mimeType?.startsWith("audio/") ||
          message.type === "voice" ||
          message.type === "audio";

        return (
          <div key={file._id} className="group/item relative mt-1 min-w-[200px]">
            {isAudio ? (
              <VoiceNotePlayer
                audioUrl={url}
                senderAvatar={message.senderAvatar}
                senderName={message.senderName}
                isMe={isMe}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-[var(--wa-bubble-overlay)] p-2.5">
                <FileText size={26} className="shrink-0 text-[color:var(--wa-icon)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[color:var(--wa-bubble-text)]">
                    {file.originalName}
                  </p>
                  <p className="text-[10px] text-[color:var(--wa-bubble-meta)]">{formatSize(file.size)}</p>
                </div>
                <a
                  href={url}
                  download={file.originalName}
                  className="rounded-full p-1.5 text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
                >
                  <Download size={16} />
                </a>
              </div>
            )}

            {/* Single Delete for files */}
            {isMe && onDeleteAttachment && (
              <button
                type="button"
                onClick={() => onDeleteAttachment(message.id, file._id)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/40 p-1 text-white hover:bg-red-600 group-hover/item:block"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        );
      })}

      {/* Text & Meta */}
      {message.text ? (
        <p
          className={`whitespace-pre-wrap break-words pt-1 text-[14.2px] leading-[19px] text-[color:var(--wa-bubble-text)] ${
            totalVisual > 0 ? "px-[5px] pb-[3px]" : "px-1"
          }`}
        >
                   <HighlightedText text={message.text} query={highlight} />
          <span className={`${metaClass} float-right -mb-[2px] ml-[10px] mt-[4px]`}>{meta}</span>
        </p>
      ) : totalVisual > 0 && otherFiles.length === 0 ? null : (
        <div className={`${metaClass} justify-end px-1 pt-1`}>{meta}</div>
      )}
    </div>
  );
}