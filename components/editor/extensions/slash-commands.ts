'use client';
/**
 * Slash command extension for the PoE blog editor.
 *
 * Wires @tiptap/suggestion with char '/' to open a categorised command menu.
 * The menu UI lives in slash-commands-menu.tsx (rendered via ReactRenderer).
 *
 * Items are built by createSlashCommandItems() — exported so consumers can
 * add or filter items without touching the extension itself.
 *
 * Integration: S08.e merges buildSlashExtension() into buildEditorExtensions().
 */

import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion } from '@tiptap/suggestion';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import type { SlashCommandItem } from '../types';
import { resolveCurrencyIcon } from '../hooks/resolve-currency-icon';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unique plugin key — avoids collision with the mention-at plugin. */
const SLASH_PLUGIN_KEY = new PluginKey('slashCommands');

// ---------------------------------------------------------------------------
// Item factory
// ---------------------------------------------------------------------------

/**
 * Creates the full list of slash command items for the given editor.
 * Exported so the menu component and tests can import without the extension.
 *
 * @example
 * const items = createSlashCommandItems(editor);
 * const formattingItems = items.filter(i => i.category === 'formatting');
 */
export function createSlashCommandItems(editor: Editor): SlashCommandItem[] {
  return [
    // -----------------------------------------------------------------------
    // Formatting
    // -----------------------------------------------------------------------
    {
      id: 'heading-1',
      label: 'Heading 1',
      description: 'Large section title',
      category: 'formatting',
      icon: 'Heading1',
      execute: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'heading-2',
      label: 'Heading 2',
      description: 'Medium section title',
      category: 'formatting',
      icon: 'Heading2',
      execute: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'heading-3',
      label: 'Heading 3',
      description: 'Small section title',
      category: 'formatting',
      icon: 'Heading3',
      execute: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      label: 'Bullet list',
      description: 'Unordered list',
      category: 'formatting',
      icon: 'List',
      execute: (ed) => ed.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      label: 'Numbered list',
      description: 'Ordered list',
      category: 'formatting',
      icon: 'ListOrdered',
      execute: (ed) => ed.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'blockquote',
      label: 'Blockquote',
      description: 'Callout or pull quote',
      category: 'formatting',
      icon: 'Quote',
      execute: (ed) => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'code-block',
      label: 'Code block',
      description: 'Syntax-highlighted code',
      category: 'formatting',
      icon: 'Code2',
      execute: (ed) => ed.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: 'Divider',
      description: 'Horizontal rule',
      category: 'formatting',
      icon: 'Minus',
      execute: (ed) => ed.chain().focus().setHorizontalRule().run(),
    },

    // -----------------------------------------------------------------------
    // PoE assets
    // -----------------------------------------------------------------------
    {
      id: 'poe-currency',
      label: 'Currency',
      description: 'Insert a PoE currency chip',
      category: 'poe',
      icon: 'Coins',
      execute: (ed) => {
        // No picker at this layer — quick-insert Divine Orb as default.
        // Icon is resolved async; chip inserts immediately with ◈ if engine is slow,
        // then a second insert replaces it once the URL arrives.
        // Pattern: fire-and-forget void — execute() is typed as () => void.
        void (async () => {
          const currencyName = 'Divine Orb';
          const iconUrl = await resolveCurrencyIcon(currencyName);
          ed.chain().focus().insertPoeCurrency({ currencyName, iconUrl: iconUrl ?? undefined }).run();
        })();
      },
    },
    {
      id: 'poe-item',
      label: 'Item',
      description: 'Insert a PoE item reference',
      category: 'poe',
      icon: 'Sword',
      execute: (ed) => {
        // Prompt the operator to type an item name via the @-mention flow.
        // This slash command inserts '@' to trigger the mention autocomplete.
        ed.chain().focus().insertContent('@').run();
      },
    },
    {
      id: 'poe-cta',
      label: 'CTA Banner',
      description: 'Call-to-action promotional block',
      category: 'poe',
      icon: 'Megaphone',
      execute: (ed) => {
        ed.chain().focus().insertPoeCta({ variant: 'currency', modifier: 'poe2' }).run();
      },
    },
    {
      id: 'poe-passive',
      label: 'Passive Skill',
      description: 'Reference a passive skill tree node',
      category: 'poe',
      icon: 'Network',
      execute: (ed) => {
        ed.chain().focus().insertPoePassive({ passiveName: 'Acrobatics' }).run();
      },
    },

    // -----------------------------------------------------------------------
    // AI
    // -----------------------------------------------------------------------
    {
      id: 'ai-ask',
      label: 'Ask AI',
      description: 'Open Q&A pane or insert answer as callout',
      category: 'ai',
      icon: 'MessageSquare',
      // Dispatching a custom event so editor-body.tsx / editor-shell.tsx can
      // intercept and open the Q&A side panel without a direct React ref here.
      execute: (_ed) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('editor:open-qa-pane'));
        }
      },
    },

    // -----------------------------------------------------------------------
    // Embeds
    // -----------------------------------------------------------------------
    {
      id: 'embed-image',
      label: 'Image',
      description: 'Upload an image to Sanity Assets',
      category: 'embed',
      icon: 'Image',
      execute: (_ed) => {
        // Trigger the native file picker — image-upload.ts handles the upload.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('editor:open-image-picker'));
        }
      },
    },
    {
      id: 'embed-table',
      label: 'Table',
      description: 'Insert a 3×3 table',
      category: 'embed',
      icon: 'Table2',
      execute: (ed) => {
        // StarterKit includes Table in some versions; guard against absence.
        // Cast through unknown to avoid TS error — insertTable may not be typed
        // if the extension isn't registered, but StarterKit versions vary.
        type ChainWithTable = {
          insertTable: (opts: { rows: number; cols: number; withHeaderRow: boolean }) => { run: () => boolean };
        };
        const chain = ed.chain().focus() as unknown as ChainWithTable;
        if (typeof chain.insertTable === 'function') {
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Suggestion options factory — separated for testability
// ---------------------------------------------------------------------------

/**
 * Builds the Suggestion plugin configuration.
 * The render callback lazily imports the menu component to avoid circular deps.
 */
function buildSuggestionOptions(
  editorInstance: Editor,
): SuggestionOptions<SlashCommandItem> {
  return {
    pluginKey: SLASH_PLUGIN_KEY,
    editor: editorInstance,
    char: '/',
    allowSpaces: false,
    startOfLine: false,

    items: ({ query }: { query: string }) => {
      const allItems = createSlashCommandItems(editorInstance);
      if (!query) return allItems;
      const lower = query.toLowerCase();
      return allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.description.toLowerCase().includes(lower) ||
          item.id.toLowerCase().includes(lower),
      );
    },

    command: ({
      editor: ed,
      range,
      props: item,
    }: {
      editor: Editor;
      range: Range;
      props: SlashCommandItem;
    }) => {
      // Delete the slash trigger text before running the command
      ed.chain().focus().deleteRange(range).run();
      item.execute(ed);
    },

    render: () => {
      let renderer: ReactRenderer | null = null;

      return {
        onStart: (props: SuggestionProps<SlashCommandItem>) => {
          // Dynamic import keeps the menu component out of the extension bundle
          // and avoids circular module resolution.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { SlashCommandsMenu } = require('./slash-commands-menu') as {
            SlashCommandsMenu: React.ComponentType<unknown>;
          };

          renderer = new ReactRenderer(SlashCommandsMenu, {
            props,
            editor: props.editor,
          });
        },

        onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
          renderer?.updateProps(props);
        },

        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (event.key === 'Escape') {
            renderer?.destroy();
            renderer = null;
            return true;
          }
          // Delegate to the menu component's exposed ref method if available.
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

/**
 * Tiptap Extension that wires the slash command suggestion plugin.
 * Merge into buildEditorExtensions() via buildSlashExtension().
 */
export const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion(buildSuggestionOptions(this.editor)),
    ];
  },
});

/**
 * Returns the slash command extension array for merging into buildEditorExtensions().
 *
 * @example
 * // In use-tiptap-editor.ts or editor-body.tsx:
 * extensions: [...buildEditorExtensions(), ...buildSlashExtension()],
 */
export function buildSlashExtension(): Extension[] {
  return [SlashCommandsExtension];
}
