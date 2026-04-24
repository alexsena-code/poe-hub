/**
 * Fetch helpers for the preview resolver.
 *
 * Each helper calls the hub's engine proxy routes (/api/engine/...) rather
 * than the engine directly, so the operator's session cookie is forwarded
 * automatically. These are fail-soft: they return null on any error path
 * instead of throwing, so the resolver degrades gracefully to literal
 * placeholder text.
 *
 * The catch-all route at app/api/engine/[...path]/route.ts covers every
 * engine path — no dedicated route needed per endpoint.
 *
 * Session 08.d — preview resolver port from poetrade-dev.
 */

import type { ItemRawData, PriceData, PriceMap, PassiveData, PobItemData } from "./types";

const ITEM_TIMEOUT_MS = 3000;
const PRICE_TIMEOUT_MS = 4000;
const PASSIVE_TIMEOUT_MS = 3000;
const POB_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

/**
 * Returns the base URL for calling our own proxy routes.
 * On the server we need an absolute URL; on the client a relative path works.
 */
function getProxyBase(): string {
  if (typeof window !== "undefined") return "";
  // Server context: construct absolute URL from env or default to localhost
  const origin =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return origin.replace(/\/$/, "");
}

function proxyUrl(path: string): string {
  return `${getProxyBase()}/api/engine${path}`;
}

// ---------------------------------------------------------------------------
// Item raw fetch
// ---------------------------------------------------------------------------

/**
 * Fetch raw item data (rawText + icon + metadata) from the engine via proxy.
 *
 * @example
 * const item = await fetchItemRaw("Divine Orb");
 * // → { rawText: "...", iconUrl: "...", name: "Divine Orb", ... }
 */
export async function fetchItemRaw(name: string): Promise<ItemRawData | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const url = proxyUrl(`/items/${encodeURIComponent(trimmed)}/raw`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ITEM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[preview] fetchItemRaw "${trimmed}" failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as ItemRawData;
    if (!data?.rawText) return null;
    return data;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn(`[preview] fetchItemRaw "${trimmed}" error: ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Batch-fetch item raw data for multiple names in parallel.
 * Returns a map keyed by lowercase item name.
 */
export async function fetchItemRawMany(
  names: string[],
): Promise<Record<string, ItemRawData>> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!unique.length) return {};

  const entries = await Promise.all(
    unique.map(async (n) => [n, await fetchItemRaw(n)] as const),
  );
  const out: Record<string, ItemRawData> = {};
  for (const [n, data] of entries) {
    if (data) out[n.toLowerCase()] = data;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Price fetch
// ---------------------------------------------------------------------------

/**
 * Batch-fetch price data from the engine's ninja/lookup proxy endpoint.
 * Falls back to an empty map on failure (fail-soft).
 *
 * @example
 * const prices = await fetchPrices(["Divine Orb", "Chaos Orb"], "Settlers");
 * // → { "divine orb": { chaos: 215, divine: 1, ... }, ... }
 */
export async function fetchPrices(
  names: string[],
  league: string,
): Promise<PriceMap> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!unique.length) return {};

  const url = proxyUrl(
    `/ninja/lookup?names=${encodeURIComponent(unique.join(","))}&league=${encodeURIComponent(league)}&game=poe1`,
  );
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PRICE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) {
      console.warn(`[preview] fetchPrices failed: ${res.status}`);
      return {};
    }
    const data = await res.json();
    const items = (data?.items ?? {}) as Record<string, unknown>;
    const out: PriceMap = {};
    for (const [name, item] of Object.entries(items)) {
      const i = item as Record<string, unknown>;
      out[name.toLowerCase()] = {
        name,
        chaos: Number(i?.chaosValue ?? 0),
        divine: Number(i?.divineValue ?? 0),
        listingCount: Number(i?.listingCount ?? 0),
        icon: typeof i?.icon === "string" ? i.icon : null,
        category: typeof i?.category === "string" ? i.category : undefined,
      };
    }
    return out;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn(`[preview] fetchPrices error: ${(err as Error).message}`);
    }
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Passive raw fetch
// ---------------------------------------------------------------------------

/**
 * Fetch raw passive skill node data from the engine via proxy.
 * Returns null when the engine doesn't know the passive name.
 */
export async function fetchPassiveRaw(name: string): Promise<PassiveData | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const url = proxyUrl(`/passives/${encodeURIComponent(trimmed)}/raw`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PASSIVE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[preview] fetchPassiveRaw "${trimmed}" failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as PassiveData;
    if (!data?.rawText) return null;
    return data;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn(`[preview] fetchPassiveRaw "${trimmed}" error: ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Batch-fetch passive data for multiple names in parallel.
 * Returns a Map keyed by lowercase passive name.
 */
export async function fetchPassiveRawMany(
  names: string[],
): Promise<Map<string, PassiveData>> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const out = new Map<string, PassiveData>();
  if (!unique.length) return out;

  const entries = await Promise.all(
    unique.map(async (n) => [n, await fetchPassiveRaw(n)] as const),
  );
  for (const [n, data] of entries) {
    if (data) out.set(n.toLowerCase(), data);
  }
  return out;
}

// ---------------------------------------------------------------------------
// PoB item raw fetch
// ---------------------------------------------------------------------------

/**
 * Fetch raw PoB snapshot item data from the engine via proxy.
 * The `id` is a cuid — the engine looks up the exact item snapshot.
 */
export async function fetchPobItemRaw(id: string): Promise<PobItemData | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;

  const url = proxyUrl(`/pob/items/${encodeURIComponent(trimmed)}/raw`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), POB_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[preview] fetchPobItemRaw "${trimmed}" failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as PobItemData;
    if (!data?.rawText) return null;
    return data;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn(`[preview] fetchPobItemRaw "${trimmed}" error: ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Batch-fetch PoB snapshot items for multiple IDs in parallel.
 * Returns a map keyed by the original (non-lowercased) ID.
 */
export async function fetchPobItemRawMany(
  ids: string[],
): Promise<Record<string, PobItemData>> {
  const unique = Array.from(new Set(ids.map((n) => n.trim()).filter(Boolean)));
  if (!unique.length) return {};

  const entries = await Promise.all(
    unique.map(async (id) => [id, await fetchPobItemRaw(id)] as const),
  );
  const out: Record<string, PobItemData> = {};
  for (const [id, data] of entries) {
    if (data) out[id] = data;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Currency name catalog
// ---------------------------------------------------------------------------

/**
 * Minimal built-in fallback for currency promotion.
 * Used when the engine is unreachable — keeps top ~30 names working.
 * Do NOT grow this; extend the engine DB instead.
 */
const FALLBACK_CURRENCY_NAMES: readonly string[] = Object.freeze([
  "Mirror of Kalandra",
  "Divine Orb",
  "Exalted Orb",
  "Chaos Orb",
  "Awakened Sextant",
  "Orb of Annulment",
  "Orb of Alchemy",
  "Orb of Fusing",
  "Orb of Scouring",
  "Orb of Regret",
  "Orb of Chance",
  "Vaal Orb",
  "Regal Orb",
  "Blessed Orb",
  "Cartographer's Chisel",
  "Gemcutter's Prism",
  "Eternal Orb",
  "Jeweller's Orb",
  "Orb of Transmutation",
  "Orb of Augmentation",
  "Chromatic Orb",
  "Hinekora's Lock",
  "Mirror Shard",
  "Exalted Shard",
  "Ancient Orb",
  "Harbinger's Orb",
  "Veiled Chaos Orb",
]);

/**
 * Fetches currency names from the engine's /items/currencies proxy endpoint.
 * Used to build the inline-mention regex in resolveBlocks().
 * Never throws — returns fallback list on failure.
 */
export async function fetchCurrencyNames(): Promise<readonly string[]> {
  const url = proxyUrl("/items/currencies");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ITEM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) return FALLBACK_CURRENCY_NAMES;
    const data = (await res.json()) as { names?: unknown };
    const names = Array.isArray(data?.names)
      ? (data.names as unknown[]).filter((n): n is string => typeof n === "string")
      : [];
    if (!names.length) return FALLBACK_CURRENCY_NAMES;
    return names;
  } catch {
    return FALLBACK_CURRENCY_NAMES;
  } finally {
    clearTimeout(timer);
  }
}
