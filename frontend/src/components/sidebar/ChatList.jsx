import ChatItem from "./ChatItem";

export default function ChatList({ chats, selectedChatId, onSelectChat }) {
  if (chats.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-[color:var(--wa-text-secondary)]">
        No conversations found
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-2">
      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          active={chat.id === selectedChatId}
          onClick={() => onSelectChat(chat.id)}
        />
      ))}
    </div>
  );
}