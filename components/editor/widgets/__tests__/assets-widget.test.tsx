// @vitest-environment jsdom
/**
 * Tests for AssetsWidget component.
 *
 * Migrated from components/editor/__tests__/side-panel-assets.test.tsx (S10.a).
 * Updated S13: widget now sources currencies from useItemsCatalog (kind=currency)
 * so chips ship with iconUrl baked in — no async resolve at insert time.
 *
 * Validates:
 * 1. Renders currency list from useItemsCatalog.
 * 2. Search/filter narrows list (engine-side, mocked here per-query).
 * 3. Click on chip calls editor.chain().focus().insertPoeCurrency().run() with iconUrl.
 * 4. DragStart event sets correct dataTransfer data including iconUrl.
 * 5. Loading state renders spinner.
 * 6. Error state renders error message.
 * 7. Empty state when filter matches nothing.
 * 8. Click on entry without iconUrl inserts chip with undefined iconUrl.
 * 9. Count badge shows visible vs total.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
// Mocks
// ---------------------------------------------------------------------------

const mockInsertPoeCurrency = vi.fn().mockReturnValue(true);
const mockRun = vi.fn().mockReturnValue(true);

const fakeEditor = {
  chain: () => ({
    focus: () => ({
      insertPoeCurrency: (attrs: { currencyName: string; iconUrl?: string }) => {
        mockInsertPoeCurrency(attrs);
        return { run: mockRun };
      },
    }),
  }),
};

vi.mock('@/components/editor/editor-context', () => ({
  useEditorContext: () => ({
    editor: fakeEditor,
    draftId: 'test-draft',
  }),
}));

interface FakeEntry {
  name: string;
  classId: string;
  rarity: string | null;
  baseItem: string | null;
  iconUrl: string | null;
  isGem: boolean;
  gemTags: string[];
  isSupportGem: boolean;
}

function makeEntry(name: string, iconUrl: string | null = null): FakeEntry {
  return {
    name,
    classId: 'StackableCurrency',
    rarity: null,
    baseItem: null,
    iconUrl,
    isGem: false,
    gemTags: [],
    isSupportGem: false,
  };
}

let mockItems: FakeEntry[] = [
  makeEntry('Divine Orb', 'https://cdn.example.com/divine.png'),
  makeEntry('Chaos Orb', null),
  makeEntry('Exalted Orb', 'https://cdn.example.com/exalted.png'),
];
let mockTotal = 3;
let mockIsLoading = false;
let mockError: Error | null = null;

vi.mock('@/components/editor/hooks/use-items-catalog', () => ({
  useItemsCatalog: ({ q }: { q?: string }) => {
    const filtered = q && q.trim()
      ? mockItems.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
      : mockItems;
    return {
      items: filtered,
      total: mockTotal,
      isLoading: mockIsLoading,
      error: mockError,
      refresh: vi.fn(),
    };
  },
}));

// WidgetShell renders children inside Accordion — stub it to render children directly
vi.mock('../widget-shell', () => ({
  WidgetShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AssetsWidget } from '../assets-widget';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockItems = [
    makeEntry('Divine Orb', 'https://cdn.example.com/divine.png'),
    makeEntry('Chaos Orb', null),
    makeEntry('Exalted Orb', 'https://cdn.example.com/exalted.png'),
  ];
  mockTotal = 3;
  mockIsLoading = false;
  mockError = null;
  mockInsertPoeCurrency.mockClear();
  mockRun.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetsWidget', () => {
  it('renders currency list from catalog', () => {
    render(<AssetsWidget />);
    expect(screen.getByText('Divine Orb')).toBeInTheDocument();
    expect(screen.getByText('Chaos Orb')).toBeInTheDocument();
    expect(screen.getByText('Exalted Orb')).toBeInTheDocument();
  });

  it('renders icon img for entries with iconUrl', () => {
    render(<AssetsWidget />);
    const divineRow = screen.getByText('Divine Orb').closest('[role="button"]');
    expect(divineRow).not.toBeNull();
    const img = divineRow!.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/divine.png');
  });

  it('renders loading spinner when isLoading and no items', () => {
    mockIsLoading = true;
    mockItems = [];
    render(<AssetsWidget />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error message when error is set', () => {
    mockError = new Error('network timeout');
    mockItems = [];
    render(<AssetsWidget />);
    expect(screen.getByText(/Falha ao carregar catálogo/)).toBeInTheDocument();
    expect(screen.getByText(/network timeout/)).toBeInTheDocument();
  });

  it('filters list by search input', async () => {
    render(<AssetsWidget />);
    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'divine');
    await waitFor(() => {
      expect(screen.getByText('Divine Orb')).toBeInTheDocument();
      expect(screen.queryByText('Chaos Orb')).not.toBeInTheDocument();
      expect(screen.queryByText('Exalted Orb')).not.toBeInTheDocument();
    });
  });

  it('filter is case-insensitive', async () => {
    render(<AssetsWidget />);
    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'CHAOS');
    await waitFor(() => {
      expect(screen.getByText('Chaos Orb')).toBeInTheDocument();
      expect(screen.queryByText('Divine Orb')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when filter matches nothing', async () => {
    render(<AssetsWidget />);
    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'zzznotexist');
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma currency encontrada/)).toBeInTheDocument();
    });
  });

  it('click on chip calls insertPoeCurrency with the iconUrl from the entry', async () => {
    render(<AssetsWidget />);
    const divineChip = screen.getByText('Divine Orb').closest('[role="button"]');
    expect(divineChip).not.toBeNull();
    await userEvent.click(divineChip!);
    expect(mockInsertPoeCurrency).toHaveBeenCalledWith({
      currencyName: 'Divine Orb',
      iconUrl: 'https://cdn.example.com/divine.png',
    });
    expect(mockRun).toHaveBeenCalled();
  });

  it('click on chip without iconUrl passes undefined', async () => {
    render(<AssetsWidget />);
    const chaosChip = screen.getByText('Chaos Orb').closest('[role="button"]');
    await userEvent.click(chaosChip!);
    expect(mockInsertPoeCurrency).toHaveBeenCalledWith({
      currencyName: 'Chaos Orb',
      iconUrl: undefined,
    });
  });

  it('dragstart sets correct dataTransfer data with iconUrl', () => {
    render(<AssetsWidget />);
    const chip = screen.getByText('Divine Orb').closest('[draggable="true"]');
    expect(chip).not.toBeNull();
    const dataMap: Record<string, string> = {};
    const mockDataTransfer = {
      setData: (type: string, value: string) => { dataMap[type] = value; },
      effectAllowed: '',
    };
    fireEvent.dragStart(chip!, { dataTransfer: mockDataTransfer });
    expect(dataMap['application/poe-hub-currency']).toBeDefined();
    const parsed = JSON.parse(dataMap['application/poe-hub-currency']);
    expect(parsed.name).toBe('Divine Orb');
    expect(parsed.iconUrl).toBe('https://cdn.example.com/divine.png');
  });

  it('shows count of visible vs total currencies', () => {
    render(<AssetsWidget />);
    // No filter → items.length === total → only show "3" without "/3"
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
