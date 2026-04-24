'use client';
/**
 * Tiptap inline atomic node for PoE price queries.
 *
 * Serializes to {{price:Name|currency}} in Portable Text.
 * The poetrade-dev `resolveBlocks()` fetches the live price from
 * `GET /api/knowledge/ninja-price/:game/:category` at render time.
 *
 * NodeView: green chip (price = money = green) with currency modifier.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import type { PoePriceNodeAttrs } from '../types';

// ---------------------------------------------------------------------------
// NodeView
// ---------------------------------------------------------------------------

function PoePriceChip({ node }: NodeViewProps) {
  const attrs = node.attrs as PoePriceNodeAttrs;
  const { itemName, modifier } = attrs;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle select-none mx-0.5">
      <span
        contentEditable={false}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/60 px-1.5 py-0.5 text-xs font-medium text-emerald-200 leading-none cursor-default"
        title={`Price: ${itemName}${modifier ? ` in ${modifier}` : ''}`}
      >
        {/* Currency symbol prefix */}
        <span className="opacity-60 text-[10px]">$</span>
        <span>{itemName}</span>
        {modifier && (
          <span className="opacity-60 font-normal">|{modifier}</span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Module augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poePrice: {
      /**
       * Insert a PoE price query inline node.
       * @example editor.commands.insertPoePrice({ itemName: 'Mageblood', modifier: 'divine' })
       */
      insertPoePrice: (attrs: PoePriceNodeAttrs) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const PoePriceNode = Node.create({
  name: 'poePrice',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      itemName: { default: '' },
      modifier: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-poe-kind="price"]',
        getAttrs: (el) => {
          const span = el as HTMLElement;
          return {
            itemName: span.dataset.itemName ?? '',
            modifier: span.dataset.modifier ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const itemName = (node.attrs.itemName as string) ?? '';
    const modifier = (node.attrs.modifier as string | null) ?? null;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-poe-kind': 'price',
        'data-item-name': itemName,
        'data-modifier': modifier,
        contenteditable: 'false',
      }),
      `{{price:${itemName}${modifier ? `|${modifier}` : ''}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PoePriceChip);
  },

  addCommands() {
    return {
      insertPoePrice:
        (attrs: PoePriceNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
