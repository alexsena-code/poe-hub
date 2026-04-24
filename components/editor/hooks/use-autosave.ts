'use client';
/**
 * Debounced autosave hook — persists the editor state as a Sanity draft
 * via PUT /api/sanity/draft/{draftId} every 5 seconds of inactivity.
 *
 * Design:
 * - AbortController cancels the in-flight request before starting a new one.
 *   This prevents the "last write wins" race when the operator types quickly.
 * - Skips saving when body is empty AND meta.title is blank — avoids spam
 *   creating empty drafts in Sanity on initial page load.
 * - Exposes `status` so the toolbar can show "salvo há Xs".
 *
 * Session 08.e.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';
import { tiptapToPortable } from '../serializer/tiptap-to-portable';
import type { TiptapDoc } from '../serializer/tiptap-to-portable';
import type { EditorMetaForm } from '../editor-meta-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions {
  draftId: string;
  meta: EditorMetaForm;
  bodyJson: JSONContent;
  language: 'pt-br' | 'en';
  /**
   * When false, skips all autosave attempts. Used while the editor is still
   * loading initial content so the empty Tiptap doc doesn't overwrite the
   * persisted body before portableToTiptap(initialBody) runs.
   */
  enabled?: boolean;
}

export interface UseAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the content is too empty to be worth saving. */
function isContentEmpty(bodyJson: JSONContent, meta: EditorMetaForm): boolean {
  const hasTitle = meta.title.trim().length > 0;
  const hasBody = (bodyJson.content?.length ?? 0) > 0;
  // At least one non-empty block required
  const hasNonEmptyBlock = bodyJson.content?.some(
    (node) => (node.content?.length ?? 0) > 0,
  ) ?? false;
  return !hasTitle && (!hasBody || !hasNonEmptyBlock);
}

/**
 * Assembles the PUT payload to send to /api/sanity/draft/{id}.
 *
 * Session 10.c: restructured to `{ meta, body }` so the route handler
 * receives editor-native field names (categoryId, authorId) and converts
 * them to Sanity references server-side. `language` stays at the top level
 * of `meta` and is always required for draft disambiguation.
 */
function buildDraftPayload(
  meta: EditorMetaForm,
  bodyJson: JSONContent,
  language: 'pt-br' | 'en',
): Record<string, unknown> {
  const body = tiptapToPortable(bodyJson as TiptapDoc);
  return {
    meta: {
      language,
      title: meta.title,
      metadata: meta.metadata,
      slug: meta.slug,
      gameVersion: meta.gameVersion,
      categoryId: meta.categoryId,
      authorId: meta.authorId,
      tags: meta.tags,
      mainImageAssetId: meta.mainImageAssetId,
      publishedAt: meta.publishedAt,
    },
    body,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Autosave hook. Usage:
 * ```ts
 * const { status, lastSavedAt } = useAutosave({ draftId, meta, bodyJson, language });
 * ```
 */
export function useAutosave({
  draftId,
  meta,
  bodyJson,
  language,
  enabled = true,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Track the in-flight abort controller so we can cancel if another save fires.
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(async () => {
    if (!enabled) return;
    if (isContentEmpty(bodyJson, meta)) return;

    // Cancel any previous in-flight request before starting a new one.
    abortRef.current?.abort('new-save-requested');
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('saving');
    try {
      const payload = buildDraftPayload(meta, bodyJson, language);
      const res = await fetch(`/api/sanity/draft/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`autosave PUT failed: ${res.status} ${text}`);
      }

      setStatus('saved');
      setLastSavedAt(new Date());
    } catch (err: unknown) {
      // Ignore AbortError — it means a newer save superseded this one.
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      console.error('[autosave] save failed:', err instanceof Error ? err.message : err);
      setStatus('error');
    }
  }, [draftId, meta, bodyJson, language]);

  // Restart the debounce timer whenever content changes.
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (!enabled) return;
    // Reset to idle while the operator is still typing.
    if (status === 'saved') setStatus('idle');

    timerRef.current = setTimeout(() => {
      performSave().catch(console.error);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, meta, bodyJson, language, enabled]);

  // Abort in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort('unmount');
    };
  }, []);

  return { status, lastSavedAt };
}
