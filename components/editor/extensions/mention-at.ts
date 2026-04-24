'use client';
/**
 * @-mention extension for PoE items and currencies.
 *
 * Trigger: '@'. Typing '@Mageblood' opens a dropdown that:
 * 1. Checks the local currency list (from use-currency-catalog / inline cache) first.
 * 2. Falls back to GET /api/engine/items/{query}/raw if no currency match.
 * 3. Returns a combined, relevance-sorted list.
 *
 * On select: dispatches insertPoeCurrency or insertPoeItem command depending
 * on whether the matched entry came from the currency catalog.
 *
 * Design: local catalog is kept in module-level cache populated on first query.
 * This avoids importing SWR (client-only) into the extension — the extension
 * is pure Tiptap/ProseMirror and must remain transport-agnostic.
 *
 * S08.f's use-currency-catalog hook populates the same cache via
 * populateCurrencyCache() exported here — editor-body.tsx calls it at mount.
 */

import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion } from '@tiptap/suggestion';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';

// ---------------------------------------------------------------------------
// Currency catalog cache
// ---------------------------------------------------------------------------

export interface CurrencyCatalogEntry {
  name: string;
  iconUrl?: string;
}

/** Module-level cache populated by populateCurrencyCache() at editor mount. */
let currencyCache: CurrencyCatalogEntry[] = [];

/**
 * Called by the editor host (editor-body.tsx or use-currency-catalog hook)
 * after the catalog is fetched. Not using SWR here keeps extension testable.
 */
export function populateCurrencyCache(entries: CurrencyCatalogEntry[]): void {
  currencyCache = entries;
}

// ---------------------------------------------------------------------------
// Mention item type
// ---------------------------------------------------------------------------

export type MentionMatchKind = 'currency' | 'item';

export interface MentionItem {
  id: string;
  label: string;
  kind: MentionMatchKind;
  iconUrl?: string;
  /** Higher = shown first. Exact match > prefix > fuzzy. */
  score: number;
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

function scoreName(name: string, query: string): number {
  const lName = name.toLowerCase();
  const lQuery = query.toLowerCase();
  if (lName === lQuery) return 3;
  if (lName.startsWith(lQuery)) return 2;
  if (lName.includes(lQuery)) return 1;
  return 0;
}

function matchCurrencies(query: string): MentionItem[] {
  if (!query || currencyCache.length === 0) return [];
  const results: MentionItem[] = [];
  for (const c of currencyCache) {
    const score = scoreName(c.name, query);
    if (score === 0) continue;
    results.push({
      id: `currency:${c.name}`,
      label: c.name,
      kind: 'currency',
      iconUrl: c.iconUrl,
      score,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Server-side item fetch (debounced in the items callback)
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastQuery = '';
let lastItemResults: MentionItem[] = [];

async function fetchItemByQuery(query: string): Promise<MentionItem[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`/api/engine/items/${encodeURIComponent(query)}/raw`);
    if (!res.ok) return [];
    const raw = (await res.json()) as { name?: string; iconUrl?: string };
    if (!raw.name) return [];
    return [
      {
        id: `item:${raw.name}`,
        label: raw.name,
        kind: 'item',
        iconUrl: raw.iconUrl,
        score: scoreName(raw.name, query),
      },
    ];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

const MENTION_PLUGIN_KEY = new PluginKey('mentionAt');

// ---------------------------------------------------------------------------
// Suggestion options factory
// ---------------------------------------------------------------------------

function buildMentionSuggestionOptions(
  editorInstance: Editor,
): SuggestionOptions<MentionItem> {
  return {
    pluginKey: MENTION_PLUGIN_KEY,
    editor: editorInstance,
    char: '@',
    allowSpaces: false,

    // Returns items synchronously from cache; triggers async fetch for items.
    // @tiptap/suggestion calls this on every query change.
    items: ({ query }: { query: string }): MentionItem[] => {
      const currencyMatches = matchCurrencies(query);

      // If we have good currency matches, skip item fetch
      const hasCurrencyExact = currencyMatches.some((m) => m.score >= 2);
      if (!hasCurrencyExact && query && query.length >= 2) {
        // Debounce item fetch — update renderer after async result arrives
        if (lastQuery !== query) {
          lastQuery = query;
          lastItemResults = [];
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchItemByQuery(query).then((results) => {
              lastItemResults = results;
              // The suggestion plugin will call items() again on next keystroke;
              // we can't re-trigger it programmatically without a transaction.
              // The async results appear on the next user input. Acceptable for MVP.
            });
          }, 300);
        }
      }

      const combined = [...currencyMatches, ...lastItemResults];
      return combined.sort((a, b) => b.score - a.score).slice(0, 8);
    },

    command: ({
      editor: ed,
      range,
      props: item,
    }: {
      editor: Editor;
      range: Range;
      props: MentionItem;
    }) => {
      ed.chain().focus().deleteRange(range).run();

      if (item.kind === 'currency') {
        ed.chain().focus().insertPoeCurrency({
          currencyName: item.label,
          iconUrl: item.iconUrl,
        }).run();
      } else {
        ed.chain().focus().insertPoeItem({
          itemName: item.label,
          iconUrl: item.iconUrl,
        }).run();
      }
    },

    render: () => {
      let renderer: ReactRenderer | null = null;

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { MentionAtMenu } = require('./mention-at-menu') as {
            MentionAtMenu: React.ComponentType<unknown>;
          };
          renderer = new ReactRenderer(MentionAtMenu, {
            props,
            editor: props.editor,
          });
        },

        onUpdate: (props: SuggestionProps<MentionItem>) => {
          renderer?.updateProps(props);
        },

        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (event.key === 'Escape') {
            renderer?.destroy();
            renderer = null;
            return true;
          }
          const instance = renderer?.ref as Record<string, unknown> | null;
          if (typeof instance?.onKeyDown === 'function') {
            return (instance.onKeyDown as (e: KeyboardEvent) => boolean)(event);
          }
          return false;
        },

        onExit: () => {
          renderer?.destroy();
          renderer = null;
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const MentionAtExtension = Extension.create({
  name: 'mentionAt',

  addProseMirrorPlugins() {
    return [Suggestion(buildMentionSuggestionOptions(this.editor))];
  },
});

/**
 * Returns the mention-at extension array for merging into buildEditorExtensions().
 */
export function buildMentionExtension(): Extension[] {
  return [MentionAtExtension];
}
