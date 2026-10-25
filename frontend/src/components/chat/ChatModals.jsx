import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

import MessageContextMenu from "./MessageContextMenu";
import ForwardModal from "./ForwardModal";
import DeleteMessageModal from "./DeleteMessageModal";
import ActionToast from "./ActionToast";

export default function ChatModals({
  menu,
  menuMessage,
  currentUserId,
  onCloseMenu,
  onReact,
  onReply,
  onCopy,
    onEdit,
  onDownload,
  onForwardOpen,
  onStar,
  onDeleteOpen,
  forwardingMessage,
  chats,
  isForwarding,
  forwardError,
  onCloseForward,
  onForward,
  deletingMessage,
  canDeleteForEveryone,
  isDeleting,
  onDeleteMessage,
  onCloseDelete,
  notice,
  onClearNotice,
  lightboxIndex,
  mediaSlides,
  onCloseLightbox,
}) {
  const myReaction = menuMessage?.reactions.find((r) => r.userId === String(currentUserId))?.emoji;

  return (
    <>
      {menu && menuMessage && (
        <MessageContextMenu
          key={`${menu.message.id}-${menu.x}-${menu.y}`}
          menu={{ ...menu, message: menuMessage }}
          myReaction={myReaction}
          onClose={onCloseMenu}
          onReact={(emoji) => onReact(menuMessage, emoji)}
          onReply={() => onReply(menuMessage)}
          onCopy={() => onCopy(menuMessage.text)}
                    onEdit={() => onEdit(menuMessage)}
          onDownload={() => onDownload(menuMessage.attachments)}
          onForward={() => onForwardOpen(menuMessage)}
          onStar={() => onStar(menuMessage)}
          onDelete={() => onDeleteOpen(menuMessage)}
        />
      )}

      {forwardingMessage && (
        <ForwardModal
          chats={chats}
          isForwarding={isForwarding}
          error={forwardError}
          onClose={onCloseForward}
          onForward={onForward}
        />
      )}

      {deletingMessage && (
        <DeleteMessageModal
          canDeleteForEveryone={canDeleteForEveryone}
          isBusy={isDeleting}
          onDeleteForMe={() => onDeleteMessage("me")}
          onDeleteForEveryone={() => onDeleteMessage("everyone")}
          onClose={onCloseDelete}
        />
      )}

      <ActionToast notice={notice} onDone={onClearNotice} />

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={onCloseLightbox}
        slides={mediaSlides}
        plugins={[Download, Zoom]}
      />
    </>
  );
}