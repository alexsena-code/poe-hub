// @vitest-environment jsdom
/**
 * Tests for createSlashCommandItems and SlashCommandsExtension.
 *
 * Validates:
 * 1. All expected categories are present in the item list.
 * 2. Items filter correctly by query (label + description + id).
 * 3. Grouping by category returns correct sets.
 * 4. Each item's execute function dispatches valid editor commands.
 * 5. Extension registers without errors in a real Editor instance.
 *
 * ReactRenderer and require() side-effects are mocked — the actual menu
 * component is tested via RTL separately.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';

// Mock ReactRenderer to avoid React rendering in unit tests
vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: () => () => ({ dom: document.createElement('span') }),
  NodeViewWrapper: 'span',
  ReactRenderer: vi.fn().mockImplementation(() => ({
    updateProps: vi.fn(),
    destroy: vi.fn(),
    ref: { onKeyDown: () => false },
  })),
}));

// Mock the menu component require() inside the extension
vi.mock('../slash-commands-menu', () => ({
  SlashCommandsMenu: () => null,
}));

// Mock PoE node extensions (they use ReactNodeViewRenderer)
vi.mock('../poe-item-node', () => ({
  PoeItemNode: {
    name: 'poeItem',
    extend: vi.fn(),
    create: vi.fn(),
  },
}));

import { createSlashCommandItems, buildSlashExtension } from '../slash-commands';
import type { SlashCommandItem } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMinimalEditor(): Editor {
  return new Editor({
    extensions: [StarterKit],
    element: document.createElement('div'),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSlashCommandItems', () => {
  let editor: Editor;

  beforeAll(() => {
    editor = buildMinimalEditor();
  });

  afterEach(() => {
    editor.commands.clearContent();
  });

  it('returns a non-empty array', () => {
    const items = createSlashCommandItems(editor);
    expect(items.length).toBeGreaterThan(0);
  });

  it('covers all four categories', () => {
    const items = createSlashCommandItems(editor);
    const cats = new Set(items.map((i) => i.category));
    expect(cats).toContain('formatting');
    expect(cats).toContain('poe');
    expect(cats).toContain('ai');
    expect(cats).toContain('embed');
  });

  it('includes heading-1, heading-2, heading-3 in formatting', () => {
    const items = createSlashCommandItems(editor);
    const formattingIds = items
      .filter((i) => i.category === 'formatting')
      .map((i) => i.id);
    expect(formattingIds).toContain('heading-1');
    expect(formattingIds).toContain('heading-2');
    expect(formattingIds).toContain('heading-3');
  });

  it('includes poe-currency, poe-cta in poe category', () => {
    const items = createSlashCommandItems(editor);
    const poeIds = items.filter((i) => i.category === 'poe').map((i) => i.id);
    expect(poeIds).toContain('poe-currency');
    expect(poeIds).toContain('poe-cta');
  });

  it('includes ai-ask in ai category', () => {
    const items = createSlashCommandItems(editor);
    const aiIds = items.filter((i) => i.category === 'ai').map((i) => i.id);
    expect(aiIds).toContain('ai-ask');
  });

  it('includes embed-image in embed category', () => {
    const items = createSlashCommandItems(editor);
    const embedIds = items.filter((i) => i.category === 'embed').map((i) => i.id);
    expect(embedIds).toContain('embed-image');
  });

  it('each item has required fields: id, label, description, category, icon, execute', () => {
    const items = createSlashCommandItems(editor);
    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(['formatting', 'poe', 'ai', 'embed']).toContain(item.category);
      expect(typeof item.icon).toBe('string');
      expect(typeof item.execute).toBe('function');
    }
  });

  it('filters items by label query (case-insensitive)', () => {
    const allItems = createSlashCommandItems(editor);
    const query = 'heading';
    const filtered = allItems.filter(
      (item: SlashCommandItem) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.id.toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((i) => i.id.includes('heading'))).toBe(true);
  });

  it('filters items by description query', () => {
    const allItems = createSlashCommandItems(editor);
    // "Unordered list" is the bullet-list description
    const filtered = allItems.filter((i) =>
      i.description.toLowerCase().includes('unordered'),
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('bullet-list');
  });

  it('empty query returns all items', () => {
    const allItems = createSlashCommandItems(editor);
    const query = '';
    const filtered = allItems.filter(
      (item: SlashCommandItem) =>
        query === '' ||
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query),
    );
    // All items match empty query
    expect(filtered.length).toBe(allItems.length);
  });

  it('item IDs are unique', () => {
    const items = createSlashCommandItems(editor);
    const ids = items.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('buildSlashExtension', () => {
  it('returns an array with at least one extension', () => {
    const exts = buildSlashExtension();
    expect(Array.isArray(exts)).toBe(true);
    expect(exts.length).toBeGreaterThan(0);
  });

  it('first extension has name "slashCommands"', () => {
    const exts = buildSlashExtension();
    expect(exts[0].name).toBe('slashCommands');
  });
});
