'use client';
/**
 * @-mention dropdown menu component.
 *
 * Rendered via ReactRenderer inside the mention-at suggestion plugin.
 * Shows thumbnails (icon URL or rarity-color swatch), item name, and kind badge.
 *
 * Keyboard nav: ArrowUp/Down, Enter to confirm, Escape handled by the plugin.
 * Exposed via forwardRef so the plugin can route key events.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { MentionItem } from './mention-at';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MentionMenuProps = SuggestionProps<MentionItem>;

export interface MentionMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

// ---------------------------------------------------------------------------
// Rarity color helpers
// ---------------------------------------------------------------------------

const KIND_BADGE_CLASSES: Record<MentionItem['kind'], string> = {
  currency: 'border-yellow-500/40 bg-yellow-950/60 text-yellow-300',
  item: 'border-amber-500/40 bg-amber-950/60 text-amber-300',
};

const KIND_LABELS: Record<MentionItem['kind'], string> = {
  currency: 'currency',
  item: 'item',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MentionAtMenu = forwardRef<MentionMenuHandle, MentionMenuProps>(
  function MentionAtMenu({ items, command, clientRect }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const handleSelect = useCallback(
      (item: MentionItem) => {
        command(item);
      },
      [command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent): boolean => {
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % Math.max(1, items.length));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length),
          );
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

    if (!items.length) {
      const rect = clientRect?.();
      const style: React.CSSProperties = rect
        ? { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 50 }
        : { position: 'fixed', top: 0, left: 0, zIndex: 50 };
      return (
        <div
          style={style}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl"
        >
          <span className="text-xs text-zinc-500">Nenhum resultado encontrado</span>
        </div>
      );
    }

    const rect = clientRect?.();
    const style: React.CSSProperties = rect
      ? { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 50 }
      : { position: 'fixed', top: 0, left: 0, zIndex: 50 };

    return (
      <div
        style={style}
        className="w-64 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40"
        role="listbox"
        aria-label="Item autocomplete"
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const badgeClass = KIND_BADGE_CLASSES[item.kind];

          return (
            <button
              key={item.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={[
                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                isSelected
                  ? 'bg-zinc-700 text-zinc-50'
                  : 'text-zinc-300 hover:bg-zinc-800',
              ].join(' ')}
            >
              {/* Icon thumbnail or color swatch */}
              {item.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.iconUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="shrink-0 rounded-sm object-contain"
                />
              ) : (
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${badgeClass}`}
                >
                  {item.kind === 'currency' ? '◈' : '⚔'}
                </span>
              )}

              {/* Label */}
              <span className="flex-1 truncate text-sm font-medium">
                {item.label}
              </span>

              {/* Kind badge */}
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
              >
                {KIND_LABELS[item.kind]}
              </span>
            </button>
          );
        })}

        <div className="border-t border-zinc-800 px-3 py-1">
          <span className="text-[10px] text-zinc-600">
            ↑↓ navegar · Enter inserir
          </span>
        </div>
      </div>
    );
  },
);
