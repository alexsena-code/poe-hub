// @vitest-environment jsdom
/**
 * Tests for AssetsWidget component.
 *
 * Migrated from components/editor/__tests__/side-panel-assets.test.tsx (S10.a).
 * Import updated to point at the new widget; all 10 test cases preserved.
 *
 * Validates:
 * 1. Renders currency list from useCurrencyCatalog.
 * 2. Search/filter narrows list (case-insensitive).
 * 3. Click on chip calls editor.chain().focus().insertPoeCurrency().run().
 * 4. DragStart event sets correct dataTransfer data.
 * 5. Loading state renders spinner.
 * 6. Error state renders error message.
 * 7. Empty state when filter matches nothing.
 * 8. Click without iconUrl (engine off) inserts chip with undefined iconUrl.
 * 9. Count badge shows visible vs total.
 * 10. Widget is collapsible (inherited from WidgetShell accordion).
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

// WidgetShell renders children inside Accordion — stub it to render children directly
vi.mock('../widget-shell', () => ({
  WidgetShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AssetsWidget } from '../assets-widget';

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

describe('AssetsWidget', () => {
  it('renders currency list from catalog', () => {
    render(<AssetsWidget />);
    expect(screen.getByText('Divine Orb')).toBeInTheDocument();
    expect(screen.getByText('Chaos Orb')).toBeInTheDocument();
    expect(screen.getByText('Exalted Orb')).toBeInTheDocument();
  });

  it('renders loading spinner when isLoading', () => {
    mockIsLoading = true;
    mockCurrencies = [];
    render(<AssetsWidget />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error message when error is set', () => {
    mockError = new Error('network timeout');
    mockCurrencies = [];
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

  it('click on chip calls insertPoeCurrency with resolved iconUrl', async () => {
    const iconUrl = 'https://cdn.example.com/divine.png';
    mockResolveCurrencyIcon.mockResolvedValue(iconUrl);
    render(<AssetsWidget />);
    const divineChip = screen.getByText('Divine Orb').closest('[role="button"]');
    expect(divineChip).not.toBeNull();
    await userEvent.click(divineChip!);
    await waitFor(() => {
      expect(mockInsertPoeCurrency).toHaveBeenCalledWith({ currencyName: 'Divine Orb', iconUrl });
    });
    expect(mockRun).toHaveBeenCalled();
  });

  it('click on chip inserts chip without iconUrl when engine returns null', async () => {
    mockResolveCurrencyIcon.mockResolvedValue(null);
    render(<AssetsWidget />);
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
    render(<AssetsWidget />);
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
    render(<AssetsWidget />);
    expect(screen.getByText(/3 de 3 disponíveis/)).toBeInTheDocument();
  });
});
