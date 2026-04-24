'use client';
/**
 * Tiptap BLOCK atomic node for PoE call-to-action banners.
 *
 * Unlike the inline nodes, this is a block-level element (group: 'block', atom: true).
 * Serializes to {{cta:variant|modifier}} in Portable Text.
 * The poetrade-dev render layer reads this and emits a full-width promotional banner.
 *
 * NodeView: large card with variant/modifier chips. Operator can change variant
 * and modifier inline via dropdowns rendered in the NodeView.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import type { NodeViewProps } from '@tiptap/core';
import type { PoeCtaNodeAttrs } from '../types';

// ---------------------------------------------------------------------------
// NodeView — full-width CTA banner preview
// ---------------------------------------------------------------------------

const VARIANT_LABELS: Record<PoeCtaNodeAttrs['variant'], string> = {
  currency: 'Currency',
  builds: 'Builds',
  items: 'Items',
  maps: 'Maps',
};

const MODIFIER_LABELS: Record<PoeCtaNodeAttrs['modifier'], string> = {
  poe1: 'PoE 1',
  poe2: 'PoE 2',
};

const VARIANT_COLORS: Record<PoeCtaNodeAttrs['variant'], string> = {
  currency: 'border-yellow-500/40 bg-yellow-950/30 text-yellow-200',
  builds: 'border-violet-500/40 bg-violet-950/30 text-violet-200',
  items: 'border-amber-500/40 bg-amber-950/30 text-amber-200',
  maps: 'border-sky-500/40 bg-sky-950/30 text-sky-200',
};

function PoeCtaBanner({ node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as PoeCtaNodeAttrs;
  const { variant, modifier } = attrs;
  const colorClass = VARIANT_COLORS[variant] ?? VARIANT_COLORS.currency;

  function handleVariantChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateAttributes({ variant: e.target.value as PoeCtaNodeAttrs['variant'] });
  }

  function handleModifierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateAttributes({ modifier: e.target.value as PoeCtaNodeAttrs['modifier'] });
  }

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className={`my-3 rounded-lg border-2 px-4 py-3 ${colorClass} select-none`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* CTA badge */}
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase opacity-70">
              CTA
            </span>
            <span className="text-sm font-semibold">
              {VARIANT_LABELS[variant]} Banner — {MODIFIER_LABELS[modifier]}
            </span>
          </div>

          {/* Inline controls — allow operator to change variant/modifier without a dialog */}
          <div className="flex items-center gap-2">
            <select
              value={variant}
              onChange={handleVariantChange}
              className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-xs text-current cursor-pointer focus:outline-none"
            >
              {(Object.keys(VARIANT_LABELS) as PoeCtaNodeAttrs['variant'][]).map((v) => (
                <option key={v} value={v}>{VARIANT_LABELS[v]}</option>
              ))}
            </select>
            <select
              value={modifier}
              onChange={handleModifierChange}
              className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-xs text-current cursor-pointer focus:outline-none"
            >
              {(Object.keys(MODIFIER_LABELS) as PoeCtaNodeAttrs['modifier'][]).map((m) => (
                <option key={m} value={m}>{MODIFIER_LABELS[m]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Placeholder copy — what the blog visitor sees is rendered by poetrade-dev */}
        <p className="mt-1.5 text-xs opacity-50">
          {`{{cta:${variant}|${modifier}}}`} — resolves at render time
        </p>
      </div>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Module augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poeCta: {
      /**
       * Insert a PoE CTA block node.
       * @example editor.commands.insertPoeCta({ variant: 'currency', modifier: 'poe2' })
       */
      insertPoeCta: (attrs: PoeCtaNodeAttrs) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const PoeCtaNode = Node.create({
  name: 'poeCta',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      variant: { default: 'currency' },
      modifier: { default: 'poe2' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-poe-kind="cta"]',
        getAttrs: (el) => {
          const div = el as HTMLElement;
          return {
            variant: div.dataset.variant ?? 'currency',
            modifier: div.dataset.modifier ?? 'poe2',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = (node.attrs.variant as string) ?? 'currency';
    const modifier = (node.attrs.modifier as string) ?? 'poe2';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-poe-kind': 'cta',
        'data-variant': variant,
        'data-modifier': modifier,
      }),
      `{{cta:${variant}|${modifier}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PoeCtaBanner);
  },

  addCommands() {
    return {
      insertPoeCta:
        (attrs: PoeCtaNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
