import { useCallback, useState } from "react";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";
import { addMessageWithoutDuplicate, formatMessage } from "./useChatMessages";

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}

export function useMessageActions({ chatId, currentUserId, notifySidebar, updateMessage, setMessages }) {
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((text) => setNotice({ id: Date.now(), text }), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  // Send message via HTTP (attachments) or Socket (text)
  const sendMessage = useCallback(
    async (text, files = [], kind = "text", replyToId = null) => {
      if (!chatId) throw new Error("Please select a conversation.");

      if (files.length > 0) {
        setIsSending(true);
        setUploadProgress(0);
        try {
          const formData = new FormData();
          formData.append("text", text);
          formData.append("type", kind);
          if (replyToId) formData.append("replyTo", replyToId);
          files.forEach((file) => formData.append("files", file));

          const res = await api.post(`/conversations/${chatId}/attachments`, formData, {
            onUploadProgress: (e) => {
              if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
            },
          });

          const formatted = formatMessage(res.data.message, currentUserId);
          setMessages((prev) => addMessageWithoutDuplicate(prev, formatted));
          notifySidebar(formatted);
          setUploadProgress(100);
          return res.data.message;
        } finally {
          setIsSending(false);
        }
      }

      const socket = getSocket();
      setIsSending(true);
      try {
        const savedMessage = await new Promise((resolve, reject) => {
          socket.emit(
            "message:send",
            { conversationId: String(chatId), text, replyTo: replyToId },
            (response) => {
              if (response?.success && response.message) resolve(response.message);
              else reject(new Error(response?.message || "Unable to send message."));
            }
          );
        });

        const formatted = formatMessage(savedMessage, currentUserId);
        setMessages((prev) => addMessageWithoutDuplicate(prev, formatted));
        notifySidebar(formatted);
        return savedMessage;
      } finally {
        setIsSending(false);
      }
    },
    [chatId, currentUserId, notifySidebar, setMessages]
  );

  const react = useCallback(
    async (message, emoji) => {
      const userId = String(currentUserId);
      const prevReactions = message.reactions;
      const mine = prevReactions.find((r) => r.userId === userId);
      const nextEmoji = mine?.emoji === emoji ? "" : emoji;

      updateMessage(message.id, (cur) => ({
        ...cur,
        reactions: [
          ...cur.reactions.filter((r) => r.userId !== userId),
          ...(nextEmoji ? [{ userId, emoji: nextEmoji }] : []),
        ],
      }));

      try {
        await api.put(`/conversations/${chatId}/messages/${message.id}/reaction`, { emoji: nextEmoji });
      } catch {
        updateMessage(message.id, (cur) => ({ ...cur, reactions: prevReactions }));
        showNotice("Couldn't update reaction");
      }
    },
    [chatId, currentUserId, showNotice, updateMessage]
  );

  const copy = useCallback(
    async (text) => {
      try {
        await copyText(text);
        showNotice("Message copied");
      } catch {
        showNotice("Couldn't copy message");
      }
    },
    [showNotice]
  );

  const download = useCallback(
    async (files) => {
      if (!files?.length) return;
      showNotice(files.length > 1 ? "Downloading files..." : "Downloading...");
      try {
        for (const file of files) {
          const res = await api.get(file.downloadUrl, { responseType: "blob" });
          const url = URL.createObjectURL(res.data);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.originalName || "download";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch {
        showNotice("Download failed");
      }
    },
    [showNotice]
  );

  const deleteSingleAttachment = useCallback(
    async (messageId, fileId) => {
      try {
        await api.delete(`/conversations/${chatId}/messages/${messageId}/attachments/${fileId}`);
        setMessages((prev) => {
          const updated = prev
            .map((msg) =>
              msg.id === messageId
                ? { ...msg, attachments: msg.attachments.filter((f) => f._id !== fileId) }
                : msg
            )
            .filter((msg) => msg.text || msg.attachments.length > 0);

          if (updated.length > 0) notifySidebar(updated[updated.length - 1]);
          return updated;
        });
      } catch (err) {
        showNotice(err.response?.data?.message || "Couldn't delete attachment");
      }
    },
    [chatId, notifySidebar, setMessages, showNotice]
  );

  return {
    isSending,
    uploadProgress,
    notice,
    clearNotice,
    showNotice,
    sendMessage,
    react,
    copy,
    download,
    deleteSingleAttachment,
  };
}