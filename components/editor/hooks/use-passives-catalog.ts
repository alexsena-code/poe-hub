'use client';
/**
 * SWR-backed hook for passive-tree entries — powers the hub editor's
 * side-panel passive tab.
 *
 * Proxies `/api/engine/tools/passives` (GET), the existing PassiveToolsController
 * endpoint. Response shape: `{ count, results: TrimmedPassive[] }`.
 * We flatten to a simple `passives` array for UI consumption.
 *
 * Search: the engine also exposes `/api/engine/tools/passives/search?q=...`,
 * but stats-text search isn't what the side-panel operator usually wants
 * (they're picking by name). We keep client-side name filtering here and
 * hit the `search` endpoint only when the operator explicitly asks.
 */
import useSWR from 'swr';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PassiveKind =
  | 'normal'
  | 'notable'
  | 'keystone'
  | 'ascendancy_small'
  | 'ascendancy_notable'
  | 'mastery'
  | 'jewel_socket';

export interface PassiveEntry {
  id: string;
  name: string;
  kind: PassiveKind;
  ascendancyClass: string | null;
  stats: string[];
  flavourText: string | null;
  isAtlasPassive: boolean;
  patchVersion: string;
}

interface PassiveListResponse {
  count: number;
  results: PassiveEntry[];
}

export interface UsePassivesCatalogOptions {
  kind?: PassiveKind;
  limit?: number;
}

export interface UsePassivesCatalogResult {
  passives: PassiveEntry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchPassives(url: string): Promise<PassiveListResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[use-passives-catalog] fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  const data: PassiveListResponse = await res.json();
  if (!Array.isArray(data?.results)) {
    throw new Error(
      `[use-passives-catalog] unexpected response shape: ${JSON.stringify(data).slice(0, 120)}`,
    );
  }
  return data;
}

// ─── Filter helper ────────────────────────────────────────────────────────────

export function filterPassives(passives: PassiveEntry[], query: string): PassiveEntry[] {
  if (!query.trim()) return passives;
  const q = query.toLowerCase();
  return passives.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.stats.some((s) => s.toLowerCase().includes(q)),
  );
}

// ─── Key builder ──────────────────────────────────────────────────────────────

function buildKey({ kind, limit }: UsePassivesCatalogOptions): string {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  params.set('limit', String(limit ?? 500));
  return `/api/engine/tools/passives?${params.toString()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePassivesCatalog(
  options: UsePassivesCatalogOptions = {},
): UsePassivesCatalogResult {
  const { data, error, isLoading, mutate } = useSWR<PassiveListResponse, Error>(
    buildKey(options),
    fetchPassives,
    {
      // Passive tree only changes with patches — stale data is fine inside a session.
      revalidateOnFocus: false,
      dedupingInterval: 10 * 60_000,
    },
  );

  return {
    passives: data?.results ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
