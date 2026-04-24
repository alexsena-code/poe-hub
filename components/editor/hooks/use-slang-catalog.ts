'use client';
/**
 * SWR-backed hook for approved PoE slang terms.
 *
 * Fetches `/api/engine/slang?status=approved&limit=1000` once per session
 * through the existing catch-all engine proxy (app/api/engine/[...path]/route.ts).
 *
 * Expected response shape from the engine:
 *   `{ items: Array<{ id: number; term: string; definition: string | null; category: string | null }> }`
 *
 * @example
 * const { terms, isLoading, error } = useSlangCatalog();
 * const filtered = filterSlangTerms(terms, 'chaos');
 */

import useSWR from 'swr';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlangTerm {
  id: number;
  term: string;
  definition: string | null;
  category: string | null;
}

export interface UseSlangCatalogResult {
  terms: SlangTerm[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

interface SlangApiResponse {
  items: SlangTerm[];
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchApprovedSlang(url: string): Promise<SlangTerm[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[use-slang-catalog] fetch failed: ${res.status} ${res.statusText}`);
  }
  const data: SlangApiResponse = await res.json();
  if (!Array.isArray(data?.items)) {
    throw new Error(
      `[use-slang-catalog] unexpected response shape: ${JSON.stringify(data).slice(0, 120)}`,
    );
  }
  return data.items;
}

// ─── Filter helper ────────────────────────────────────────────────────────────

/**
 * Case-insensitive substring filter matching term OR definition.
 *
 * @example
 * filterSlangTerms(terms, 'divine') // terms where 'divine' appears in term or definition
 */
export function filterSlangTerms(terms: SlangTerm[], query: string): SlangTerm[] {
  if (!query.trim()) return terms;
  const q = query.toLowerCase();
  return terms.filter(
    (t) =>
      t.term.toLowerCase().includes(q) ||
      (t.definition?.toLowerCase().includes(q) ?? false),
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const FETCH_KEY = '/api/engine/slang?status=approved&limit=1000';

export function useSlangCatalog(): UseSlangCatalogResult {
  const { data, error, isLoading, mutate } = useSWR<SlangTerm[], Error>(
    FETCH_KEY,
    fetchApprovedSlang,
    {
      // Slang list changes rarely during an editing session — suppress background revalidation.
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
    },
  );

  return {
    terms: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
