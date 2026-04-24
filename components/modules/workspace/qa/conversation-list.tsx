'use client';

import type { ConversationGroup } from './types';

interface ConversationListProps {
  groups: ConversationGroup[];
  activeConvId: string | null;
  hoveredConvId: string | null;
  loadingConvs: boolean;
  totalCount: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onHover: (id: string | null) => void;
  sidebarOpen: boolean;
}

export function ConversationList({
  groups,
  activeConvId,
  hoveredConvId,
  loadingConvs,
  totalCount,
  onSelect,
  onDelete,
  onCreate,
  onHover,
  sidebarOpen,
}: ConversationListProps) {
  return (
    <aside
      className={`${
        sidebarOpen ? 'w-72' : 'w-0'
      } shrink-0 border-r border-border bg-surface transition-all duration-200 overflow-hidden flex flex-col`}
    >
      <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Chats</span>
        <button
          onClick={onCreate}
          className="text-xs px-2.5 py-1 rounded-md bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loadingConvs && (
          <div className="px-4 py-8 text-xs text-muted-foreground text-center">Loading...</div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {group.label}
            </div>
            {group.items.map((conv) => (
              <ConversationItem
                key={conv.id}
                id={conv.id}
                title={conv.title}
                isActive={activeConvId === conv.id}
                isHovered={hoveredConvId === conv.id}
                onSelect={onSelect}
                onDelete={onDelete}
                onHover={onHover}
              />
            ))}
          </div>
        ))}

        {!loadingConvs && totalCount === 0 && (
          <div className="px-4 py-8 text-xs text-muted-foreground text-center">
            No conversations yet
          </div>
        )}
      </div>
    </aside>
  );
}

interface ConversationItemProps {
  id: string;
  title: string | null;
  isActive: boolean;
  isHovered: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onHover: (id: string | null) => void;
}

function ConversationItem({
  id,
  title,
  isActive,
  isHovered,
  onSelect,
  onDelete,
  onHover,
}: ConversationItemProps) {
  return (
    <div
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className={`group flex items-center gap-1 px-4 py-2 cursor-pointer text-sm transition-colors ${
        isActive
          ? 'bg-foreground/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
      }`}
    >
      <button onClick={() => onSelect(id)} className="flex-1 text-left truncate min-w-0">
        {title || 'New chat'}
      </button>
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors p-0.5"
          title="Delete conversation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
