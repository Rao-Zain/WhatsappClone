
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import { getSocket } from "../../lib/socket";
import NavigationRail from "./layout/NavigationRail";
import Sidebar from "./sidebar/Sidebar";
import ChatWindow from "./chat/ChatWindow";
import { useAuth } from "../context/AuthContext";
import { useNavCounts } from "../context/NavCountsContext";
import { useCallback } from "react";
import { PresenceProvider } from "../context/PresenceContext";
import useCall from "../hooks/useCall";
import CallOverlay from "../components/call/CallOverlay";
import useAppSounds from "../hooks/useAppSounds";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import useIsMobile, { isMobileNow } from "../hooks/useIsMobile";
import CallsSidebar from "./calls/CallsSidebar";
import CallsMain from "./calls/CallsMain";
import { useCallHistory } from "./calls/useCallHistory";
import useStatuses from "./status/useStatuses";
import StatusSidebar from "./status/StatusSidebar";
import StatusMain from "./status/StatusMain";
import {
  requestNotificationPermission, showNotification, isAppActive } from "../../lib/notifications";


function getCurrentUser() {
  try {
    const storedUser =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function getCurrentUserId() {
  const user = getCurrentUser();
  return user?._id || user?.id || null;
}

function formatTime(date) {
  if (!date) return "";

  const messageDate = new Date(date);

  if (Number.isNaN(messageDate.getTime())) return "";

  const now = new Date();

  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (messageDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

// Text shown under a chat name. In groups, incoming messages get the sender's name.
function getPreview(isGroup, message, isOwnMessage, fallback) {
  if (!message.text) return fallback;
    if (message.type === "system") return message.text;
  if (!isGroup || isOwnMessage) return message.text;

  const senderName =
    message.sender?.name?.trim() || message.sender?.username || "Someone";

  return `${senderName}: ${message.text}`;
}

function formatConversation(conversation, currentUserId) {
  const participants = conversation.participants || [];

  const otherParticipant = participants.find(
    (participant) =>
      String(participant._id || participant.id || participant) !==
      String(currentUserId)
  );

  const lastMessage = conversation.lastMessage;

  const isGroup = conversation.type === "group";
    const adminIds = isGroup
    ? (conversation.admins || []).map((admin) => String(admin._id || admin.id || admin))
    : [];

  const senderId = lastMessage?.sender?._id ||
    lastMessage?.sender?.id ||
    lastMessage?.sender;

  return {
    id: String(conversation._id || conversation.id),
    name: isGroup
      ? conversation.groupName || "Unnamed group"
      : otherParticipant?.name?.trim() ||
      otherParticipant?.username ||
      "Unknown user",
    avatar: isGroup
      ? conversation.groupPicture || ""
      : otherParticipant?.profilePicture || "",
    time: formatTime(
      lastMessage?.createdAt || conversation.updatedAt
    ),
     message: lastMessage?.deletedForEveryone
      ? "This message was deleted"
      : lastMessage?.type === "system"
        ? lastMessage.text
        : lastMessage?.text
          ? isGroup && senderId && String(senderId) !== String(currentUserId)
            ? `${lastMessage.sender?.name?.trim() || lastMessage.sender?.username || "Someone"}: ${lastMessage.text}`
            : lastMessage.text
          : "No messages yet",

    username: isGroup ? "" : otherParticipant?.username || "",

    profileName: isGroup ? "" : otherParticipant?.name || "",   // ADD
    about: isGroup ? "" : otherParticipant?.about || "",       

    userId: isGroup
      ? ""
      : String(otherParticipant?._id || otherParticipant?.id || ""),
    isOnline: isGroup ? false : Boolean(otherParticipant?.isOnline),
    lastSeen: isGroup ? null : otherParticipant?.lastSeen || null,

     // Group info (empty for private chats)
    adminIds,
    isAdmin: adminIds.includes(String(currentUserId)),
    members: isGroup
      ? participants.map((participant) => {
          const id = String(participant._id || participant.id || participant);

          return {
            id,
            name:
              participant.name?.trim() || participant.username || "Unknown user",
            avatar: participant.profilePicture || "",
            about: participant.about || "",
            isAdmin: adminIds.includes(id),
          };
        })
      : [],
    memberNames: isGroup
      ? [
          ...participants
            .filter(
              (participant) =>
                String(participant._id || participant.id || participant) !==
                String(currentUserId)
            )
            .map(
              (participant) =>
                participant.name?.trim() || participant.username || "Unknown"
            ),
          "You",
        ].join(", ")
      : "",

    unread: Number(conversation.unreadCount || 0),

    type: isGroup ? "group" : "personal",
    
    // Block state with the other person (private chats only).
    blockedByMe: isGroup ? false : Boolean(conversation.blockedByMe),
    blockedByOther: isGroup ? false : Boolean(conversation.blockedByOther),
    favorite: false,
        sent:
      senderId && lastMessage?.type !== "system"
        ? String(senderId) === String(currentUserId)
        : false,
  };
}

export default function AppLayout() {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewChat, setIsNewChat] = useState(false);

  const [actionError, setActionError] = useState("");
  const { user, setUser } = useAuth();
    const { refreshNavCounts } = useNavCounts();
  const location = useLocation();
  const navigate = useNavigate();
    const view = location.pathname.startsWith("/app/calls")
    ? "calls"
    : location.pathname.startsWith("/app/status")
      ? "status"
      : "chats";
  
  // Phone: one screen at a time. The open chat lives in the address (/app/chat/<id>),
  // so the phone's Back button / swipe-back returns to the chat list.
  const isMobile = useIsMobile();
  const chatRouteId =
    matchPath("/app/chat/:chatId", location.pathname)?.params.chatId || null;
  const showChatOnMobile = isMobile && view === "chats" && Boolean(chatRouteId);

  // Which chat is really open right now (phone: from the address, computer: from the click).
  const openChatId = isMobile
    ? view === "chats"
      ? chatRouteId
      : null
    : selectedChatId;

    
  // Status updates (stories). Created here so they stay loaded while you switch tabs.
  const statuses = useStatuses();

  // ----- Typing indicators -----
  // typingByChat: { [conversationId]: { [userId]: name } }
  // An entry disappears when the person stops, or after 6 seconds without a refresh.
  const [typingByChat, setTypingByChat] = useState({});
  const typingTimers = useRef({});

  useEffect(() => {
    const socket = getSocket();
    const timers = typingTimers.current;

    function handleTyping({ conversationId, userId, name, isTyping }) {
      const chatKey = String(conversationId);
      const userKey = String(userId);
      const timerKey = `${chatKey}:${userKey}`;

      clearTimeout(timers[timerKey]);

      const remove = () => {
        delete timers[timerKey];

        setTypingByChat((previous) => {
          if (!previous[chatKey]?.[userKey]) return previous;

          const people = { ...previous[chatKey] };
          delete people[userKey];

          const next = { ...previous };

          if (Object.keys(people).length) next[chatKey] = people;
          else delete next[chatKey];

          return next;
        });
      };

      if (!isTyping) {
        remove();
        return;
      }

      setTypingByChat((previous) => ({
        ...previous,
        [chatKey]: { ...previous[chatKey], [userKey]: name || "Someone" },
      }));

      timers[timerKey] = setTimeout(remove, 6000);
    }

    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("typing:update", handleTyping);
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const callHistory = useCallHistory({ enabled: view === "calls" });
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const socket = getSocket();
  const call = useCall(socket);
    const [isNewGroup, setIsNewGroup] = useState(false);


  const { playRingtone, stopRingtone, playRingback, stopRingback, playMessage } =
    useAppSounds();

  // Ask for notification permission on the first click (browsers require a gesture).
  // use-sound / Howler unlocks audio on its own, so nothing is needed for sound.
  useEffect(() => {
    function onFirstInteraction() {
      requestNotificationPermission();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    }
    window.addEventListener("pointerdown", onFirstInteraction);
    window.addEventListener("keydown", onFirstInteraction);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);



  useEffect(() => {
    if (call.callState === "incoming") {
      playRingtone();

      const notification = !isAppActive()
        ? showNotification(getCallTitle(call.callInfo.conversationId), {
          body: `Incoming ${call.callInfo.type} call`,
          tag: "incoming-call",
          requireInteraction: true,
        })
        : null;

      // Runs when the call is answered, declined, or ended
      return () => {
        stopRingtone();
        notification?.close();
      };
    }

    if (call.callState === "outgoing") {
      playRingback();
      return () => stopRingback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.callState, call.callInfo?.conversationId]);

  const getCallTitle = (conversationId) =>
    chats.find((c) => c.id === String(conversationId))?.name || "Unknown";

    const getUserName = (userId) =>
    chats.find((c) => c.userId === String(userId))?.name ||
    chats
      .flatMap((c) => c.members || [])
      .find((member) => member.id === String(userId))?.name ||
    "Participant";

  // Photo for the ringing screen (personal chat photo or group picture)
const getCallAvatar = (conversationId) =>
  chats.find((c) => c.id === String(conversationId))?.avatar || "";

// Photo for a participant inside an active call
const getUserAvatar = (userId) =>
  chats.find((c) => c.userId === String(userId))?.avatar || "";

  // Load the existing conversations when the layout opens.
  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get("/conversations");
        const currentUserId = getCurrentUserId();

        const conversations = response.data.conversations || [];

        const formattedChats = conversations.map((conversation) =>
          formatConversation(conversation, currentUserId)
        );

        if (cancelled) return;

        setChats((previousChats) => {
          // Preserve unread counts if a conversation was updated
          // while the initial request was still loading.
          return formattedChats.map((chat) => {
            const existing = previousChats.find(
              (previous) => previous.id === chat.id
            );

            return existing
              ? { ...chat, unread: existing.unread }
              : chat;
          });
        });

        setSelectedChatId((previousId) => {
          if (
            previousId &&
            formattedChats.some((chat) => chat.id === previousId)
          ) {
            return previousId;
          }

          return formattedChats[0]?.id ?? null;
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
            "Unable to load conversations. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  // replace handleConversationRead
  const handleConversationRead = useCallback((conversationId) => {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === conversationId
          ? { ...chat, unread: 0 }
          : chat
      )
    );

    // The nav badges come from the server: ask for fresh numbers.
    refreshNavCounts();
  }, [refreshNavCounts]);

  // Listen for incoming messages globally, not just in ChatWindow.
  useEffect(() => {
    const socket = getSocket();

    function handleNewMessage(message) {
      const conversationId = String(
        message.conversation?._id || message.conversation
      );

      if (!conversationId || conversationId === "undefined") {
        return;
      }

      const currentUserId = getCurrentUserId();

      const senderId = String(
        message.sender?._id ||
        message.sender?.id ||
        message.sender
      );

      const isOwnMessage =
        senderId === String(currentUserId);

      const isSelectedConversation =
               view === "chats" && String(openChatId) === conversationId;

      if (!isOwnMessage && message.type !== "system") {
        const active = isAppActive();

        // Play a sound unless the user is already reading this chat
        if (!(active && isSelectedConversation)) {
          playMessage();
        }

        // Desktop notification only when the app isn't in front
        if (!active) {
          const senderName =
            message.sender?.name || message.sender?.username || "New message";

          showNotification(senderName, {
            body: message.text || "Sent an attachment",
            tag: `chat-${conversationId}`,
            onClick: () => handleSelectChat(conversationId),
          });
        }
      }


      // Update the sidebar immediately if this conversation
      // is already in the list.
      let conversationExists = false;

      setChats((previousChats) => {
        conversationExists = previousChats.some(
          (chat) => chat.id === conversationId
        );

        if (!conversationExists) {
          // The recipient has never opened this conversation.
          // Fetch the conversations so we can get the other
          // participant's name and profile picture.
          return previousChats;
        }

        const updatedChats = previousChats.map((chat) => {
          if (chat.id !== conversationId) return chat;

          return {
            ...chat,
           message: getPreview(chat.type === "group", message, isOwnMessage, chat.message),
            time: formatTime(message.createdAt),
            sent: message.type === "system" ? false : isOwnMessage,
            unread:
              !isOwnMessage &&
              !isSelectedConversation &&
              message.type !== "system"
                ? (chat.unread || 0) + 1
                : chat.unread || 0,
          };
        });

        // Most recently active conversations appear first.
        const updatedChat = updatedChats.find(
          (chat) => chat.id === conversationId
        );

        return [
          updatedChat,
          ...updatedChats.filter(
            (chat) => chat.id !== conversationId
          ),
        ];
      });

      // If this is a brand-new conversation for this recipient,
      // retrieve its participant details and add it automatically.
      if (!conversationExists) {
        api
          .get("/conversations")
          .then((response) => {
            const conversations =
              response.data.conversations || [];

            const conversation = conversations.find(
              (item) =>
                String(item._id) === conversationId
            );

            if (!conversation) return;

            const formattedChat = formatConversation(
              conversation,
              currentUserId
            );

            setChats((previousChats) => {
              const existing = previousChats.find(
                (chat) => chat.id === conversationId
              );

              if (existing) {
                // Another message may have arrived while the
                // conversation request was in progress.
                return previousChats;
              }

              return [
                {
                  ...formattedChat,
                 message: getPreview(formattedChat.type === "group", message, isOwnMessage, formattedChat.message),
                  time: formatTime(message.createdAt),
                  sent: isOwnMessage,
                  unread:
                    !isOwnMessage &&
                      !isSelectedConversation
                      ? 1
                      : 0,
                },
                ...previousChats,
              ];
            });
          })
          .catch((err) => {
            console.error(
              "Unable to refresh conversations:",
              err
            );
          });
      }
    }

        // The sender edited a message: refresh the preview if it is the last one in the chat.
    function handleEdited({ conversationId, text, isLastMessage }) {
      if (!isLastMessage) return;

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === String(conversationId)
            ? {
                ...chat,
                message: text,
                lastMessage: chat.lastMessage ? { ...chat.lastMessage, text } : chat.lastMessage,
              }
            : chat
        )
      );
    }

    function handleDeleted({ conversationId, isLastMessage }) {
      if (!isLastMessage) return;

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === String(conversationId)
            ? { ...chat, message: "This message was deleted" }
            : chat
        )
      );
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeleted);
        socket.on("message:edited", handleEdited);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeleted);
            socket.off("message:edited", handleEdited);
    };
   }, [openChatId, view, playMessage]);


    // Live profile updates (name, username, about, photo) from other users,
  // and from my own other tabs/devices.
  useEffect(() => {
    const socket = getSocket();

    function handleUserUpdated(payload) {
      const { userId, ...changes } = payload || {};
      if (!userId) return;

      const id = String(userId);

      // My own profile changed in another tab or device.
      if (id === String(getCurrentUserId())) {
        setUser((previous) => (previous ? { ...previous, ...changes } : previous));
        return;
      }

      // A contact changed their profile: patch their chats in place.
      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (chat.type !== "personal" || chat.userId !== id) return chat;

          const profileName = changes.name ?? chat.profileName ?? "";
          const username = changes.username ?? chat.username ?? "";

          return {
            ...chat,
            profileName,
            username,
            about: changes.about ?? chat.about,
            avatar: changes.profilePicture ?? chat.avatar,
            // Same rule as formatConversation: name, else username.
            name: profileName.trim() || username || "Unknown user",
          };
        })
      );
    }

    socket.on("user:updated", handleUserUpdated);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("user:updated", handleUserUpdated);
    };
  }, [setUser]);


  // A group changed (name, photo, members, admins): refresh it in the sidebar.
  // Unread counts and the last-message preview are kept as they are.
  const applyConversationUpdate = useCallback((conversation) => {
    const formatted = formatConversation(conversation, getCurrentUserId());

    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id !== formatted.id
          ? chat
          : {
              ...chat,
              name: formatted.name,
              avatar: formatted.avatar,
              members: formatted.members,
              memberNames: formatted.memberNames,
              adminIds: formatted.adminIds,
              isAdmin: formatted.isAdmin,
            }
      )
    );
  }, []);

  // Live group events: a new group, group changes, and being removed from one.
  useEffect(() => {
    const socket = getSocket();

    function handleConversationNew(conversation) {
      const formatted = formatConversation(conversation, getCurrentUserId());

      setChats((previousChats) =>
        previousChats.some((chat) => chat.id === formatted.id)
          ? previousChats
          : [formatted, ...previousChats]
      );
    }

    function handleConversationRemoved({ conversationId }) {
      const id = String(conversationId);

      setChats((previousChats) =>
        previousChats.filter((chat) => chat.id !== id)
      );
      setSelectedChatId((current) => (current === id ? null : current));
    }

    socket.on("conversation:new", handleConversationNew);
    socket.on("conversation:updated", applyConversationUpdate);
    socket.on("conversation:removed", handleConversationRemoved);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("conversation:new", handleConversationNew);
      socket.off("conversation:updated", applyConversationUpdate);
      socket.off("conversation:removed", handleConversationRemoved);
    };
  }, [applyConversationUpdate]);


  // Clear unread messages as soon as the user opens a conversation.
  function handleSelectChat(chatId) {
    const id = String(chatId);

    setSelectedChatId(id);

    // Phone: opening a chat is a new screen, so Back returns to the list.
    if (isMobileNow()) navigate(`/app/chat/${id}`);
    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === id
          ? { ...chat, unread: 0 }
          : chat
      )
    );
  }

  // A chat now starts only after the other person accepts a request, so the
  // conversation already exists on the server: just show it and open it.
  function handleOpenConversation(conversation) {
    if (!conversation) return;

    const formattedChat = formatConversation(conversation, getCurrentUserId());

    setChats((previousChats) => {
      const existing = previousChats.find((chat) => chat.id === formattedChat.id);

      const chatToUse = existing
        ? { ...formattedChat, unread: existing.unread }
        : formattedChat;

      return [
        chatToUse,
        ...previousChats.filter((chat) => chat.id !== formattedChat.id),
      ];
    });

    handleSelectChat(formattedChat.id);
    setIsNewChat(false);
  }

  // Someone blocked / unblocked: update the chat with that person.
  // Used by the live socket event and right after my own block / unblock click.
  const applyBlockChange = useCallback((change) => {
    const userId = String(change.userId);

    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.type === "personal" && chat.userId === userId
          ? {
              ...chat,
              ...(change.blockedByMe !== undefined && { blockedByMe: change.blockedByMe }),
              ...(change.blockedByOther !== undefined && { blockedByOther: change.blockedByOther }),
            }
          : chat
      )
    );
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.on("block:updated", applyBlockChange);

    return () => {
      socket.off("block:updated", applyBlockChange);
    };
  }, [applyBlockChange]);

    // Opening the calls page clears the missed-call badge.
  const callCount = callHistory.calls.length;

  useEffect(() => {
    if (view !== "calls") return;

    api
      .post("/calls/seen")
      .then(refreshNavCounts)
      .catch(() => {});
  }, [view, callCount, refreshNavCounts]);

  // "Message" button on a call: go to that chat.
   function handleMessageFromCall(chatId) {
    handleSelectChat(chatId);
    if (!isMobileNow()) navigate("/app");
  }

  // Phone: back arrow in the chat header.
  function handleBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/app", { replace: true });
  }

  // Phone: the chat in the address is gone (deleted, left the group): back to the list.
  useEffect(() => {
    if (!isMobile || !chatRouteId || isLoading) return;

    if (!chats.some((chat) => chat.id === chatRouteId)) {
      navigate("/app", { replace: true });
    }
  }, [isMobile, chatRouteId, chats, isLoading, navigate]);

  const selectedCall =
    callHistory.calls.find((item) => item.id === selectedCallId) || null;

  // Numbers on the "Unread" and "Groups" filter chips (always from ALL chats,
  // so they don't change while searching).
  const filterCounts = useMemo(() => {
    const unreadChats = chats.filter((chat) => chat.unread > 0);

    return {
      unread: unreadChats.length,
      groups: unreadChats.filter((chat) => chat.type === "group").length,
    };
  }, [chats]);

    // I exited a group from the info panel.
  function handleGroupLeft(conversationId) {
    const id = String(conversationId);

    setChats((previousChats) => previousChats.filter((chat) => chat.id !== id));
    setSelectedChatId((current) => (current === id ? null : current));
  }


    // Throws on failure so the New group screen can show the error.
  async function handleCreateGroup(name, participantIds) {
    const response = await api.post("/conversations/group", {
      name,
      participantIds,
    });

    const formattedChat = formatConversation(
      response.data.conversation,
      getCurrentUserId()
    );

    setChats((previousChats) => [
      formattedChat,
      ...previousChats.filter((chat) => chat.id !== formattedChat.id),
    ]);

    handleSelectChat(formattedChat.id);
    setIsNewGroup(false);
  }

  const selectedChat =
        chats.find((chat) => chat.id === openChatId) || null;

  const filteredChats = chats.filter((chat) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return true;

    return (
      (chat.name || "").toLowerCase().includes(query) ||
      (chat.username || "").toLowerCase().includes(query) ||
      (chat.message || "").toLowerCase().includes(query)
    );
  });

    // "typing…" text per chat (a group shows who is typing).
  const typingTexts = {};

  for (const [chatId, people] of Object.entries(typingByChat)) {
    const names = Object.values(people);

    if (names.length === 0) continue;

    const isGroup = chats.find((chat) => chat.id === chatId)?.type === "group";

    typingTexts[chatId] = !isGroup
      ? "typing…"
      : names.length === 1
        ? `${names[0]} is typing…`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing…`
          : `${names.length} people are typing…`;
  }

  const chatsWithTyping = filteredChats.map((chat) =>
    typingTexts[chat.id] ? { ...chat, typingText: typingTexts[chat.id] } : chat
  );

  const handleMessageSent = (conversationId, latestMessage) => {
    setChats((prevChats) =>
      prevChats.map((c) => {
        const currentId = String(c.id || c._id);
        if (currentId === String(conversationId)) {
          return {
            ...c,
            lastMessage: latestMessage,
            message: latestMessage.text || "",
            attachments: latestMessage.attachments || [],
            time: latestMessage.time,
          };
        }
        return c;
      })
    );
  };

  const handleMessageStatusChange = useCallback(
    (conversationId, status, messageIds = []) => {
      const changedMessageIds = new Set(messageIds.map(String));

      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (chat.id !== String(conversationId)) return chat;

          const lastMessage = chat.lastMessage;
          if (!lastMessage || !(chat.sent || lastMessage.sender === "me")) {
            return chat;
          }

          const lastMessageId = String(lastMessage.id || lastMessage._id || "");
          if (changedMessageIds.size && !changedMessageIds.has(lastMessageId)) {
            return chat;
          }

          return {
            ...chat,
            lastMessage: { ...lastMessage, status },
            status,
          };
        })
      );
    },
    []
  );

  return (
    <PresenceProvider>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <NavigationRail
          profileImage={user?.profilePicture}
          about={user?.about || ""}
          userId={user?.id || user?._id}
          onDismissAbout={() => {
            setUser((previous) =>
              previous ? { ...previous, aboutBubbleDismissed: true } : previous
            );
          }}
        />

               {/* Phone: full-width list, hidden while a chat is open. */}
        <div
          className={`relative flex shrink-0 flex-col max-sm:w-full max-sm:min-w-0 sm:w-[410px] sm:min-w-[340px] ${
            showChatOnMobile ? "max-sm:hidden" : ""
          }`}
        >
          {view === "calls" ? (
            <CallsSidebar
              history={callHistory}
              selectedCallId={selectedCallId}
              onSelect={(item) => setSelectedCallId(item.id)}
              onCall={call.startCall}
              canCall={call.callState === "idle"}
            />
          ) : view === "status" ? (
            <StatusSidebar statuses={statuses} />
          ) : (
          <Sidebar
                        chats={chatsWithTyping}
                        selectedChatId={isMobile ? null : selectedChatId}
            onSelectChat={handleSelectChat}
             isNewGroup={isNewGroup}
             filterCounts={filterCounts}
            onNewGroup={() => {
              setActionError("");
              setIsNewGroup(true);
            }}
            onBackFromNewGroup={() => setIsNewGroup(false)}
            onCreateGroup={handleCreateGroup}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isNewChat={isNewChat}
            onNewChat={() => {
              setActionError("");
              setIsNewChat(true);
            }}
            onBackFromNewChat={() => setIsNewChat(false)}
                        onOpenConversation={handleOpenConversation}
          />

           )}

        
          {actionError && (
            <div
              role="alert"
              className="absolute inset-x-3 top-20 z-30 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {actionError}

              <button
                type="button"
                onClick={() => setActionError("")}
                className="ml-2 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-white/90 p-3 text-center text-sm text-[#667781]">
              Loading conversations...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="absolute inset-x-3 bottom-3 z-30 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ml-2 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

               {/* Phone: only visible while a chat is open. */}
        <main className={`min-w-0 flex-1 ${showChatOnMobile ? "" : "max-sm:hidden"}`}>
        {view === "calls" ? (
            <CallsMain
              call={selectedCall}
              calls={callHistory.calls}
              onCall={call.startCall}
              onMessage={handleMessageFromCall}
              canCall={call.callState === "idle"}
            />
                      ) : view === "status" ? (
            <StatusMain />
          ) : (
          <ChatWindow
            chat={selectedChat}
            chats={chats}
            onConversationRead={handleConversationRead}
            onBack={handleBack}
            onMessageSent={handleMessageSent} // <-- Add this prop here
            onMessageStatusChange={handleMessageStatusChange}
            onStartCall={call.startCall}
                        onGroupUpdated={applyConversationUpdate}
            onGroupLeft={handleGroupLeft}
                        onBlockChange={applyBlockChange}
                                    typingText={selectedChat ? typingTexts[selectedChat.id] : undefined}
          />
           )}

        </main>

      </div>

     <CallOverlay
  call={call}
  getUserName={getUserName}
  getCallTitle={getCallTitle}
  getCallAvatar={getCallAvatar}
  getUserAvatar={getUserAvatar}
/>
    </PresenceProvider>
  );
}
