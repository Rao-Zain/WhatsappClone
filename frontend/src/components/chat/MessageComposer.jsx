import { useEffect, useRef, useState } from "react";
import {

  Paperclip,
  Mic,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  Camera,
  Headphones,
  UserRound,
  ListFilter,
  CalendarDays,
  Sticker,
  Play,

} from "lucide-react";
import useTheme from "../../theme/useTheme"
import EmojiPicker from "emoji-picker-react";
import ReplyPreview from "./ReplyPreview";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";

export default function MessageComposer({
  onSendMessage,
  isSending = false,
  uploadProgress = 0,
  replyTo = null,
  onCancelReply,
  conversationId,
}) {
  const [drafts, setDrafts] = useState({});
  const [text, setText] = useState("");
  const previousConversationIdRef = useRef(conversationId);
  const [sendError, setSendError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
const [previewUrls, setPreviewUrls] = useState([]);
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // Kept only if a voice upload fails, so the user can retry.
  const [failedVoice, setFailedVoice] = useState(null);

  const waveformRef = useRef(null);
  const recordPluginRef = useRef(null);
  const discardRef = useRef(false);
  const onSendMessageRef = useRef(onSendMessage);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Always call the latest onSendMessage from async recorder callbacks.
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  });

  // Focus the message input when a conversation opens or changes.
  useEffect(() => {
    if (!conversationId) return;

    const frameId = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [conversationId]);

  // Keep the existing reply-to focus behavior.
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo?.id]);

  // Save the current draft and restore the draft for the selected chat.
  const draftsRef = useRef({});
  const textRef = useRef("");
  // const previousConversationIdRef = useRef(conversationId);

  useEffect(() => {
    textRef.current = text;
  }, [text]);


  // Create temporary URLs for image/video previews.
// Revoke them when files change or the composer unmounts.
useEffect(() => {
  const urls = selectedFiles.map((file) => ({
    url:
      file.type.startsWith("image/") ||
      file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : null,
  }));

  setPreviewUrls(urls);

  return () => {
    urls.forEach(({ url }) => {
      if (url) URL.revokeObjectURL(url);
    });
  };
}, [selectedFiles]);

  useEffect(() => {
    const previousId = previousConversationIdRef.current;

    if (previousId === conversationId) return;

    if (previousId) {
      draftsRef.current[previousId] = textRef.current;
    }

    const nextDraft = conversationId
      ? draftsRef.current[conversationId] || ""
      : "";

    textRef.current = nextDraft;
    setText(nextDraft);
    previousConversationIdRef.current = conversationId;
  }, [conversationId]);

  const attachmentOptions = [
    {
      label: "Document",
      icon: FileText,
      color: "#7f66ff",
      accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar",
    },
    {
      label: "Photos & videos",
      icon: ImageIcon,
      color: "#007bfc",
      accept: "image/*,video/*",
    },
    { label: "Camera", icon: Camera, color: "#ff2e74", action: "camera" },
    {
      label: "Audio",
      icon: Headphones,
      color: "#ff6b35",
      accept: "audio/*",
    },
    { label: "Contact", icon: UserRound, color: "#009de2", action: "contact" },
    { label: "Poll", icon: ListFilter, color: "#ff9800", action: "poll" },
    { label: "Event", icon: CalendarDays, color: "#ff4778", action: "event" },
    {
      label: "New sticker",
      icon: Sticker,
      color: "#00a884",
      action: "sticker",
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Voice recording                                                     */
  /* ------------------------------------------------------------------ */

  async function sendVoiceFile(file) {
    setIsSendingVoice(true);
    setSendError("");

    try {
      await onSendMessageRef.current("", [file], "voice");
      setFailedVoice(null);
    } catch (error) {
      setFailedVoice(file);
      setSendError(
        error.response?.data?.message ||
        error.message ||
        "Failed to send voice message. Please try again."
      );
    } finally {
      setIsSendingVoice(false);
    }
  }

  // The recorder and waveform live only while isRecording is true.
  // Effect cleanup releases the microphone and destroys the waveform,
  // whether recording ended normally, was cancelled, or the component unmounted.
  useEffect(() => {
    if (!isRecording || !waveformRef.current) return;

    let disposed = false;
    discardRef.current = false;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      height: 32,
      waveColor:
        getComputedStyle(document.documentElement)
          .getPropertyValue("--wa-wave")
          .trim() || "#00a884",
      cursorWidth: 0,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      interact: false,
    });

    const record = wavesurfer.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: true,
        scrollingWaveformWindow: 6,
        renderRecordedAudio: false,
      })
    );

    recordPluginRef.current = record;

    record.on("record-start", () => {
      if (!disposed) setIsPreparingRecording(false);
    });

    record.on("record-progress", (ms) => {
      if (!disposed) setRecordingTime(Math.floor(ms / 1000));
    });

    record.on("record-end", (blob) => {
      // Cancelled or unmounted: throw the recording away.
      if (disposed || discardRef.current) return;

      setIsRecording(false);
      setIsFinalizing(false);
      setIsPreparingRecording(false);

      if (!blob || blob.size === 0) {
        setSendError("No audio was recorded. Please try again.");
        return;
      }

      const mimeType = blob.type || "audio/webm";
      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";

      const file = new File([blob], `voice-message-${Date.now()}.${extension}`, {
        type: mimeType,
      });

      // Recording is finalized at this point; now upload it.
      sendVoiceFile(file);
    });

    record
      .startRecording()
      .then(() => {
        // Cancelled while the permission prompt was open.
        if (disposed) record.stopMic();
      })
      .catch((error) => {
        if (disposed) return;

        setIsRecording(false);
        setIsPreparingRecording(false);
        setIsFinalizing(false);
        setSendError(
          error?.name === "NotAllowedError"
            ? "Microphone permission was denied. Allow microphone access in your browser settings."
            : error?.name === "NotFoundError"
              ? "No microphone was found on this device."
              : "Could not start recording. Please check your microphone."
        );
      });

    return () => {
      disposed = true;

      try {
        if (record.isRecording()) {
          discardRef.current = true;
          record.stopRecording();
        }
        record.stopMic();
      } catch {
        // ignore cleanup errors
      }

      wavesurfer.destroy();
      recordPluginRef.current = null;
    };
  }, [isRecording]);

  function startRecording() {
    if (isSending || isSendingVoice || isPreparingRecording || isRecording) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setSendError(
        "Voice recording is not supported by this browser. Try a recent version of Chrome or Edge."
      );
      return;
    }

    setSendError("");
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);
    setSelectedFiles([]);
    setFailedVoice(null);
    setRecordingTime(0);
    setIsPreparingRecording(true);
    setIsRecording(true);
  }

  // Send pressed while recording: stop, wait for the final blob, then upload.
  function finishRecordingAndSend() {
    const record = recordPluginRef.current;

    if (!record || !record.isRecording() || isFinalizing) return;

    setIsFinalizing(true);
    record.stopRecording(); // "record-end" fires with the finished blob
  }

  function cancelRecording() {
    discardRef.current = true;

    // Turning isRecording off runs the effect cleanup, which stops the
    // recorder, releases the microphone and destroys the waveform.
    setIsRecording(false);
    setIsPreparingRecording(false);
    setIsFinalizing(false);
    setRecordingTime(0);
    setSendError("");
  }

  function discardFailedVoice() {
    setFailedVoice(null);
    setSendError("");
  }

  function formatRecordingTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  /* ------------------------------------------------------------------ */
  /* Sending                                                             */
  /* ------------------------------------------------------------------ */

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSending || isSendingVoice || isFinalizing || isPreparingRecording) {
      return;
    }

    // Send pressed during recording.
    if (isRecording) {
      finishRecordingAndSend();
      return;
    }

    // Retry a voice message that failed to upload.
    if (failedVoice) {
      await sendVoiceFile(failedVoice);
      return;
    }

    const trimmedText = text.trim();

    if (!trimmedText && selectedFiles.length === 0) {
      setSendError("Add a message or at least one file.");
      return;
    }

    setSendError("");

    try {
      await onSendMessage(trimmedText, selectedFiles);

      setText("");
      textRef.current = "";

      if (conversationId) {
        delete draftsRef.current[conversationId];
      }

      setSelectedFiles([]);
    } catch (error) {
      setSendError(
        error.response?.data?.message ||
        error.message ||
        "Failed to send message. Please try again."
      );
    }
  }

  function handleEmojiClick(emojiData) {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;

    const nextText = text.slice(0, start) + emojiData.emoji + text.slice(end);

    setText(nextText);
    setShowEmojiPicker(false);

    requestAnimationFrame(() => {
      input.focus();

      const cursor = start + emojiData.emoji.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  function openFilePicker(option) {
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);

    if (option.action) {
      if (option.action === "camera") {
        fileInputRef.current.accept = "image/*";
        fileInputRef.current.setAttribute("capture", "environment");
        fileInputRef.current.click();
        return;
      }

      if (option.action === "contact") {
        alert("Contact sharing UI can be implemented next.");
        return;
      }

      if (option.action === "poll") {
        alert("Poll creation UI can be implemented next.");
        return;
      }

      if (option.action === "event") {
        alert("Event creation UI can be implemented next.");
        return;
      }

      if (option.action === "sticker") {
        alert("Sticker creation UI can be implemented next.");
        return;
      }
    }

    fileInputRef.current.accept = option.accept;
    fileInputRef.current.removeAttribute("capture");
    fileInputRef.current.click();
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > 0) {
      setSelectedFiles((previous) => [...previous, ...files]);
      setSendError("");
    }

    // Allow selecting the same file again later.
    event.target.value = "";
  }

  function removeFile(index) {
    setSelectedFiles((previous) =>
      previous.filter((_, fileIndex) => fileIndex !== index)
    );
  }

  const { isDark } = useTheme();

  const showSendButton =
    isRecording ||
    isSendingVoice ||
    failedVoice ||
    text.trim() ||
    selectedFiles.length > 0;

  const sendDisabled =
    isSending || isSendingVoice || isPreparingRecording || isFinalizing;

  const iconBtn =
    "grid size-10 shrink-0 place-items-center rounded-full text-[color:var(--wa-composer-icon)] transition-colors hover:bg-[var(--wa-hover)] disabled:opacity-40";

  const roundBtn =
    "grid size-10 shrink-0 place-items-center rounded-full bg-[var(--wa-send-bg)] text-[color:var(--wa-send-fg)] transition-colors hover:bg-[var(--wa-send-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

  const attachButton = (extra = "") => (
    <button
      type="button"
      aria-label="Attach"
      title="Attach"
      disabled={isRecording}
      onClick={() => {
        setShowEmojiPicker(false);
        setShowAttachmentMenu((open) => !open);
      }}
      className={`${iconBtn} ${extra} ${showAttachmentMenu ? "!text-[color:var(--wa-composer-icon-active)]" : ""
        }`}
    >
      <Paperclip size={22} strokeWidth={2} className="-rotate-45" />
    </button>
  );

  // mobile=true: round green button outside the pill (phone layout).
  // mobile=false: button inside the pill (desktop layout, plain mic).
  const actionButton = (mobile) => {
    if (showSendButton) {
      return (
        <button
          type="submit"
          disabled={sendDisabled}
          aria-label={isRecording ? "Send voice message" : "Send message"}
          title={isRecording ? "Send voice message" : "Send"}
          className={`${roundBtn} ${mobile ? "sm:hidden" : "hidden sm:grid"}`}
        >
          <Send size={20} strokeWidth={2.2} className="-translate-x-px" fill="currentColor" />
        </button>
      );
    }

    return (
      <button
        type="button"
        aria-label="Voice message"
        title="Record voice message"
        disabled={isSending}
        onClick={startRecording}
        className={mobile ? `${roundBtn} sm:hidden` : `${iconBtn} hidden sm:grid`}
      >
        <Mic size={22} strokeWidth={2} />
      </button>
    );
  };

  return (
    <div className="relative z-20 shrink-0 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-3">
      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="wa-shadow-menu absolute bottom-[76px] left-2 z-50 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl sm:left-4">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={320}
            height={380}
            theme={isDark ? "dark" : "light"}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Attachment menu */}
      {showAttachmentMenu && (
        <>
          <button
            type="button"
            aria-label="Close attachment menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setShowAttachmentMenu(false)}
          />

          <div className="wa-shadow-menu absolute bottom-[76px] left-2 z-40 w-[210px] overflow-hidden rounded-2xl bg-[var(--wa-menu-bg)] py-2 sm:left-4">
            {attachmentOptions.map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => openFilePicker(option)}
                  className="flex h-[36px] w-full items-center gap-3 px-4 text-left text-[14px] text-[color:var(--wa-menu-text)] transition-colors hover:bg-[var(--wa-menu-hover)]"
                >
                  <Icon size={17} strokeWidth={2.5} style={{ color: option.color }} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

   
{/* Selected attachment previews */}
{selectedFiles.length > 0 && (
  <div className="mb-3 flex flex-wrap gap-3">
    {selectedFiles.map((file, index) => {
      const previewUrl = previewUrls[index]?.url;
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const isVisualMedia = isImage || isVideo;

      return (
        <div
          key={`${file.name}-${file.lastModified}-${index}`}
          className="wa-shadow-float relative overflow-hidden rounded-xl border border-[var(--wa-border)] bg-[var(--wa-menu-bg)]"
        >
          {isVisualMedia && previewUrl ? (
            <div className="relative h-32 w-36 overflow-hidden bg-[var(--wa-hover)]">
              {isImage ? (
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <video
                    src={previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20">
                    <span className="grid size-10 place-items-center rounded-full bg-black/60 text-white">
                      <Play size={20} fill="currentColor" />
                    </span>
                  </div>
                </>
              )}

              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-black/85"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-64 max-w-[75vw] items-center gap-3 px-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--wa-hover)]">
                {isAudio ? (
                  <Headphones
                    size={22}
                    className="text-[color:var(--wa-icon)]"
                  />
                ) : (
                  <FileText
                    size={22}
                    className="text-[color:var(--wa-icon)]"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[color:var(--wa-text-strong)]">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-[color:var(--wa-text-secondary)]">
                  {isAudio ? "Audio" : "Document"} ·{" "}
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
                className="grid size-8 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {isVisualMedia && (
            <div className="max-w-36 px-2 py-1.5">
              <p className="truncate text-xs text-[color:var(--wa-text-strong)]">
                {file.name}
              </p>
              <p className="text-[11px] text-[color:var(--wa-text-secondary)]">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>
      );
    })}
  </div>
)}


      {isSending && (selectedFiles.length > 0 || isSendingVoice) && (
        <div className="wa-shadow-float mb-2 rounded-lg bg-[var(--wa-menu-bg)] px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--wa-icon)]">
            <span>{isSendingVoice ? "Uploading voice message..." : "Uploading attachments..."}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--wa-progress-track)]"
            role="progressbar"
            aria-label="Attachment upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress}
          >
            <div
              className="h-full rounded-full bg-[var(--wa-accent)] transition-[width] duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {sendError && (
        <p className="mb-2 px-3 text-xs text-[color:var(--wa-danger)]">{sendError}</p>
      )}

      {/* Reply preview */}
      {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}

      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
        {/* Pill: 52px tall, fully rounded, 6px inner padding */}
        <div className="wa-shadow-float flex min-h-[52px] min-w-0 flex-1 items-center rounded-full bg-[var(--wa-composer-bg)] px-1.5 py-1">
          {/* Desktop: attach first. Phone: emoji first, attach on the right. */}
          {attachButton("hidden sm:grid")}

          <button
            type="button"
            aria-label="Emoji and stickers"
            title="Emoji"
            disabled={isRecording}
            onClick={() => {
              setShowAttachmentMenu(false);
              setShowEmojiPicker((open) => !open);
            }}
            className={`${iconBtn} ${showEmojiPicker ? "!text-[color:var(--wa-composer-icon-active)]" : ""}`}
          >
            <Sticker size={22} strokeWidth={2} />
          </button>

          {/* Recording controls, failed-voice retry, or message input */}
          {isRecording ? (
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
              <button
                type="button"
                onClick={cancelRecording}
                disabled={isFinalizing}
                aria-label="Cancel recording"
                title="Cancel recording"
                className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)] disabled:opacity-40"
              >
                <X size={20} />
              </button>

              <span className="size-2 shrink-0 animate-pulse rounded-full bg-[var(--wa-recording)]" />

              <span className="w-10 shrink-0 text-sm font-medium tabular-nums text-[color:var(--wa-recording)]">
                {formatRecordingTime(recordingTime)}
              </span>

              <div className="relative h-8 min-w-0 flex-1">
                <div ref={waveformRef} className="h-8 w-full" />
                {(isPreparingRecording || isFinalizing) && (
                  <span className="absolute inset-0 flex items-center bg-[var(--wa-composer-bg)] text-sm text-[color:var(--wa-composer-placeholder)]">
                    {isFinalizing ? "Finishing recording..." : "Waiting for microphone..."}
                  </span>
                )}
              </div>
            </div>
          ) : isSendingVoice || failedVoice ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              {failedVoice && !isSendingVoice && (
                <button
                  type="button"
                  onClick={discardFailedVoice}
                  aria-label="Discard voice message"
                  title="Discard voice message"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]"
                >
                  <X size={20} />
                </button>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--wa-composer-placeholder)]">
                {isSendingVoice
                  ? "Sending voice message..."
                  : "Voice message not sent. Press send to retry."}
              </span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(event) => {
                const nextText = event.target.value;

                textRef.current = nextText;
                setText(nextText);

                if (conversationId) {
                  draftsRef.current[conversationId] = nextText;
                }

                if (nextText.trim()) setSendError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowEmojiPicker(false);
                  setShowAttachmentMenu(false);
                  onCancelReply?.();
                }
              }}
              placeholder="Type a message"
              aria-label="Type a message"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[15px] leading-5 text-[color:var(--wa-composer-text)] outline-none placeholder:text-[color:var(--wa-composer-placeholder)] focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none"
            />
          )}

          {/* Phone: attach + camera on the right of the pill */}
          {attachButton("sm:hidden")}
          {!showSendButton && (
            <button
              type="button"
              aria-label="Camera"
              title="Camera"
              disabled={isRecording}
              onClick={() => openFilePicker(attachmentOptions[2])}
              className={`${iconBtn} sm:hidden`}
            >
              <Camera size={22} strokeWidth={2} />
            </button>
          )}

          {/* Desktop: mic / send inside the pill */}
          {actionButton(false)}
        </div>

        {/* Phone: round green mic / send outside the pill */}
        {actionButton(true)}
      </form>
    </div>
  );
}