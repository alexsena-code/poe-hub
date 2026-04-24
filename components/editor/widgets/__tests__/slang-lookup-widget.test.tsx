// @vitest-environment jsdom
/**
 * Tests for SlangLookupWidget.
 *
 * Validates:
 * 1. Renders term list from useSlangCatalog.
 * 2. Search filter narrows results (term and definition).
 * 3. Click on a term calls editor.chain().focus().insertContent().run().
 * 4. Loading state renders spinner.
 * 5. Error state renders error message.
 * 6. Empty state renders when no approved slang.
 */

/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const mockInsertContent = vi.fn().mockReturnValue(true);
const mockRun = vi.fn().mockReturnValue(true);

const fakeEditor = {
  chain: () => ({
    focus: () => ({
      insertContent: (text: string) => {
        mockInsertContent(text);
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

let mockTerms: { id: number; term: string; definition: string | null; category: string | null }[] = [
  { id: 1, term: 'GGG', definition: 'Grinding Gear Games — developer of PoE.', category: 'general' },
  { id: 2, term: 'TFT', definition: 'The Forbidden Trove — trading Discord.', category: 'trade' },
  { id: 3, term: 'ED/Contagion', definition: null, category: 'builds' },
];
let mockIsLoading = false;
let mockError: Error | null = null;

vi.mock('@/components/editor/hooks/use-slang-catalog', () => ({
  useSlangCatalog: () => ({
    terms: mockTerms,
    isLoading: mockIsLoading,
    error: mockError,
    refresh: vi.fn(),
  }),
  filterSlangTerms: (
    terms: typeof mockTerms,
    query: string,
  ) => {
    if (!query.trim()) return terms;
    const q = query.toLowerCase();
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        (t.definition?.toLowerCase().includes(q) ?? false),
    );
  },
}));

// WidgetShell renders children inside Accordion — stub it to render children directly
vi.mock('../widget-shell', () => ({
  WidgetShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SlangLookupWidget } from '../slang-lookup-widget';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockTerms = [
    { id: 1, term: 'GGG', definition: 'Grinding Gear Games — developer of PoE.', category: 'general' },
    { id: 2, term: 'TFT', definition: 'The Forbidden Trove — trading Discord.', category: 'trade' },
    { id: 3, term: 'ED/Contagion', definition: null, category: 'builds' },
  ];
  mockIsLoading = false;
  mockError = null;
  mockInsertContent.mockClear();
  mockRun.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SlangLookupWidget', () => {
  it('renders term list from catalog', () => {
    render(<SlangLookupWidget />);
    expect(screen.getByText('GGG')).toBeInTheDocument();
    expect(screen.getByText('TFT')).toBeInTheDocument();
    expect(screen.getByText('ED/Contagion')).toBeInTheDocument();
  });

  it('renders loading spinner when isLoading', () => {
    mockIsLoading = true;
    mockTerms = [];
    render(<SlangLookupWidget />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error message when error is set', () => {
    mockError = new Error('engine offline');
    mockTerms = [];
    render(<SlangLookupWidget />);
    expect(screen.getByText(/Falha ao carregar slang/)).toBeInTheDocument();
    expect(screen.getByText(/engine offline/)).toBeInTheDocument();
  });

  it('renders empty state when no terms available', () => {
    mockTerms = [];
    render(<SlangLookupWidget />);
    expect(screen.getByText(/Nenhum slang aprovado disponível/)).toBeInTheDocument();
  });

  it('filters by term text', async () => {
    render(<SlangLookupWidget />);
    const input = screen.getByPlaceholderText('Buscar slang aprovado…');
    await userEvent.type(input, 'GGG');
    await waitFor(() => {
      expect(screen.getByText('GGG')).toBeInTheDocument();
      expect(screen.queryByText('TFT')).not.toBeInTheDocument();
    });
  });

  it('filters by definition text', async () => {
    render(<SlangLookupWidget />);
    const input = screen.getByPlaceholderText('Buscar slang aprovado…');
    await userEvent.type(input, 'trading');
    await waitFor(() => {
      expect(screen.getByText('TFT')).toBeInTheDocument();
      expect(screen.queryByText('GGG')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when filter matches nothing', async () => {
    render(<SlangLookupWidget />);
    const input = screen.getByPlaceholderText('Buscar slang aprovado…');
    await userEvent.type(input, 'zzznomatch');
    await waitFor(() => {
      expect(screen.getByText(/Nenhum slang aprovado encontrado/)).toBeInTheDocument();
    });
  });

  it('click on term calls editor.insertContent with the term text', async () => {
    render(<SlangLookupWidget />);
    const termButton = screen.getByText('GGG').closest('button');
    expect(termButton).not.toBeNull();
    await userEvent.click(termButton!);
    expect(mockInsertContent).toHaveBeenCalledWith('GGG');
    expect(mockRun).toHaveBeenCalled();
  });
});
