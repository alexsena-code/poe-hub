'use client';
/**
 * SWR-backed hook for the hub editor's item side-panel.
 *
 * Fetches `/api/engine/items/list` through the existing catch-all engine
 * proxy (app/api/engine/[...path]/route.ts). The engine endpoint — added
 * alongside `/api/items/currencies` and `/api/items/:name/raw` in the
 * session-12 carryover sweep — returns a paginated list bucketed by
 * `kind` (currency / gem / unique / active_gem / support_gem / all).
 *
 * @example
 * const { items, isLoading } = useItemsCatalog({ kind: 'unique', q: 'mage' });
 */
import useSWR from 'swr';

// ─── Types (mirror engine ItemListResult) ─────────────────────────────────────

export type ItemCatalogKind =
  | 'all'
  | 'currency'
  | 'gem'
  | 'unique'
  | 'active_gem'
  | 'support_gem';

export interface ItemCatalogEntry {
  name: string;
  classId: string;
  rarity: string | null;
  baseItem: string | null;
  iconUrl: string | null;
  isGem: boolean;
  gemTags: string[];
  isSupportGem: boolean;
}

interface ItemCatalogResponse {
  total: number;
  items: ItemCatalogEntry[];
}

export interface UseItemsCatalogOptions {
  kind: ItemCatalogKind;
  q?: string;
  limit?: number;
}

export interface UseItemsCatalogResult {
  items: ItemCatalogEntry[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchItems(url: string): Promise<ItemCatalogResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[use-items-catalog] fetch failed: ${res.status} ${res.statusText}`);
  }
  const data: ItemCatalogResponse = await res.json();
  if (!Array.isArray(data?.items)) {
    throw new Error(
      `[use-items-catalog] unexpected response shape: ${JSON.stringify(data).slice(0, 120)}`,
    );
  }
  return data;
}

// ─── Key builder ──────────────────────────────────────────────────────────────

function buildKey({ kind, q, limit }: UseItemsCatalogOptions): string {
  const params = new URLSearchParams();
  params.set('kind', kind);
  if (q && q.trim()) params.set('q', q.trim());
  params.set('limit', String(limit ?? 100));
  return `/api/engine/items/list?${params.toString()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useItemsCatalog(
  options: UseItemsCatalogOptions,
): UseItemsCatalogResult {
  const { data, error, isLoading, mutate } = useSWR<ItemCatalogResponse, Error>(
    buildKey(options),
    fetchItems,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
