'use client';
/**
 * Slash command floating menu component.
 *
 * Rendered via ReactRenderer inside the Tiptap suggestion plugin.
 * Positioned absolutely below the slash trigger character.
 *
 * UX:
 * - Items grouped by category (Formatting / PoE / AI / Embed).
 * - Keyboard nav: ArrowUp/Down to move selection, Enter to confirm, Escape to close.
 * - Query string filters by label + description + id.
 * - Lucide icons rendered from string icon names via dynamic lookup.
 *
 * Props mirror the SuggestionProps<SlashCommandItem> from @tiptap/suggestion.
 * The parent (slash-commands.ts) passes the full suggestion props object.
 */

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { SlashCommandItem } from '../types';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, Minus,
  Coins, Sword, Megaphone, Network, MessageSquare, Image, Table2,
  type LucideProps,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon map — avoids dynamic require() in the render path
// ---------------------------------------------------------------------------

type IconComponent = React.FC<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Coins,
  Sword,
  Megaphone,
  Network,
  MessageSquare,
  Image,
  Table2,
};

const CATEGORY_ORDER: SlashCommandItem['category'][] = [
  'formatting',
  'poe',
  'ai',
  'embed',
];

const CATEGORY_LABELS: Record<SlashCommandItem['category'], string> = {
  formatting: 'Formatting',
  poe: 'PoE',
  ai: 'AI',
  embed: 'Embed',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlashMenuProps = SuggestionProps<SlashCommandItem>;

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating menu rendered by ReactRenderer inside the slash suggestion plugin.
 * Exposed ref: { onKeyDown } so the plugin can route keyboard events.
 */
export const SlashCommandsMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashCommandsMenu({ items, command, clientRect }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when item list changes (query changed)
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const handleSelect = useCallback(
      (item: SlashCommandItem) => {
        command(item);
      },
      [command],
    );

    // Keyboard handler exposed via ref to the suggestion plugin
    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent): boolean => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % Math.max(1, items.length));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length));
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex];
          if (item) handleSelect(item);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;

    // Compute floating position from the trigger decoration
    const rect = clientRect?.();
    const style: React.CSSProperties = rect
      ? {
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          zIndex: 50,
        }
      : { position: 'fixed', top: 0, left: 0, zIndex: 50 };

    // Group items by category in order
    const groups = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: items.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);

    // Flat index across all groups (for keyboard selection)
    let flatIdx = 0;

    return (
      <div
        style={style}
        className="w-72 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40"
        role="listbox"
        aria-label="Slash commands"
      >
        {groups.map((group) => (
          <div key={group.category}>
            {/* Category header */}
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {group.label}
              </span>
            </div>

            {/* Items */}
            {group.items.map((item) => {
              const currentIdx = flatIdx++;
              const isSelected = currentIdx === selectedIndex;
              const IconComp = ICON_MAP[item.icon];

              return (
                <button
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(currentIdx)}
                  className={[
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-zinc-700 text-zinc-50'
                      : 'text-zinc-300 hover:bg-zinc-800',
                  ].join(' ')}
                >
                  {IconComp ? (
                    <IconComp size={16} className="shrink-0 opacity-70" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-none">{item.label}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {/* Footer hint */}
        <div className="border-t border-zinc-800 px-3 py-1.5">
          <span className="text-[10px] text-zinc-600">
            ↑↓ navegar · Enter selecionar · Esc fechar
          </span>
        </div>
      </div>
    );
  },
);
