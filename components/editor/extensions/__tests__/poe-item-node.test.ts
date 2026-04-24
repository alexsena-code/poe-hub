// @vitest-environment jsdom
/**
 * Tests for PoeItemNode Tiptap extension.
 *
 * Validates:
 * 1. parseHTML correctly maps data-* attributes from HTML span elements
 * 2. renderHTML emits the expected data-* attributes in the DOM
 * 3. insertPoeItem command inserts the node and attrs are preserved
 *
 * Uses @tiptap/core Editor in isolation — no React NodeView rendering
 * (that's exercised via Playwright E2E in the full editor flow).
 * ReactNodeViewRenderer is mocked to prevent DOM rendering errors in jsdom.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { StarterKit } from '@tiptap/starter-kit';

// Mock ReactNodeViewRenderer to avoid React rendering in this unit test.
// The NodeView visual is tested separately via RTL if needed.
vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: () => () => ({ dom: document.createElement('span') }),
  NodeViewWrapper: 'span',
}));

// Import after mock is in place
import { PoeItemNode } from '../poe-item-node';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      PoeItemNode,
    ],
    element: document.createElement('div'),
  });
}

function getFirstNodeOfType(editor: Editor, typeName: string): PmNode | null {
  let found: PmNode | null = null;
  editor.state.doc.descendants((node: PmNode) => {
    if (!found && node.type.name === typeName) found = node;
  });
  return found;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoeItemNode', () => {
  let editor: Editor;

  beforeAll(() => {
    editor = buildEditor();
  });

  afterEach(() => {
    // Reset content between tests
    editor.commands.clearContent();
  });

  it('registers the poeItem node type', () => {
    expect(editor.schema.nodes.poeItem).toBeDefined();
  });

  it('insertPoeItem command inserts a node with correct attrs', () => {
    const result = editor.commands.insertPoeItem({
      itemName: 'Mageblood',
      modifier: 'unique',
      iconUrl: 'https://cdn.example.com/mageblood.png',
    });

    expect(result).toBe(true);

    const poeNode = getFirstNodeOfType(editor, 'poeItem');
    expect(poeNode).not.toBeNull();
    expect(poeNode!.attrs.itemName).toBe('Mageblood');
    expect(poeNode!.attrs.modifier).toBe('unique');
    expect(poeNode!.attrs.iconUrl).toBe('https://cdn.example.com/mageblood.png');
  });

  it('insertPoeItem with no modifier leaves modifier null', () => {
    editor.commands.insertPoeItem({ itemName: 'Kaom\'s Heart' });

    const poeNode = getFirstNodeOfType(editor, 'poeItem');
    expect(poeNode).not.toBeNull();
    expect(poeNode!.attrs.itemName).toBe("Kaom's Heart");
    expect(poeNode!.attrs.modifier).toBeNull();
    expect(poeNode!.attrs.iconUrl).toBeNull();
  });

  it('parseHTML recognises span[data-poe-kind="item"]', () => {
    const html = `<p><span data-poe-kind="item" data-item-name="Headhunter" data-modifier="unique"></span></p>`;
    editor.commands.setContent(html);

    const poeNode = getFirstNodeOfType(editor, 'poeItem');
    expect(poeNode).not.toBeNull();
    expect(poeNode!.attrs.itemName).toBe('Headhunter');
    expect(poeNode!.attrs.modifier).toBe('unique');
  });

  it('parseHTML ignores span without data-poe-kind="item"', () => {
    const html = `<p><span class="other">plain span</span></p>`;
    editor.commands.setContent(html);

    const poeNode = getFirstNodeOfType(editor, 'poeItem');
    expect(poeNode).toBeNull();
  });

  it('renderHTML output contains data-poe-kind and data-item-name', () => {
    editor.commands.insertPoeItem({ itemName: 'Voidforge', modifier: 'rare' });

    const html = editor.getHTML();
    expect(html).toContain('data-poe-kind="item"');
    expect(html).toContain('data-item-name="Voidforge"');
    expect(html).toContain('data-modifier="rare"');
  });

  it('renderHTML text content contains the placeholder syntax', () => {
    editor.commands.insertPoeItem({ itemName: 'Mageblood', modifier: 'unique' });

    const html = editor.getHTML();
    expect(html).toContain('{{item:Mageblood|unique}}');
  });

  it('renderHTML without modifier omits pipe separator in placeholder', () => {
    editor.commands.insertPoeItem({ itemName: 'Tabula Rasa' });

    const html = editor.getHTML();
    expect(html).toContain('{{item:Tabula Rasa}}');
    expect(html).not.toContain('{{item:Tabula Rasa|');
  });
});
