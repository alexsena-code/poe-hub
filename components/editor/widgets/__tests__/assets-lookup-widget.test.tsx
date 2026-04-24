// @vitest-environment jsdom
/**
 * Tests for AssetsLookupWidget.
 *
 * Validates the 3-tab widget (Items / Gems / Passives) that sits in the
 * editor right rail and inserts poeItem / poePassive atomic nodes.
 *
 * Hooks + WidgetShell are stubbed so the test focuses on the widget's own
 * behaviour: tab switching, row click → insertContent with the right node
 * shape, and graceful rendering in loading / error / empty states.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Editor mock — captures insertContent payloads for assertion
// ---------------------------------------------------------------------------

const insertContentSpy = vi.fn();
const runSpy = vi.fn();

const fakeEditor = {
  chain: () => ({
    focus: () => ({
      insertContent: (payload: unknown) => {
        insertContentSpy(payload);
        return { run: runSpy };
      },
    }),
  }),
};

vi.mock('@/components/editor/editor-context', () => ({
  useEditorContext: () => ({ editor: fakeEditor, draftId: 'draft-1' }),
}));

// ---------------------------------------------------------------------------
// Hook mocks — state lives in module-scoped vars that tests mutate
// ---------------------------------------------------------------------------

interface MockItemsState {
  items: Array<{
    name: string;
    classId: string;
    rarity: string | null;
    baseItem: string | null;
    iconUrl: string | null;
    isGem: boolean;
    gemTags: string[];
    isSupportGem: boolean;
  }>;
  total: number;
  isLoading: boolean;
  error: Error | null;
}

const itemsState: Record<'unique' | 'gem', MockItemsState> = {
  unique: {
    items: [
      {
        name: 'Mageblood',
        classId: 'Belt',
        rarity: 'Unique',
        baseItem: 'Heavy Belt',
        iconUrl: 'https://cdn/mageblood.png',
        isGem: false,
        gemTags: [],
        isSupportGem: false,
      },
    ],
    total: 1,
    isLoading: false,
    error: null,
  },
  gem: {
    items: [
      {
        name: 'Fireball',
        classId: 'Skill Gem',
        rarity: null,
        baseItem: null,
        iconUrl: null,
        isGem: true,
        gemTags: ['Spell', 'Fire'],
        isSupportGem: false,
      },
      {
        name: 'Empower Support',
        classId: 'Support Skill Gem',
        rarity: null,
        baseItem: null,
        iconUrl: null,
        isGem: true,
        gemTags: ['Support'],
        isSupportGem: true,
      },
    ],
    total: 2,
    isLoading: false,
    error: null,
  },
};

vi.mock('../../hooks/use-items-catalog', () => ({
  useItemsCatalog: ({ kind }: { kind: 'unique' | 'gem' }) => ({
    ...itemsState[kind],
    refresh: vi.fn(),
  }),
}));

interface MockPassivesState {
  passives: Array<{
    id: string;
    name: string;
    kind: string;
    ascendancyClass: null;
    stats: string[];
    flavourText: null;
    isAtlasPassive: false;
    patchVersion: string;
  }>;
  isLoading: boolean;
  error: Error | null;
}

const passivesState: MockPassivesState = {
  passives: [
    {
      id: 'acrobatics',
      name: 'Acrobatics',
      kind: 'keystone',
      ascendancyClass: null,
      stats: ['30% more Attack Dodge Rating'],
      flavourText: null,
      isAtlasPassive: false,
      patchVersion: '3.25',
    },
  ],
  isLoading: false,
  error: null,
};

vi.mock('../../hooks/use-passives-catalog', () => ({
  usePassivesCatalog: () => ({ ...passivesState, refresh: vi.fn() }),
  filterPassives: (
    passives: MockPassivesState['passives'],
    query: string,
  ) => {
    if (!query.trim()) return passives;
    const q = query.toLowerCase();
    return passives.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.stats.some((s: string) => s.toLowerCase().includes(q)),
    );
  },
}));

// WidgetShell wraps children in an accordion — stub to render them directly.
vi.mock('../widget-shell', () => ({
  WidgetShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AssetsLookupWidget } from '../assets-lookup-widget';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  insertContentSpy.mockClear();
  runSpy.mockClear();
  itemsState.unique.isLoading = false;
  itemsState.unique.error = null;
  itemsState.gem.isLoading = false;
  itemsState.gem.error = null;
  passivesState.isLoading = false;
  passivesState.error = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetsLookupWidget', () => {
  it('renders the three tab triggers', () => {
    render(<AssetsLookupWidget />);
    expect(screen.getByRole('tab', { name: /items/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /gems/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /passives/i })).toBeInTheDocument();
  });

  it('shows the item rows on the default Items tab', () => {
    render(<AssetsLookupWidget />);
    expect(screen.getByText('Mageblood')).toBeInTheDocument();
  });

  it('inserts a poeItem node on item click with name + modifier + iconUrl', async () => {
    render(<AssetsLookupWidget />);
    const button = screen.getByText('Mageblood').closest('button');
    expect(button).not.toBeNull();
    await userEvent.click(button!);
    expect(insertContentSpy).toHaveBeenCalledTimes(1);
    expect(insertContentSpy.mock.calls[0][0]).toEqual({
      type: 'poeItem',
      attrs: {
        itemName: 'Mageblood',
        modifier: 'unique',
        iconUrl: 'https://cdn/mageblood.png',
      },
    });
  });

  it('tags support gems visually in the Gems tab', async () => {
    render(<AssetsLookupWidget />);
    await userEvent.click(screen.getByRole('tab', { name: /gems/i }));
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Empower Support')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('inserts a poePassive node on passive click', async () => {
    render(<AssetsLookupWidget />);
    await userEvent.click(screen.getByRole('tab', { name: /passives/i }));
    const button = screen.getByText('Acrobatics').closest('button');
    await userEvent.click(button!);
    expect(insertContentSpy).toHaveBeenCalledWith({
      type: 'poePassive',
      attrs: { passiveName: 'Acrobatics' },
    });
  });

  it('renders the error state when the passives hook fails', async () => {
    passivesState.error = new Error('engine offline');
    render(<AssetsLookupWidget />);
    await userEvent.click(screen.getByRole('tab', { name: /passives/i }));
    expect(screen.getByText(/Falha ao carregar/)).toBeInTheDocument();
    expect(screen.getByText(/engine offline/)).toBeInTheDocument();
  });

  it('renders the loading state while the items hook is fetching', () => {
    itemsState.unique.items = [];
    itemsState.unique.total = 0;
    itemsState.unique.isLoading = true;
    render(<AssetsLookupWidget />);
    expect(screen.getByText(/Carregando/)).toBeInTheDocument();
    // restore for subsequent tests in the file
    itemsState.unique.items = [
      {
        name: 'Mageblood',
        classId: 'Belt',
        rarity: 'Unique',
        baseItem: 'Heavy Belt',
        iconUrl: 'https://cdn/mageblood.png',
        isGem: false,
        gemTags: [],
        isSupportGem: false,
      },
    ];
    itemsState.unique.total = 1;
    itemsState.unique.isLoading = false;
  });
});
