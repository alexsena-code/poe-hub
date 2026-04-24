'use client';
/**
 * Tiptap inline atomic node for PoE passive skill tree references.
 *
 * Serializes to {{passive:Name}} in Portable Text.
 * The poetrade-dev render layer resolves this to a skill description tooltip.
 *
 * NodeView: purple chip — passive skills have a violet/purple aesthetic
 * in the official PoE passive tree UI.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import type { PoePassiveNodeAttrs } from '../types';

// ---------------------------------------------------------------------------
// NodeView
// ---------------------------------------------------------------------------

function PoePassiveChip({ node }: NodeViewProps) {
  const attrs = node.attrs as PoePassiveNodeAttrs;
  const { passiveName } = attrs;

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle select-none mx-0.5">
      <span
        contentEditable={false}
        className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-950/60 px-1.5 py-0.5 text-xs font-medium text-violet-200 leading-none cursor-default"
        title={`Passive: ${passiveName}`}
      >
        {/* Passive tree node icon stand-in */}
        <span className="text-[10px] leading-none opacity-70">◆</span>
        <span>{passiveName}</span>
      </span>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Module augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poePassive: {
      /**
       * Insert a PoE passive skill inline node.
       * @example editor.commands.insertPoePassive({ passiveName: 'Acrobatics' })
       */
      insertPoePassive: (attrs: PoePassiveNodeAttrs) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const PoePassiveNode = Node.create({
  name: 'poePassive',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      passiveName: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-poe-kind="passive"]',
        getAttrs: (el) => {
          const span = el as HTMLElement;
          return {
            passiveName: span.dataset.passiveName ?? '',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const passiveName = (node.attrs.passiveName as string) ?? '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-poe-kind': 'passive',
        'data-passive-name': passiveName,
        contenteditable: 'false',
      }),
      `{{passive:${passiveName}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PoePassiveChip);
  },

  addCommands() {
    return {
      insertPoePassive:
        (attrs: PoePassiveNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
