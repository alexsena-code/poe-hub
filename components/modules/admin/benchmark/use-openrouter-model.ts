'use client';
/**
 * SWR-backed hook for fetching a single OpenRouter model's pricing info.
 *
 * Routes through the hub's proxy route (/api/openrouter/models/[...id]) so
 * the upstream OpenRouter response is cached server-side for 5 minutes —
 * avoids CORS issues and prevents hammering OpenRouter on every keystroke in
 * the benchmark form's model selector.
 *
 * @example
 * const { model, isLoading, error } = useOpenRouterModel('moonshotai/kimi-k2-thinking');
 */
import useSWR from 'swr';
import type { OpenRouterModelInfo } from '@/app/api/openrouter/models/[...id]/route';

// Re-export so consumers can type the model without importing from the route.
export type { OpenRouterModelInfo };

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchModel(url: string): Promise<OpenRouterModelInfo> {
  const res = await fetch(url);
  if (res.status === 404) {
    // Propagate 404 as a typed null signal — the component renders "not found".
    throw new Error('NOT_FOUND');
  }
  if (!res.ok) {
    throw new Error(
      `[use-openrouter-model] fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<OpenRouterModelInfo>;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseOpenRouterModelResult {
  model: OpenRouterModelInfo | null;
  isLoading: boolean;
  error: Error | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOpenRouterModel(id: string | null): UseOpenRouterModelResult {
  // Null/empty id → return stable no-op so the card renders nothing.
  const key = id ? `/api/openrouter/models/${id}` : null;

  const { data, error, isLoading } = useSWR<OpenRouterModelInfo, Error>(
    key,
    fetchModel,
    {
      revalidateOnFocus: false,
      // Mirror the server-side 5-minute cache so dedupe interval matches.
      dedupingInterval: 5 * 60_000,
    },
  );

  return {
    model: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
