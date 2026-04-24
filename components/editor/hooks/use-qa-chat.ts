'use client';
/**
 * Hook managing Q&A pane state for the blog editor.
 *
 * - Maintains message history with user/assistant roles.
 * - Persists messages to localStorage keyed by draftId so history
 *   survives page reloads for the same draft.
 * - History is cleared when draftId changes (new post or different draft).
 * - Calls `askQuestion()` from `lib/content-api` with optional language param.
 * - Supports retry: re-sends the question attached to a failed user message.
 *
 * @example
 * const { messages, send, retry, language, setLanguage, loading } = useQaChat({ draftId });
 */

import { useState, useEffect, useCallback } from 'react';
import { askQuestion } from '@/lib/content-api';

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
  language: QaLanguage;
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
// askQuestion wrapper — adapts to optional language param
// Content-api signature is `askQuestion(question: string)` — we send language
// via the body by calling the hub proxy endpoint directly to stay non-breaking.
// ---------------------------------------------------------------------------

interface AskResult {
  answer: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
}

async function askWithLanguage(question: string, language: QaLanguage): Promise<AskResult> {
  // `askQuestion` currently passes only `{ question }` in the body.
  // We extend by calling the same endpoint with language included.
  // The engine may ignore unknown fields — gracefully degrades.
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
  const [language, setLanguage] = useState<QaLanguage>('pt-br');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const result = await askWithLanguage(question, language);
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
    [language],
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

  return { messages, send, retry, language, setLanguage, loading, error };
}
