import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

function formatMessageTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeReactions(list) {
  return (list || []).map((reaction) => ({
    userId: String(reaction.userId),
    emoji: reaction.emoji,
  }));
}

function formatReply(reply, currentUserId) {
  if (!reply) return null;
  const senderId = reply.sender?._id || reply.sender;

  return {
    id: String(reply._id),
    isMine: Boolean(senderId) && String(senderId) === String(currentUserId),
    senderName: reply.sender?.name?.trim() || reply.sender?.username || "",
    text: reply.text || "",
    type: reply.type || "text",
    deleted: Boolean(reply.deletedForEveryone),
  };
}

export function formatMessage(message, currentUserId) {
  const senderId = message.sender?._id || message.sender;

  return {
    id: String(message._id || message.id),
    text: message.text || "",
    type: message.type || "text",
    attachments: message.attachments || [],
    time: formatMessageTime(message.createdAt),
    sender: String(senderId) === String(currentUserId) ? "me" : "other",
    senderId: String(senderId),
    senderName: message.sender?.name?.trim() || message.sender?.username || "",
    senderAvatar: message.sender?.avatar || message.sender?.profilePicture || null,
    createdAt: message.createdAt,
    status: message.status || (message.read ? "read" : message.delivered ? "delivered" : "sent"),
    forwarded: Boolean(message.forwarded),
        isEdited: Boolean(message.editedAt),
    starred: Boolean(message.starred),
    deletedForEveryone: Boolean(message.deletedForEveryone),
    reactions: normalizeReactions(message.reactions),
    replyTo: formatReply(message.replyTo, currentUserId),
  };
}

export function addMessageWithoutDuplicate(previous, incomingMessage) {
  const existingIndex = previous.findIndex((m) => m.id === incomingMessage.id);
  if (existingIndex !== -1) {
    return previous.map((m, index) => (index === existingIndex ? incomingMessage : m));
  }
  return [...previous, incomingMessage];
}

function mergeMessages(previous, loaded) {
  const messageMap = new Map();
  loaded.forEach((m) => messageMap.set(m.id, m));
  previous.forEach((m) => messageMap.set(m.id, m));
  return [...messageMap.values()].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
}

function applyDeletedForEveryone(list, messageId) {
  return list.map((message) => {
    if (message.id === messageId) {
      return {
        ...message,
        text: "",
        attachments: [],
        reactions: [],
        forwarded: false,
        starred: false,
        replyTo: null,
        deletedForEveryone: true,
      };
    }
    if (message.replyTo?.id === messageId) {
      return { ...message, replyTo: { ...message.replyTo, deleted: true, text: "" } };
    }
    return message;
  });
}

export function useChatMessages({
  chatId,
  currentUserId,
  onConversationRead,
  onMessageStatusChange,
  notifySidebar,
}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHistory, setIsHistory] = useState(false);
  const isHistoryRef = useRef(false);
  const loadRequestId = useRef(0);

    // Older messages (loaded when scrolling up)
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [olderFailed, setOlderFailed] = useState(false);
  const messagesRef = useRef([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  
  useEffect(() => {
    isHistoryRef.current = isHistory;
  }, [isHistory]);


  const updateMessage = useCallback((messageId, updater) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? updater(m) : m)));
  }, []);

  const markConversationRead = useCallback(async () => {
    if (!chatId) return;

    try {
      await api.post(`/conversations/${chatId}/read`);
      if (typeof onConversationRead === "function") {
        onConversationRead(String(chatId));
      }
    } catch (err) {
      console.error("Unable to mark messages as read:", err);
    }
  }, [chatId, onConversationRead]);

  // 1. Initial REST Load
  const loadMessages = useCallback(async () => {
    const requestId = ++loadRequestId.current;

        setIsHistory(false);
    setHasMore(false);
    setIsLoadingOlder(false);
    setOlderFailed(false);

        setIsHistory(false);

    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      setError("");
      return;
    }

    // Never carry messages across conversations while the next history loads.
    setMessages([]);
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get(`/conversations/${chatId}/messages`);
      const formatted = (response.data.messages || []).map((m) => formatMessage(m, currentUserId));
      if (requestId === loadRequestId.current) {
        setMessages((prev) => mergeMessages(prev, formatted));
      }
    } catch (err) {
      if (requestId === loadRequestId.current) {
        setError(err.response?.data?.message || "Unable to load messages. Please try again.");
      }
    } finally {
      if (requestId === loadRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [chatId, currentUserId]);


    // Opens the part of the history around one message (used by search results).
  // Returns true when it worked.
  const loadAround = useCallback(
    async (messageId) => {
      if (!chatId) return false;

      const requestId = ++loadRequestId.current;

      try {
        const response = await api.get(`/conversations/${chatId}/messages`, {
          params: { around: messageId },
        });

        if (requestId !== loadRequestId.current) return false;

        setMessages((response.data.messages || []).map((m) => formatMessage(m, currentUserId)));
        setIsHistory(Boolean(response.data.hasNewer));
          setHasMore(Boolean(response.data.hasMore));
        setOlderFailed(false);

        return true;
      } catch {
        return false;
      }
    },
    [chatId, currentUserId]
  );

    // Loads the next page of older messages (called when scrolling to the top).
  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];

    if (!chatId || !hasMore || isLoadingOlder || !oldest) return;

    // A chat switch or reload changes this number, which cancels this request.
    const requestId = loadRequestId.current;

    setIsLoadingOlder(true);
    setOlderFailed(false);

    try {
      const response = await api.get(`/conversations/${chatId}/messages`, {
        params: { before: oldest.id },
      });

      if (requestId !== loadRequestId.current) return;

      const older = (response.data.messages || []).map((m) => formatMessage(m, currentUserId));

      setMessages((prev) => mergeMessages(prev, older));
      setHasMore(Boolean(response.data.hasMore));
    } catch {
      if (requestId === loadRequestId.current) setOlderFailed(true);
    } finally {
      if (requestId === loadRequestId.current) setIsLoadingOlder(false);
    }
  }, [chatId, currentUserId, hasMore, isLoadingOlder]);


  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 2. Mark Conversation as Read
  useEffect(() => {
    markConversationRead();
  }, [markConversationRead]);

  // 3. Socket.IO Listeners
  useEffect(() => {
    if (!chatId) return;
    const socket = getSocket();
    const conversationId = String(chatId);

    function handleNewMessage(message) {
      const incomingId = message.conversation?._id || message.conversation;
      if (String(incomingId) !== conversationId) return;

      const formatted = formatMessage(message, currentUserId);
       if (!isHistoryRef.current) {
        setMessages((prev) => addMessageWithoutDuplicate(prev, formatted));
      }
      notifySidebar(formatted);

      const senderId = message.sender?._id || message.sender;
      if (String(senderId) !== String(currentUserId)) {
        markConversationRead();
      }
    }

    function handleReaction(payload) {
      if (String(payload.conversationId) !== conversationId) return;
      updateMessage(String(payload.messageId), (m) => ({
        ...m,
        reactions: normalizeReactions(payload.reactions),
      }));
    }

    function handleDeleted(payload) {
      if (String(payload.conversationId) !== conversationId) return;
      setMessages((prev) => applyDeletedForEveryone(prev, String(payload.messageId)));
    }

    
    function handleEdited(payload) {
      if (String(payload.conversationId) !== conversationId) return;
      updateMessage(String(payload.messageId), (m) => ({
        ...m,
        text: payload.text,
        isEdited: true,
      }));
    }

    // Double Gray Tick Listener
    function handleDelivered(payload) {
      if (String(payload.conversationId) !== conversationId) return;
      const deliveredIds = new Set(
        (payload.messageIds || []).map((id) => String(id))
      );
      onMessageStatusChange?.(
        conversationId,
        "delivered",
        [...deliveredIds]
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === "me" &&
          m.status === "sent" &&
          (!deliveredIds.size || deliveredIds.has(m.id))
            ? { ...m, status: "delivered" }
            : m
        )
      );
    }

    // Double Blue Tick Listener
       function handleRead(payload) {
      if (String(payload.conversationId) !== conversationId) return;

      // Groups send only the messages that EVERY member has now read.
      const readIds = payload.messageIds
        ? new Set(payload.messageIds.map(String))
        : null;

      onMessageStatusChange?.(conversationId, "read", payload.messageIds || []);
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === "me" && (!readIds || readIds.has(m.id))
            ? { ...m, status: "read" }
            : m
        )
      );
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:reaction", handleReaction);
    socket.on("message:deleted", handleDeleted);
        socket.on("message:edited", handleEdited);
    socket.on("messages:delivered", handleDelivered);
    socket.on("messages:read", handleRead);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:reaction", handleReaction);
      socket.off("message:deleted", handleDeleted);
      socket.off("messages:delivered", handleDelivered);
      socket.off("messages:read", handleRead);
    };
  }, [
    chatId,
    currentUserId,
    markConversationRead,
    notifySidebar,
    onMessageStatusChange,
    updateMessage,
  ]);

  return {
    messages,
    setMessages,
    isLoading,
    error,
    reload: loadMessages,
    updateMessage,
     isHistory,
    loadAround,
    hasMore,
    isLoadingOlder,
    olderFailed,
    loadOlder,
  };
}