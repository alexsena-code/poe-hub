'use client';
/**
 * Tiptap inline atomic node for PoE item references.
 *
 * Serializes to {{item:Name|modifier}} in Portable Text — the poetrade-dev
 * `resolveBlocks()` function resolves this on the server to an enriched card.
 *
 * Rendered in the editor as a chip via React NodeView (PoeItemChip).
 * Uses `ReactNodeViewRenderer` so we get full React rendering with shadcn Badge.
 *
 * parseHTML matches `<span data-poe-kind="item">` so existing Portable Text
 * round-tripped through the serializer can re-hydrate nodes correctly.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import type { PoeItemNodeAttrs } from '../types';

// ---------------------------------------------------------------------------
// NodeView — chip rendered inside Tiptap's contenteditable
// ---------------------------------------------------------------------------

function PoeItemChip({ node }: NodeViewProps) {
  const attrs = node.attrs as PoeItemNodeAttrs;
  const { itemName, modifier, iconUrl } = attrs;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle select-none mx-0.5">
      <span
        contentEditable={false}
        className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/60 px-1.5 py-0.5 text-xs font-medium text-amber-200 leading-none cursor-default"
        title={modifier ? `${itemName} (${modifier})` : itemName}
      >
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            width={14}
            height={14}
            className="rounded-sm shrink-0 object-contain"
          />
        )}
        <span>{itemName}</span>
        {modifier && (
          <span className="opacity-60 font-normal">|{modifier}</span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Module augmentation — adds insertPoeItem to the editor command map
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poeItem: {
      /**
       * Insert a PoE item inline node at the current cursor position.
       * @example editor.commands.insertPoeItem({ itemName: 'Mageblood', modifier: 'unique' })
       */
      insertPoeItem: (attrs: PoeItemNodeAttrs) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const PoeItemNode = Node.create({
  name: 'poeItem',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      itemName: { default: '' },
      modifier: { default: null },
      iconUrl: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-poe-kind="item"]',
        getAttrs: (el) => {
          const span = el as HTMLElement;
          return {
            itemName: span.dataset.itemName ?? '',
            modifier: span.dataset.modifier ?? null,
            iconUrl: span.dataset.iconUrl ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const itemName = (node.attrs.itemName as string) ?? '';
    const modifier = (node.attrs.modifier as string | null) ?? null;
    const iconUrl = (node.attrs.iconUrl as string | null) ?? null;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-poe-kind': 'item',
        'data-item-name': itemName,
        'data-modifier': modifier,
        'data-icon-url': iconUrl,
        // Prevent the editor from treating the span as editable text
        contenteditable: 'false',
      }),
      // Display text fallback for non-JS environments / copy-paste
      `{{item:${itemName}${modifier ? `|${modifier}` : ''}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PoeItemChip);
  },

  addCommands() {
    return {
      insertPoeItem:
        (attrs: PoeItemNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
