// @vitest-environment jsdom
/**
 * Tests for use-qa-chat hook.
 *
 * Validates:
 * 1. send() appends user + assistant messages
 * 2. send() on engine failure marks user message as error
 * 3. retry() re-sends the question and clears error flag
 * 4. messages persist to localStorage and reload on remount
 * 5. language is derived from EditorContext (not local state)
 * 6. fetch is called with the context language in the body
 *
 * Session 10.c: adapted to mock useEditorContext() after the local language
 * state was removed and replaced with EditorContext.meta.language.
 *
 * Mocks /api/engine/knowledge/answer fetch directly (the hook calls
 * fetch, not askQuestion from content-api, so we mock global.fetch).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQaChat } from '../use-qa-chat';

// ---------------------------------------------------------------------------
// Mock useEditorContext
// ---------------------------------------------------------------------------

// Default language returned by the context mock — tests can override.
let contextLanguage: 'pt-br' | 'en' = 'pt-br';

vi.mock('../../editor-context', () => ({
  useEditorContext: () => ({
    editor: null,
    meta: { language: contextLanguage },
    setMeta: vi.fn(),
    draftId: 'context-draft-id',
    language: contextLanguage,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DRAFT_ID = 'test-draft-123';
const STORAGE_KEY = `pot-qa-history-${DRAFT_ID}`;

function mockFetchSuccess(answer: string, cost = 0.002) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ answer, cost }),
  } as unknown as Response);
}

function mockFetchError(status = 500) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    text: async () => 'engine exploded',
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  contextLanguage = 'pt-br';
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useQaChat', () => {
  it('starts with empty messages', () => {
    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('send() appends user message immediately then assistant message on success', async () => {
    mockFetchSuccess('The answer is 42.');

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      result.current.send('What is the meaning?');
    });

    // User message should appear immediately
    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
    });
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('What is the meaning?');

    // Wait for assistant message
    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    const assistant = result.current.messages[1];
    expect(assistant.role).toBe('assistant');
    expect(assistant.content).toBe('The answer is 42.');
    expect(assistant.cost).toBe(0.002);
    expect(result.current.loading).toBe(false);
  });

  it('send() marks user message as error when fetch fails', async () => {
    mockFetchError(500);

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      result.current.send('Will this fail?');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].error).toBe(true);
    expect(result.current.error).not.toBeNull();
  });

  it('retry() re-sends the question at the errored index', async () => {
    // First call fails, second succeeds
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'down',
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Recovered answer', cost: 0.001 }),
      } as unknown as Response);

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      result.current.send('Will this recover?');
    });

    // Wait for the error state
    await waitFor(() => {
      expect(result.current.messages[0]?.error).toBe(true);
    });

    // Retry
    act(() => {
      result.current.retry(0);
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    expect(result.current.messages[0].error).toBeFalsy();
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Recovered answer');
  });

  it('messages persist to localStorage after send', async () => {
    mockFetchSuccess('Persisted answer');

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      result.current.send('Remember this?');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0].content).toBe('Remember this?');
    expect(stored[1].content).toBe('Persisted answer');
  });

  it('loads persisted messages from localStorage on mount', () => {
    const existing = [
      { role: 'user', content: 'Old question', question: 'Old question' },
      { role: 'assistant', content: 'Old answer', cost: 0.001 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Old question');
    expect(result.current.messages[1].content).toBe('Old answer');
  });

  it('reloads history when draftId changes', async () => {
    const other = [{ role: 'assistant', content: 'Other draft', question: undefined }];
    localStorage.setItem('pot-qa-history-other-draft', JSON.stringify(other));

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useQaChat({ draftId: id }),
      { initialProps: { id: DRAFT_ID } },
    );
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'other-draft' });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
    expect(result.current.messages[0].content).toBe('Other draft');
  });

  it('language reflects EditorContext.meta.language (pt-br by default)', () => {
    contextLanguage = 'pt-br';
    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));
    expect(result.current.language).toBe('pt-br');
  });

  it('language reflects EditorContext.meta.language when set to en', () => {
    contextLanguage = 'en';
    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));
    expect(result.current.language).toBe('en');
  });

  it('fetch is called with language from EditorContext in the body', async () => {
    contextLanguage = 'en';

    const spy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', cost: 0 }),
    } as unknown as Response);
    global.fetch = spy;

    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      result.current.send('Test language param');
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    expect(spy).toHaveBeenCalledOnce();
    const callArgs = spy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.language).toBe('en');
    expect(body.question).toBe('Test language param');
  });

  it('setLanguage is a backward-compat no-op and does not change the language', () => {
    contextLanguage = 'pt-br';
    const { result } = renderHook(() => useQaChat({ draftId: DRAFT_ID }));

    act(() => {
      // This used to change state; now it's a no-op since language comes from context.
      result.current.setLanguage('en');
    });

    // Language should still be what the context says (pt-br), not 'en'.
    expect(result.current.language).toBe('pt-br');
  });
});
