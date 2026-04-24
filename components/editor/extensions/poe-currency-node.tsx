'use client';
/**
 * Tiptap inline atomic node for PoE currency references.
 *
 * Serializes to {{item:currencyName}} in Portable Text (no separate "currency"
 * kind — poetrade-dev identifies currencies via classId in the item catalog,
 * so the placeholder kind stays "item").
 *
 * NodeView: gold/amber chip to visually distinguish currencies from generic items.
 *
 * The currency catalog is fetched once at editor mount via use-currency-catalog (S08.f)
 * and the SWR cache feeds drag-drop (side-panel-assets) + the slash command picker.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import type { PoeCurrencyNodeAttrs } from '../types';

// ---------------------------------------------------------------------------
// NodeView
// ---------------------------------------------------------------------------

function PoeCurrencyChip({ node }: NodeViewProps) {
  const attrs = node.attrs as PoeCurrencyNodeAttrs;
  const { currencyName, iconUrl } = attrs;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle select-none mx-0.5">
      <span
        contentEditable={false}
        className="inline-flex items-center gap-1 rounded-md border border-yellow-500/50 bg-yellow-950/60 px-1.5 py-0.5 text-xs font-medium text-yellow-200 leading-none cursor-default"
        title={`Currency: ${currencyName}`}
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            width={14}
            height={14}
            className="rounded-sm shrink-0 object-contain"
          />
        ) : (
          /* ◈ is a traditional PoE currency glyph stand-in */
          <span className="text-[10px] leading-none opacity-70">◈</span>
        )}
        <span>{currencyName}</span>
      </span>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Module augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poeCurrency: {
      /**
       * Insert a PoE currency inline node.
       * @example editor.commands.insertPoeCurrency({ currencyName: 'Divine Orb', iconUrl: '...' })
       */
      insertPoeCurrency: (attrs: PoeCurrencyNodeAttrs) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const PoeCurrencyNode = Node.create({
  name: 'poeCurrency',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      currencyName: { default: '' },
      iconUrl: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-poe-kind="currency"]',
        getAttrs: (el) => {
          const span = el as HTMLElement;
          return {
            currencyName: span.dataset.currencyName ?? '',
            iconUrl: span.dataset.iconUrl ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const currencyName = (node.attrs.currencyName as string) ?? '';
    const iconUrl = (node.attrs.iconUrl as string | null) ?? null;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-poe-kind': 'currency',
        'data-currency-name': currencyName,
        'data-icon-url': iconUrl,
        contenteditable: 'false',
      }),
      // Serializes as item kind — poetrade-dev has no separate "currency" kind
      `{{item:${currencyName}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PoeCurrencyChip);
  },

  addCommands() {
    return {
      insertPoeCurrency:
        (attrs: PoeCurrencyNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
