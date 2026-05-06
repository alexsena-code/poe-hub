'use client';
/**
 * Central hook that initialises the Tiptap editor with all extensions wired.
 *
 * Extensions in scope (S08.b):
 *   StarterKit (codeBlock disabled — replaced by CodeBlockLowlight)
 *   Link, Image, Placeholder, CodeBlockLowlight, Dropcursor, BubbleMenu, FloatingMenu
 *   Five custom PoE nodes: PoeItem, PoePrice, PoeCurrency, PoeCta, PoePassive
 *
 * Out of scope (S08.g):
 *   slash-commands, mention-at, image-upload
 *
 * The returned editor is `null` only on the very first render before hydration
 * (immediatelyRender: false mode). Consumers should guard: `if (!editor) return`.
 *
 * @example
 * const editor = useTiptapEditor({
 *   initialContent: existingJson,
 *   onUpdate: (json) => setDraft(json),
 * });
 */

import { useEditor, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { createLowlight, common } from 'lowlight';
import type { JSONContent } from '@tiptap/core';
import { DOMParser } from '@tiptap/pm/model';
import { marked } from 'marked';

import { PoeItemNode } from '../extensions/poe-item-node';
import { PoePriceNode } from '../extensions/poe-price-node';
import { PoeCurrencyNode } from '../extensions/poe-currency-node';
import { PoeCtaNode } from '../extensions/poe-cta-node';
import { PoePassiveNode } from '../extensions/poe-passive-node';
import { buildSlashExtension } from '../extensions/slash-commands';
import { buildMentionExtension } from '../extensions/mention-at';
import { buildImageUploadExtension } from '../extensions/image-upload';

// ---------------------------------------------------------------------------
// lowlight instance shared across all editor instances in the app
// Using `common` bundle (~35kb gzip) — covers js/ts/bash/json/html/css
// ---------------------------------------------------------------------------
const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UseTiptapEditorOptions {
  /**
   * Initial Tiptap JSON content to load into the editor.
   * Comes from Portable Text → Tiptap conversion (S08.c) or from an autosaved draft.
   * When undefined, editor starts empty with the placeholder visible.
   */
  initialContent?: JSONContent;
  /**
   * Called after every edit with the full Tiptap JSON document.
   * Debounce inside the hook is the caller's responsibility (autosave hook in S08.e
   * wraps this with a 5-second debounce).
   */
  onUpdate?: (json: JSONContent) => void;
}

// ---------------------------------------------------------------------------
// Extension factory — separated so it's easy to unit-test in isolation
// ---------------------------------------------------------------------------

/** Returns the full extension list ready to pass to useEditor. */
export function buildEditorExtensions() {
  return [
    StarterKit.configure({
      // Disable the default code block — CodeBlockLowlight replaces it with
      // syntax highlighting. Keeping both breaks serialization.
      codeBlock: false,
      // StarterKit ships Link and Dropcursor by default. We add both ourselves
      // with project-specific config (Link.openOnClick=false, Dropcursor color).
      // Disable StarterKit's versions to avoid the "Duplicate extension names"
      // warning at editor init.
      link: false,
      dropcursor: false,
    }),

    Link.configure({
      // Don't navigate away on click inside the editor — operator needs to
      // select and edit links without being redirected.
      openOnClick: false,
      HTMLAttributes: {
        class: 'editor-link',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),

    // Extend the base Image to keep the Sanity asset id on the node. ProseMirror
    // drops attrs that are not declared in the schema, so without addAttributes
    // the data-sanity-ref attr set by image-upload silently disappears and the
    // serializer falls back to writing the CDN URL as the Portable Text _ref —
    // which @sanity/image-url then rejects with "Malformed asset _ref".
    Image.extend({
      addAttributes() {
        // Capturing width/height alongside data-sanity-ref so the serializer
        // emits them on the PortableTextImageBlock — renderers can size
        // correctly without a GROQ join to asset.metadata.dimensions.
        const numericAttr = (htmlAttr: string) => ({
          default: null as number | null,
          parseHTML: (el: HTMLElement) => {
            const raw = el.getAttribute(htmlAttr);
            const n = raw ? parseInt(raw, 10) : NaN;
            return Number.isFinite(n) && n > 0 ? n : null;
          },
          renderHTML: (attrs: Record<string, unknown>) => {
            const v = attrs[htmlAttr];
            return typeof v === 'number' && v > 0 ? { [htmlAttr]: String(v) } : {};
          },
        });
        return {
          ...this.parent?.(),
          'data-sanity-ref': {
            default: null,
            parseHTML: (el) => el.getAttribute('data-sanity-ref'),
            renderHTML: (attrs) => {
              const ref = attrs['data-sanity-ref'];
              return ref ? { 'data-sanity-ref': ref } : {};
            },
          },
          width: numericAttr('width'),
          height: numericAttr('height'),
        };
      },
    }).configure({
      allowBase64: false,
      HTMLAttributes: {
        // h-auto + w-auto override the width/height HTML attrs (set by
        // addAttributes for the captured natural dimensions) so the image can
        // shrink under max-w-full / max-h-[80vh]. Without those overrides, a
        // portrait 746×1653 would render at native pixel size and overflow
        // the viewport. mx-auto + block centers portrait images that end up
        // narrower than the editor block after the height cap kicks in.
        class:
          'editor-image rounded-md block mx-auto w-auto h-auto max-w-full max-h-[80vh] object-contain',
      },
    }),

    Placeholder.configure({
      placeholder: 'Comece digitando… ou use / para inserir blocos e assets PoE.',
    }),

    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'typescript',
      HTMLAttributes: {
        class: 'editor-code-block',
      },
    }),

    Dropcursor.configure({
      color: 'hsl(var(--primary))',
      width: 2,
    }),

    // BubbleMenu and FloatingMenu are loaded as extensions here.
    // The React <BubbleMenu> and <FloatingMenu> wrapper components that render
    // the actual toolbar UI are wired in editor-body.tsx (S08.e).
    BubbleMenu.configure({
      shouldShow: ({ editor: ed, from, to }) => {
        // Only show on non-empty text selection — suppress for node selections
        return from !== to && ed.isEditable;
      },
    }),

    FloatingMenu.configure({
      shouldShow: ({ editor: ed }) => {
        // Show when caret is on an empty paragraph
        return ed.isEditable && ed.isEmpty;
      },
    }),

    // TextAlign — applies to headings and paragraphs (left/center/right/justify).
    // Must come after StarterKit so it can wrap the existing node definitions.
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),

    // Table + sub-nodes — resizable via ProseMirror table-resizing plugin.
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,

    // PoE custom nodes — order matters for parseHTML precedence
    PoeItemNode,
    PoePriceNode,
    PoeCurrencyNode,
    PoeCtaNode,
    PoePassiveNode,

    // Suggestion + upload extensions. Must come AFTER the base Image extension
    // (above) — ImageUploadExtension augments it with paste/drop handlers.
    // Slash '/' opens the command menu; '@' opens item/currency mention search.
    ...buildSlashExtension(),
    ...buildMentionExtension(),
    ...buildImageUploadExtension(),
  ];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Creates and manages the Tiptap editor instance.
 *
 * Returns `Editor | null` — null only before hydration (SSR-safe).
 * Extension list is stable; options.initialContent and options.onUpdate
 * are captured at creation time (wrap in useCallback if they change).
 */
export function useTiptapEditor({
  initialContent,
  onUpdate,
}: UseTiptapEditorOptions): Editor | null {
  const editor = useEditor(
    {
      // immediatelyRender: false keeps the hook SSR-compatible — avoids
      // hydration mismatch between server HTML and client editor DOM.
      immediatelyRender: false,
      extensions: buildEditorExtensions(),
      content: initialContent,
      editorProps: {
        attributes: {
          // Applied to the contenteditable div — markdown-body for typography,
          // min-h so the editor is always clickable even when empty.
          class: [
            'markdown-body max-w-none',
            'min-h-[400px] px-6 py-4',
            'focus:outline-none',
          ].join(' '),
        },
        /**
         * Intercept paste to support Markdown-to-RichText conversion.
         * If the pasted text contains markdown indicators (#, **, etc),
         * we parse it via 'marked' and let Tiptap handle the resulting HTML.
         */
        handlePaste(view, event) {
          const { clipboardData } = event;
          if (!clipboardData) return false;

          const text = clipboardData.getData('text/plain');
          const html = clipboardData.getData('text/html');

          // If there's already HTML (e.g. copied from a webpage), let Tiptap's
          // default logic handle it.
          if (html || !text) return false;

          // Simple heuristic: if it looks like Markdown, parse it.
          // We check for headers, lists, links, or bold/italic.
          // Requires a space after # to avoid false positives with hashtags or IDs.
          const isMarkdown = /^#{1,6}\s|[#\->\+*]\s|[\*_]{1,3}[^*_]+[\*_]{1,3}|\[.+\]\(.+\)/m.test(text);

          if (isMarkdown) {
            // gfm: true is default, but breaks: true ensures single newlines become <br>
            // or we can stick to standard markdown where two newlines = paragraph.
            // Many users expect single newlines to split paragraphs in a web editor.
            const parsedHtml = marked.parse(text, { async: false, breaks: true }) as string;
            const element = document.createElement('div');
            element.innerHTML = parsedHtml;

            const slice = DOMParser.fromSchema(view.state.schema).parseSlice(element);
            const tr = view.state.tr.replaceSelection(slice);
            view.dispatch(tr.scrollIntoView());
            return true;
          }

          return false;
        },
      },
      onUpdate({ editor: ed }) {
        onUpdate?.(ed.getJSON());
      },
    },
    // Deps: if initialContent identity changes (new doc loaded), re-create editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialContent],
  );

  return editor ?? null;
}
