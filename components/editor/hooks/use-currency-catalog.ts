'use client';
/**
 * SWR-backed hook for the PoE currency catalog.
 *
 * Fetches `/api/engine/items/currencies` once per session (60s dedup)
 * through the existing catch-all engine proxy (`app/api/engine/[...path]/route.ts`).
 *
 * Expected response shape from the engine:
 *   `{ names: string[] }` — flat list of currency names like "Divine Orb".
 *
 * @example
 * const { currencies, isLoading, error } = useCurrencyCatalog();
 * const filtered = filterCurrencies(currencies, 'divine');
 */

import useSWR from 'swr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCurrencyCatalogResult {
  currencies: string[];
  isLoading: boolean;
  error: Error | null;
  /** Force re-fetch (e.g. pull-to-refresh on mobile) */
  refresh: () => void;
}

interface CurrencyCatalogResponse {
  names: string[];
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchCurrencyCatalog(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[use-currency-catalog] fetch failed: ${res.status} ${res.statusText}`);
  }
  const data: CurrencyCatalogResponse = await res.json();
  if (!Array.isArray(data?.names)) {
    throw new Error(
      `[use-currency-catalog] unexpected response shape: ${JSON.stringify(data).slice(0, 120)}`,
    );
  }
  return data.names;
}

// ---------------------------------------------------------------------------
// Public filter helper — exported so components can call it without coupling
// to any state management detail.
// ---------------------------------------------------------------------------

/**
 * Case-insensitive substring filter for the currency list.
 *
 * @example
 * filterCurrencies(['Divine Orb', 'Chaos Orb'], 'div') // ['Divine Orb']
 */
export function filterCurrencies(currencies: string[], query: string): string[] {
  if (!query.trim()) return currencies;
  const q = query.toLowerCase();
  return currencies.filter((name) => name.toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const FETCH_KEY = '/api/engine/items/currencies';

export function useCurrencyCatalog(): UseCurrencyCatalogResult {
  const { data, error, isLoading, mutate } = useSWR<string[], Error>(
    FETCH_KEY,
    fetchCurrencyCatalog,
    {
      // Currency list changes very rarely — suppress background revalidation.
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    currencies: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
