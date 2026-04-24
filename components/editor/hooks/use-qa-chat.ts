'use client';
/**
 * Hook managing Q&A pane state for the blog editor.
 *
 * - Maintains message history with user/assistant roles.
 * - Persists messages to localStorage keyed by draftId so history
 *   survives page reloads for the same draft.
 * - History is cleared when draftId changes (new post or different draft).
 * - Calls the hub's engine proxy endpoint with the current editor language.
 * - Supports retry: re-sends the question attached to a failed user message.
 *
 * Session 10.c: removed local `language` state — now derived from
 * `useEditorContext().meta.language` so Q&A always tracks the post's language
 * without an extra toggle. `setLanguage` is kept in the return type for
 * backward compatibility but is now a no-op (callers should update meta.language
 * via the sidebar instead).
 *
 * @example
 * const { messages, send, retry, loading } = useQaChat({ draftId });
 */

import { useState, useEffect, useCallback } from 'react';
import { useEditorContext } from '../editor-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QaLanguage = 'pt-br' | 'en';

export interface QaMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Approximate USD cost (inputTokens + outputTokens) — present only on assistant messages */
  cost?: number;
  /** True when the corresponding assistant call failed for this user turn */
  error?: boolean;
  /** Original question text stored on errored user messages so retry can re-send */
  question?: string;
}

export interface UseQaChatOptions {
  /** Draft document ID — used as localStorage key suffix */
  draftId: string;
}

export interface UseQaChatResult {
  messages: QaMessage[];
  send: (question: string) => Promise<void>;
  /** Re-sends the question at the given index (must be an errored user message) */
  retry: (index: number) => Promise<void>;
  /**
   * @deprecated Language is now controlled by meta.language in EditorContext.
   * This field is kept for backward compatibility — it always reflects
   * the editor's current language.
   */
  language: QaLanguage;
  /**
   * @deprecated No-op since session 10.c. Update meta.language via the
   * editor sidebar to change the Q&A language.
   */
  setLanguage: (lang: QaLanguage) => void;
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function storageKey(draftId: string): string {
  return `pot-qa-history-${draftId}`;
}

function loadPersistedMessages(draftId: string): QaMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (!raw) return [];
    return JSON.parse(raw) as QaMessage[];
  } catch {
    return [];
  }
}

function persistMessages(draftId: string, messages: QaMessage[]): void {
  try {
    localStorage.setItem(storageKey(draftId), JSON.stringify(messages));
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

// ---------------------------------------------------------------------------
// Engine call
// ---------------------------------------------------------------------------

interface AskResult {
  answer: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
}

async function askWithLanguage(question: string, language: QaLanguage): Promise<AskResult> {
  // `askQuestion` from content-api currently passes only `{ question }` in the body.
  // We call the hub proxy directly so we can include `language` — the engine
  // may ignore unknown fields, which gracefully degrades to language-agnostic answers.
  const res = await fetch('/api/engine/knowledge/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, language }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[use-qa-chat] engine answered ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function computeCost(result: AskResult): number | undefined {
  if (result.cost !== undefined) return result.cost;
  // Rough estimate: $0.002 per 1k tokens (blended gpt-4o-mini rate)
  const tokens = (result.inputTokens ?? 0) + (result.outputTokens ?? 0);
  return tokens > 0 ? tokens * 0.000002 : undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQaChat({ draftId }: UseQaChatOptions): UseQaChatResult {
  const [messages, setMessages] = useState<QaMessage[]>(() =>
    loadPersistedMessages(draftId),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive language from the editor context — single source of truth.
  const { meta } = useEditorContext();
  const editorLanguage: QaLanguage = meta.language;

  // When draftId changes, reload persisted history for the new draft.
  useEffect(() => {
    setMessages(loadPersistedMessages(draftId));
  }, [draftId]);

  // Persist whenever messages change.
  useEffect(() => {
    persistMessages(draftId, messages);
  }, [draftId, messages]);

  const runQuestion = useCallback(
    async (question: string, replaceIndex?: number) => {
      setLoading(true);
      setError(null);

      // Insert the user message immediately (or mark it at replaceIndex).
      const userMsg: QaMessage = { role: 'user', content: question, question };

      setMessages((prev) => {
        if (replaceIndex !== undefined) {
          const updated = [...prev];
          updated[replaceIndex] = userMsg;
          return updated;
        }
        return [...prev, userMsg];
      });

      try {
        const result = await askWithLanguage(question, editorLanguage);
        const assistantMsg: QaMessage = {
          role: 'assistant',
          content: result.answer ?? '',
          cost: computeCost(result),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        // Mark the user message as errored so the UI can show retry.
        setMessages((prev) => {
          const updated = [...prev];
          const targetIdx = replaceIndex !== undefined ? replaceIndex : updated.length - 1;
          updated[targetIdx] = { ...updated[targetIdx], error: true };
          return updated;
        });
      } finally {
        setLoading(false);
      }
    },
    [editorLanguage],
  );

  const send = useCallback(
    (question: string) => runQuestion(question),
    [runQuestion],
  );

  const retry = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (!msg || msg.role !== 'user' || !msg.question) return Promise.resolve();
      return runQuestion(msg.question, index);
    },
    [messages, runQuestion],
  );

  // `setLanguage` is kept as a no-op for backward compatibility.
  // Consumers should update meta.language via the editor sidebar instead.
  const setLanguage = useCallback((_lang: QaLanguage): void => {
    // no-op: language is controlled by EditorContext.meta.language
  }, []);

  return { messages, send, retry, language: editorLanguage, setLanguage, loading, error };
}
