import { useMemo, useState } from "react";
import NewChatView from "./NewChatView";
import StarredMessagesView from "./StarredMessagesView";
import SidebarHeader, { NewChatIcon } from "./SidebarHeader";
import SearchBar from "./SearchBar";
import ChatFilters, { DEFAULT_FILTERS } from "./ChatFilters";
import ArchivedRow from "./ArchivedRow";
import ChatList from "./ChatList";
import MobileBottomNav from "./MobileBottomNav";
// import, under the NewChatView import
import NewGroupView from "./NewGroupView";
 

/* Phone: full width. Tablet: 380. Laptop: 410. Wide screens: ~30% (410–480). */
const ASIDE =
  "relative flex h-full w-full min-w-0 flex-col border-r border-[color:var(--wa-border)] bg-[var(--wa-sidebar-bg)] sm:w-[380px] lg:w-[410px] xl:w-[30%] xl:min-w-[410px] xl:max-w-[480px]";

export default function Sidebar({
  chats = [],
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  isNewChat,
  onNewChat,
  onBackFromNewChat,
  onSelectNewChatUser,
  isNewGroup,
  onNewGroup,
  onBackFromNewGroup,
  onCreateGroup,
  onLogout,
    filters = DEFAULT_FILTERS,
  filterCounts = {},
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const activeSearch = searchQuery !== undefined ? searchQuery : internalSearch;
  const handleSearchChange = onSearchChange || setInternalSearch;

  const [activeFilter, setActiveFilter] = useState("all");
  const [showStarred, setShowStarred] = useState(false);

  const filteredChats = useMemo(() => {
    const query = (activeSearch || "").trim().toLowerCase();

    return chats.filter((chat) => {
      const lastText = chat.lastMessage?.text || chat.message || "";
      const matchesSearch =
        !query ||
        (chat.name || "").toLowerCase().includes(query) ||
        lastText.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "unread" && (chat.unread > 0 || chat.unreadCount > 0)) ||
        (activeFilter === "groups" && (chat.type === "group" || chat.isGroup)) ||
        (activeFilter === "favorites" && chat.favorite === true);

      return matchesSearch && matchesFilter;
    });
  }, [chats, activeSearch, activeFilter]);

    if (isNewGroup) {
    return (
      <aside className={ASIDE}>
        <NewGroupView onBack={onBackFromNewGroup} onCreate={onCreateGroup} />
      </aside>
    );
  }

  if (isNewChat) {
    return (
      <aside className={ASIDE}>
        <NewChatView onBack={onBackFromNewChat} onSelectUser={onSelectNewChatUser} />
      </aside>
    );
  }

  if (showStarred) {
    return (
      <aside className={ASIDE}>
        <StarredMessagesView
          chats={chats}
          onBack={() => setShowStarred(false)}
          onOpenChat={(conversationId) => {
            onSelectChat(conversationId);
            setShowStarred(false);
          }}
        />
      </aside>
    );
  }

  return (
    <aside className={ASIDE}>
      <SidebarHeader
        onNewChat={onNewChat}
        onNewGroup={onNewGroup}
        onOpenStarred={() => setShowStarred(true)}
        onLogout={onLogout}
      />
      <SearchBar value={activeSearch} onChange={handleSearchChange} />
            <ChatFilters
        activeFilter={activeFilter}
        onChange={setActiveFilter}
        filters={filters.map((filter) => ({ ...filter, count: filterCounts[filter.value] || undefined }))}
      />
      {/* Archived + chats scroll together, like WhatsApp Web */}
      <div className="whatsapp-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <ArchivedRow />
        <ChatList chats={filteredChats} selectedChatId={selectedChatId} onSelectChat={onSelectChat} />
      </div>

      {/* Mobile-only: floating new chat button + bottom tabs */}
      <button
        type="button"
        aria-label="New chat"
        onClick={onNewChat}
        className="absolute bottom-[88px] right-4 z-10 grid size-14 place-items-center rounded-2xl bg-[var(--wa-fab-bg)] text-[color:var(--wa-fab-fg)] shadow-lg transition active:scale-95 sm:hidden"
      >
        <NewChatIcon size={24} />
      </button>
      <MobileBottomNav />
    </aside>
  );
}