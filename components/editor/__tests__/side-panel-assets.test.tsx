// @vitest-environment jsdom
/**
 * Tests for SidePanelAssets component.
 *
 * Validates:
 * 1. Renders the currency list returned by useCurrencyCatalog.
 * 2. Search/filter narrows the list (case-insensitive).
 * 3. Click on a chip calls editor.chain().focus().insertPoeCurrency().run().
 * 4. DragStart event sets correct dataTransfer data.
 * 5. Loading state renders spinner.
 * 6. Error state renders error message.
 *
 * useCurrencyCatalog is mocked to avoid SWR/fetch in tests.
 * useEditorContext is mocked with a fake editor that records commands.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// jsdom polyfills required by Radix UI ScrollArea
// ---------------------------------------------------------------------------

// ResizeObserver is not implemented in jsdom — ScrollArea uses it.
// Provide a no-op stub so components mount without throwing.
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Mocks (must come before component imports)
// ---------------------------------------------------------------------------

const mockInsertPoeCurrency = vi.fn().mockReturnValue(true);
const mockRun = vi.fn().mockReturnValue(true);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockFocus = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockChain = vi.fn();

// Fake editor — chain().focus().insertPoeCurrency().run()
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

// resolveCurrencyIcon — default returns a mock URL; overridden per test as needed.
const mockResolveCurrencyIcon = vi.fn().mockResolvedValue('https://cdn.example.com/divine.png');

vi.mock('@/components/editor/hooks/resolve-currency-icon', () => ({
  resolveCurrencyIcon: (...args: unknown[]) => mockResolveCurrencyIcon(...args),
}));

vi.mock('@/components/editor/editor-context', () => ({
  useEditorContext: () => ({
    editor: fakeEditor,
    draftId: 'test-draft',
  }),
}));

// Default mock state — overridden per test
let mockCurrencies: string[] = ['Divine Orb', 'Chaos Orb', 'Exalted Orb'];
let mockIsLoading = false;
let mockError: Error | null = null;

vi.mock('@/components/editor/hooks/use-currency-catalog', () => ({
  useCurrencyCatalog: () => ({
    currencies: mockCurrencies,
    isLoading: mockIsLoading,
    error: mockError,
    refresh: vi.fn(),
  }),
  filterCurrencies: (currencies: string[], query: string) => {
    if (!query.trim()) return currencies;
    const q = query.toLowerCase();
    return currencies.filter((n: string) => n.toLowerCase().includes(q));
  },
}));

// Import after mocks
import { SidePanelAssets } from '../side-panel-assets';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockCurrencies = ['Divine Orb', 'Chaos Orb', 'Exalted Orb'];
  mockIsLoading = false;
  mockError = null;
  mockInsertPoeCurrency.mockClear();
  mockRun.mockClear();
  mockResolveCurrencyIcon.mockClear();
  mockResolveCurrencyIcon.mockResolvedValue('https://cdn.example.com/divine.png');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidePanelAssets', () => {
  it('renders currency list from catalog', () => {
    render(<SidePanelAssets />);
    expect(screen.getByText('Divine Orb')).toBeInTheDocument();
    expect(screen.getByText('Chaos Orb')).toBeInTheDocument();
    expect(screen.getByText('Exalted Orb')).toBeInTheDocument();
  });

  it('renders loading spinner when isLoading', () => {
    mockIsLoading = true;
    mockCurrencies = [];
    render(<SidePanelAssets />);
    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner has role="status"
  });

  it('renders error message when error is set', () => {
    mockError = new Error('network timeout');
    mockCurrencies = [];
    render(<SidePanelAssets />);
    expect(screen.getByText(/Falha ao carregar catálogo/)).toBeInTheDocument();
    expect(screen.getByText(/network timeout/)).toBeInTheDocument();
  });

  it('filters list by search input', async () => {
    render(<SidePanelAssets />);

    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'divine');

    await waitFor(() => {
      expect(screen.getByText('Divine Orb')).toBeInTheDocument();
      expect(screen.queryByText('Chaos Orb')).not.toBeInTheDocument();
      expect(screen.queryByText('Exalted Orb')).not.toBeInTheDocument();
    });
  });

  it('filter is case-insensitive', async () => {
    render(<SidePanelAssets />);

    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'CHAOS');

    await waitFor(() => {
      expect(screen.getByText('Chaos Orb')).toBeInTheDocument();
      expect(screen.queryByText('Divine Orb')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when filter matches nothing', async () => {
    render(<SidePanelAssets />);

    const input = screen.getByPlaceholderText('Filtrar currencies…');
    await userEvent.type(input, 'zzznotexist');

    await waitFor(() => {
      expect(screen.getByText(/Nenhuma currency encontrada/)).toBeInTheDocument();
    });
  });

  it('click on chip calls insertPoeCurrency with resolved iconUrl', async () => {
    const iconUrl = 'https://cdn.example.com/divine.png';
    mockResolveCurrencyIcon.mockResolvedValue(iconUrl);

    render(<SidePanelAssets />);

    const divineChip = screen.getByText('Divine Orb').closest('[role="button"]');
    expect(divineChip).not.toBeNull();

    await userEvent.click(divineChip!);

    // insertCurrency is async — wait for the icon fetch to resolve before asserting.
    await waitFor(() => {
      expect(mockInsertPoeCurrency).toHaveBeenCalledWith({
        currencyName: 'Divine Orb',
        iconUrl,
      });
    });
    expect(mockRun).toHaveBeenCalled();
  });

  it('click on chip inserts chip without iconUrl when engine returns null', async () => {
    // Engine is off — resolveCurrencyIcon returns null; chip falls back to ◈.
    mockResolveCurrencyIcon.mockResolvedValue(null);

    render(<SidePanelAssets />);

    const chaosChip = screen.getByText('Chaos Orb').closest('[role="button"]');
    await userEvent.click(chaosChip!);

    await waitFor(() => {
      expect(mockInsertPoeCurrency).toHaveBeenCalledWith({
        currencyName: 'Chaos Orb',
        iconUrl: undefined,
      });
    });
  });

  it('dragstart sets correct dataTransfer data', () => {
    render(<SidePanelAssets />);

    const chip = screen.getByText('Chaos Orb').closest('[draggable="true"]');
    expect(chip).not.toBeNull();

    const dataMap: Record<string, string> = {};
    const mockDataTransfer = {
      setData: (type: string, value: string) => { dataMap[type] = value; },
      effectAllowed: '',
    };

    fireEvent.dragStart(chip!, { dataTransfer: mockDataTransfer });

    expect(dataMap['application/poe-hub-currency']).toBeDefined();
    const parsed = JSON.parse(dataMap['application/poe-hub-currency']);
    expect(parsed.name).toBe('Chaos Orb');
  });

  it('shows count of visible vs total currencies', () => {
    render(<SidePanelAssets />);
    expect(screen.getByText(/3 de 3 disponíveis/)).toBeInTheDocument();
  });

  it('panel is collapsible — clicking header collapses content', async () => {
    render(<SidePanelAssets />);

    // Initially the collapsible is open (data-state="open")
    const collapsible = document.querySelector('[data-slot="collapsible"]');
    expect(collapsible).toHaveAttribute('data-state', 'open');

    const trigger = screen.getByText('Assets — Currencies').closest('button');
    await userEvent.click(trigger!);

    // After click, collapsible transitions to closed state
    // Radix sets data-state="closed" and adds hidden attribute on the content
    await waitFor(() => {
      expect(collapsible).toHaveAttribute('data-state', 'closed');
    });
  });
});
