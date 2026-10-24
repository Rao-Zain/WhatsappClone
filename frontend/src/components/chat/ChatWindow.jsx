import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

import EmptyChat from "./EmptyChat";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import ChatModals from "./ChatModals";
import GroupInfoPanel from "./GroupInfoPanel";
import {   ArrowDown } from "lucide-react";
import ChatSearchPanel from "./ChatSearchPanel";
import { useChatMessages } from "./useChatMessages";
import { useMessageActions } from "./useMessageActions";
import api from "../../../lib/api";
import BlockDialog from "./BlockDialog";
import BlockedBar from "./BlockedBar";

const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000;

function getCurrentUserId() {
  try {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    return stored ? JSON.parse(stored)?._id || JSON.parse(stored)?.id || null : null;
  } catch {
    return null;
  }
}

export default function ChatWindow({
  chat,
  chats = [],
  onConversationRead,
  onBack,
  onMessageSent,
  onMessageStatusChange,
  onConversationUpdated,
  onStartCall,
    onGroupUpdated,
  onGroupLeft,
    onBlockChange,
}) {
  const currentUserId = getCurrentUserId();
  const chatId = chat?.id;

  // Active UI states
  const [replyingTo, setReplyingTo] = useState(null);
  const [menu, setMenu] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardError, setForwardError] = useState("");
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [mediaSlides, setMediaSlides] = useState([]);
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
   // Side panels: group info or message search (switching chats closes them).
  const [infoChatId, setInfoChatId] = useState(null);
  const [search, setSearch] = useState({ chatId: null, query: "" });
  const [jumpTarget, setJumpTarget] = useState(null);
  const infoOpen = infoChatId === chatId;
  const searchOpen = search.chatId === chatId;
  const searchQuery = searchOpen ? search.query : "";

  // Sidebar sync callback
  const notifySidebar = useCallback(
    (message) => {
      if (!chatId || !message) return;
      if (typeof onMessageSent === "function") {
        onMessageSent(String(chatId), message);
      } else if (typeof onConversationUpdated === "function") {
        onConversationUpdated(String(chatId), message);
      }
    },
    [chatId, onMessageSent, onConversationUpdated]
  );

  // Hook 1: Messages Data & Sync
      const { messages, setMessages, isLoading, error, reload, updateMessage, isHistory, loadAround, hasMore, isLoadingOlder, olderFailed, loadOlder } = useChatMessages({
    chatId,
    currentUserId,
    onConversationRead,
    onMessageStatusChange,
    notifySidebar,
  });

  // Hook 2: Message Actions
  const {
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
  } = useMessageActions({
    chatId,
    currentUserId,
    notifySidebar,
    updateMessage,
    setMessages,
  });

  // Reset modal state on conversation change
  useEffect(() => {
    setMenu(null);
    setReplyingTo(null);
    setForwardingMessage(null);
    setDeletingMessage(null);
    setLightboxIndex(-1);
        setBlockDialogOpen(false);
  }, [chatId]);

  if (!chat) return <EmptyChat />;

  // Handlers
    const openInfo = () => {
    setSearch({ chatId: null, query: "" });
    setInfoChatId(chatId);
  };

  const openSearch = () => {
    setInfoChatId(null);
    setSearch((previous) => ({ chatId, query: previous.chatId === chatId ? previous.query : "" }));
  };

  const closeSearch = () => setSearch({ chatId: null, query: "" });

  // A search result was clicked: open the part of the history it belongs to
  // (if it isn't loaded yet), then scroll to it.
  const handleSelectResult = async (messageId) => {
    if (!messages.some((m) => m.id === messageId)) {
      const opened = await loadAround(messageId);

      if (!opened) {
        showNotice("Unable to open that message");
        return;
      }
    }

    setJumpTarget({ id: messageId, n: Date.now() });
  };

  const handleSendMessage = async (text, files, kind) => {
    // Sending while looking at an old search result: go back to the latest messages first.
    if (isHistory) await reload();

    await sendMessage(text, files, kind, replyingTo?.id);
    setReplyingTo(null);
  };

    const handleBlock = async () => {
    if (blockBusy || !chat.userId) return;
    setBlockBusy(true);
    try {
      await api.post(`/blocks/${chat.userId}`);
      onBlockChange?.({ userId: chat.userId, blockedByMe: true });
      setBlockDialogOpen(false);
      showNotice("Contact blocked");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to block contact");
    } finally {
      setBlockBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (blockBusy || !chat.userId) return;
    setBlockBusy(true);
    try {
      await api.delete(`/blocks/${chat.userId}`);
      onBlockChange?.({ userId: chat.userId, blockedByMe: false });
      showNotice("Contact unblocked");
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to unblock contact");
    } finally {
      setBlockBusy(false);
    }
  };

  const handleMediaClick = (url) => {
    setMediaSlides([{ src: url }]);
    setLightboxIndex(0);
  };

  const handleStar = async (msg) => {
    setMenu(null);
    const nextStarred = !msg.starred;
    updateMessage(msg.id, (m) => ({ ...m, starred: nextStarred }));
    try {
      await api.post(`/conversations/${chatId}/messages/${msg.id}/star`);
      showNotice(nextStarred ? "Message starred" : "Star removed");
    } catch {
      updateMessage(msg.id, (m) => ({ ...m, starred: !nextStarred }));
      showNotice("Star update failed");
    }
  };

  const handleDeleteMessage = async (scope) => {
    if (!deletingMessage) return;
    setIsDeleting(true);
    try {
      await api.delete(`/conversations/${chatId}/messages/${deletingMessage.id}`, { params: { scope } });
      setMessages((prev) => prev.filter((m) => m.id !== deletingMessage.id));
      setDeletingMessage(null);
    } catch (err) {
      showNotice(err.response?.data?.message || "Failed to delete message");
    } finally {
      setIsDeleting(false);
    }
  };

  const menuMessage = menu ? messages.find((m) => m.id === menu.message.id) : null;
  const canDeleteForEveryone =
    deletingMessage?.sender === "me" &&
    !deletingMessage.deletedForEveryone &&
    Date.now() - new Date(deletingMessage.createdAt).getTime() < DELETE_FOR_EVERYONE_WINDOW_MS;

  return (
     
    <div className="relative flex h-full min-h-0 w-full min-w-0">
    <section className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--wa-chat-bg)]">
      <div className="wa-wallpaper" aria-hidden="true" />
      <ChatHeader
        chat={chat}
        onBack={onBack}
        onStartCall={onStartCall}
                onOpenInfo={chat.type === "group" ? openInfo : undefined}
        onOpenSearch={openSearch}
        searchActive={searchOpen}
                onBlock={() => setBlockDialogOpen(true)}
        onUnblock={handleUnblock}
      />

      {/* Message List Area */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-[color:var(--wa-accent)]" />
            <p className="text-xs text-[color:var(--wa-text-secondary)]">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4">
            <AlertCircle size={28} className="mb-2 text-[color:var(--wa-danger)]" />
            <p className="text-sm text-[color:var(--wa-text-strong)]">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-full bg-[var(--wa-accent)] px-4 py-1.5 text-xs text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
           isGroup={chat.type === "group"}
            isHistory={isHistory}
            jumpTarget={jumpTarget}
            highlight={searchQuery}
                        hasMore={hasMore}
            isLoadingOlder={isLoadingOlder}
            olderFailed={olderFailed}
            onLoadOlder={loadOlder}
            onOpenMenu={(msg, pos) => setMenu({ message: msg, ...pos })}
            onMediaClick={handleMediaClick}
            onAttachmentDelete={deleteSingleAttachment}
          />
        )}
      </div>

              {isHistory && (
        <button
          type="button"
          onClick={reload}
          className="absolute bottom-[78px] right-6 z-30 flex items-center gap-2 rounded-full bg-[var(--wa-accent)] px-4 py-2 text-[13px] font-medium text-white shadow-lg"
        >
          <ArrowDown size={16} />
          Jump to latest
        </button>
      )}

      {/* Message Input Composer */}
      <div className="relative z-20 w-full shrink-0">
               {chat.blockedByMe || chat.blockedByOther ? (
          <BlockedBar
            blockedByMe={chat.blockedByMe}
            name={chat.name}
            busy={blockBusy}
            onUnblock={handleUnblock}
          />
        ) : (
          <MessageComposer
            conversationId={chatId}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            uploadProgress={uploadProgress}
            replyTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        )}
      </div>
      {blockDialogOpen && (
        <BlockDialog
          name={chat.name}
          busy={blockBusy}
          onCancel={() => setBlockDialogOpen(false)}
          onConfirm={handleBlock}
        />
      )}
      
      {/* Modals, Lightbox & Overlays */}
      <ChatModals
        menu={menu}
        menuMessage={menuMessage}
        currentUserId={currentUserId}
        onCloseMenu={() => setMenu(null)}
        onReact={react}
        onReply={(msg) => {
          setMenu(null);
          setReplyingTo(msg);
        }}
        onCopy={copy}
        onDownload={download}
        onForwardOpen={(msg) => {
          setMenu(null);
          setForwardingMessage(msg);
        }}
        onStar={handleStar}
        onDeleteOpen={(msg) => {
          setMenu(null);
          setDeletingMessage(msg);
        }}
        forwardingMessage={forwardingMessage}
        chats={chats}
        isForwarding={isForwarding}
        forwardError={forwardError}
        onCloseForward={() => setForwardingMessage(null)}
        onForward={async (ids) => {
          setIsForwarding(true);
          try {
            await api.post(`/conversations/${chatId}/messages/${forwardingMessage.id}/forward`, {
              conversationIds: ids,
            });
            setForwardingMessage(null);
            showNotice("Forwarded");
          } catch (err) {
            setForwardError(err.response?.data?.message || "Failed to forward");
          } finally {
            setIsForwarding(false);
          }
        }}
        deletingMessage={deletingMessage}
        canDeleteForEveryone={canDeleteForEveryone}
        isDeleting={isDeleting}
        onDeleteMessage={handleDeleteMessage}
        onCloseDelete={() => setDeletingMessage(null)}
        notice={notice}
        onClearNotice={clearNotice}
        lightboxIndex={lightboxIndex}
        mediaSlides={mediaSlides}
              onCloseLightbox={() => setLightboxIndex(-1)}
      />
    </section>

    {searchOpen && (
      <ChatSearchPanel
        chat={chat}
        currentUserId={currentUserId}
        query={searchQuery}
        onQueryChange={(query) => setSearch({ chatId, query })}
        onClose={closeSearch}
        onSelect={handleSelectResult}
      />
    )}

    {infoOpen && chat.type === "group" && (
      <GroupInfoPanel
        chat={chat}
        currentUserId={currentUserId}
        onClose={() => setInfoChatId(null)}
        onGroupUpdated={onGroupUpdated}
        onGroupLeft={onGroupLeft}
      />
    )}
    </div>
  );
}
  