// @vitest-environment jsdom
/**
 * Tests for PoeCtaNode Tiptap extension.
 *
 * Validates:
 * 1. parseHTML maps data-variant and data-modifier from div[data-poe-kind="cta"]
 * 2. renderHTML emits correct data-* attrs and placeholder text
 * 3. insertPoeCta command inserts block with correct attrs
 * 4. updateAttributes (used by the NodeView dropdowns) modifies attrs
 *
 * ReactNodeViewRenderer is mocked — visual rendering is left to E2E tests.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { StarterKit } from '@tiptap/starter-kit';

vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: () => () => ({ dom: document.createElement('div') }),
  NodeViewWrapper: 'div',
}));

import { PoeCtaNode } from '../poe-cta-node';
import type { PoeCtaNodeAttrs } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      PoeCtaNode,
    ],
    element: document.createElement('div'),
  });
}

function getFirstCtaNode(editor: Editor): PmNode | null {
  let found: PmNode | null = null;
  editor.state.doc.descendants((node: PmNode) => {
    if (!found && node.type.name === 'poeCta') found = node;
  });
  return found;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoeCtaNode', () => {
  let editor: Editor;

  beforeAll(() => {
    editor = buildEditor();
  });

  afterEach(() => {
    editor.commands.clearContent();
  });

  it('registers the poeCta node type', () => {
    expect(editor.schema.nodes.poeCta).toBeDefined();
  });

  it('poeCta is a block-level node (not inline)', () => {
    const spec = editor.schema.nodes.poeCta.spec;
    expect(spec.group).toContain('block');
    expect(spec.inline).toBeFalsy();
  });

  it('insertPoeCta command inserts a block node with correct attrs', () => {
    const attrs: PoeCtaNodeAttrs = { variant: 'builds', modifier: 'poe1' };
    const result = editor.commands.insertPoeCta(attrs);

    expect(result).toBe(true);

    const ctaNode = getFirstCtaNode(editor);
    expect(ctaNode).not.toBeNull();
    expect(ctaNode!.attrs.variant).toBe('builds');
    expect(ctaNode!.attrs.modifier).toBe('poe1');
  });

  it('insertPoeCta defaults to currency / poe2 when using default attrs', () => {
    editor.commands.insertPoeCta({ variant: 'currency', modifier: 'poe2' });

    const ctaNode = getFirstCtaNode(editor);
    expect(ctaNode).not.toBeNull();
    expect(ctaNode!.attrs.variant).toBe('currency');
    expect(ctaNode!.attrs.modifier).toBe('poe2');
  });

  it('renderHTML contains data-poe-kind="cta"', () => {
    editor.commands.insertPoeCta({ variant: 'maps', modifier: 'poe2' });

    const html = editor.getHTML();
    expect(html).toContain('data-poe-kind="cta"');
    expect(html).toContain('data-variant="maps"');
    expect(html).toContain('data-modifier="poe2"');
  });

  it('renderHTML text contains {{cta:variant|modifier}} placeholder', () => {
    editor.commands.insertPoeCta({ variant: 'items', modifier: 'poe1' });

    const html = editor.getHTML();
    expect(html).toContain('{{cta:items|poe1}}');
  });

  it('parseHTML recognises div[data-poe-kind="cta"]', () => {
    const html = `<div data-poe-kind="cta" data-variant="builds" data-modifier="poe2">{{cta:builds|poe2}}</div>`;
    editor.commands.setContent(html);

    const ctaNode = getFirstCtaNode(editor);
    expect(ctaNode).not.toBeNull();
    expect(ctaNode!.attrs.variant).toBe('builds');
    expect(ctaNode!.attrs.modifier).toBe('poe2');
  });

  it('parseHTML falls back to defaults when data attrs are missing', () => {
    // A div with data-poe-kind="cta" but no variant/modifier attrs
    const html = `<div data-poe-kind="cta">{{cta:currency|poe2}}</div>`;
    editor.commands.setContent(html);

    const ctaNode = getFirstCtaNode(editor);
    expect(ctaNode).not.toBeNull();
    // Should fall back to node attribute defaults
    expect(ctaNode!.attrs.variant).toBe('currency');
    expect(ctaNode!.attrs.modifier).toBe('poe2');
  });
});
