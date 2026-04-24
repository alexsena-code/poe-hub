// @vitest-environment jsdom
/**
 * Unit tests for useAutosave.
 *
 * Tests:
 *   - Does not call fetch before the 5s debounce elapses
 *   - Debounce resets when content changes (no intermediate calls)
 *   - Cancels in-flight request (AbortController) when new edit fires
 *   - Skips save when body is empty and title is blank
 *   - Sets status to 'error' on fetch failure
 *   - Sets status to 'saved' + updates lastSavedAt on success
 *
 * Session 08.e.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../use-autosave';
import type { EditorMetaForm } from '../../editor-meta-schema';
import type { JSONContent } from '@tiptap/core';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validMeta: EditorMetaForm = {
  title: 'Test post',
  metadata: 'A sufficiently long SEO description for testing purposes here.',
  slug: 'test-post',
  gameVersion: 'path-of-exile-1',
  categoryId: 'cat-1',
  authorId: 'auth-1',
  tags: ['test'],
  publishedAt: '2026-04-23T10:00:00.000Z',
  language: 'pt-br',
};

const bodyWithContent: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
};

const emptyBody: JSONContent = {
  type: 'doc',
  content: [],
};

const emptyMeta: EditorMetaForm = {
  ...validMeta,
  title: '',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  // Mock global fetch — the hook uses native fetch
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(): void {
  vi.mocked(globalThis.fetch).mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
}

function makeFetchFail(): void {
  vi.mocked(globalThis.fetch).mockResolvedValue(
    new Response(JSON.stringify({ error: 'server error' }), { status: 500 }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAutosave', () => {
  it('does not call fetch before 5s debounce elapses', async () => {
    makeFetchOk();
    renderHook(() =>
      useAutosave({
        draftId: 'draft-1',
        meta: validMeta,
        bodyJson: bodyWithContent,
        language: 'pt-br',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });

    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('calls fetch after 5s debounce', async () => {
    makeFetchOk();
    renderHook(() =>
      useAutosave({
        draftId: 'draft-1',
        meta: validMeta,
        bodyJson: bodyWithContent,
        language: 'pt-br',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5_001);
    });

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      '/api/sanity/draft/draft-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('skips save when body is empty and title is blank', async () => {
    makeFetchOk();
    renderHook(() =>
      useAutosave({
        draftId: 'draft-2',
        meta: emptyMeta,
        bodyJson: emptyBody,
        language: 'pt-br',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });

    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('resets debounce when deps change before 5s — no intermediate fetch', async () => {
    makeFetchOk();
    const { rerender } = renderHook(
      ({ body }: { body: JSONContent }) =>
        useAutosave({
          draftId: 'draft-3',
          meta: validMeta,
          bodyJson: body,
          language: 'pt-br',
        }),
      { initialProps: { body: bodyWithContent } },
    );

    // Change body at 3s — debounce should reset
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    rerender({
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Changed' }] }] },
    });

    // After another 3s (6s total from start, 3s from last change) — still below debounce
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();

    // Now wait full 5s from last change
    await act(async () => {
      vi.advanceTimersByTime(2_001);
    });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('sets status to saved and records lastSavedAt on success', async () => {
    makeFetchOk();
    const { result } = renderHook(() =>
      useAutosave({
        draftId: 'draft-4',
        meta: validMeta,
        bodyJson: bodyWithContent,
        language: 'pt-br',
      }),
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5_001);
    });
    // Allow promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('sets status to error on fetch failure', async () => {
    makeFetchFail();
    const { result } = renderHook(() =>
      useAutosave({
        draftId: 'draft-5',
        meta: validMeta,
        bodyJson: bodyWithContent,
        language: 'pt-br',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5_001);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
  });

  it('aborts in-flight request when new edit fires within debounce', async () => {
    // First fetch is slow — 6s response time
    const abortSpy = vi.fn();
    vi.mocked(globalThis.fetch).mockImplementation(
      (_url: RequestInfo | URL, opts?: RequestInit) => {
        // Track if signal is eventually aborted
        opts?.signal?.addEventListener('abort', abortSpy);
        // Return a slow response that won't resolve before abort
        return new Promise<Response>((resolve) => {
          setTimeout(() => resolve(new Response('{}', { status: 200 })), 10_000);
        });
      },
    );

    const { rerender } = renderHook(
      ({ body }: { body: JSONContent }) =>
        useAutosave({
          draftId: 'draft-6',
          meta: validMeta,
          bodyJson: body,
          language: 'pt-br',
        }),
      { initialProps: { body: bodyWithContent } },
    );

    // Trigger first save
    await act(async () => {
      vi.advanceTimersByTime(5_001);
    });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    // Change body — triggers new debounce → when it fires it should abort the first
    rerender({
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] },
    });

    await act(async () => {
      vi.advanceTimersByTime(5_001);
    });

    // abort should have been called on the first request's signal
    expect(abortSpy).toHaveBeenCalled();
    // fetch was called a second time (for the new save)
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });
});
