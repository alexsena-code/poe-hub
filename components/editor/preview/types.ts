/**
 * Auxiliary types for the preview resolver and fetch helpers.
 *
 * Mirrors shapes from the poetrade-dev engine API so the hub's preview
 * pane can resolve {{item:Name}} / {{price:Name}} / {{passive:Name}} /
 * {{pobitem:id}} placeholders via our own proxy routes at /api/engine/*.
 *
 * PortableTextBlock is imported from lib/sanity/types.ts (created by S08.a)
 * rather than duplicated here.
 */

export type { PortableTextBlock, PortableTextContent } from "@/lib/sanity/types";

// ─── Resolve context ─────────────────────────────────────────────────────────

/**
 * Context passed to `resolveBlocks()`.
 *
 * `gameVersion` is used by CTA block promotion — when not supplied it
 * defaults to 'path-of-exile-1' (same default as the poetrade-dev original).
 */
export interface ResolveContext {
  locale: string;
  /** Active temp-league name, e.g. "Settlers". Falls back to "Standard". */
  league?: string;
  gameVersion?: "path-of-exile-1" | "path-of-exile-2";
}

// ─── Engine API response shapes ───────────────────────────────────────────────

/**
 * Shape of `GET /api/items/:name/raw` from the engine.
 * Mirror of fetch-items.ts::ItemRawData in poetrade-dev.
 */
export interface ItemRawData {
  rawText: string;
  iconUrl: string | null;
  name: string;
  baseName: string | null;
  rarity: string | null;
  classId: string | null;
  /** Only present when the engine identifies the item as a skill gem. */
  gemInfo?: {
    primaryAttribute?: "Strength" | "Dexterity" | "Intelligence" | null;
    isAwakened?: boolean;
    isVaal?: boolean;
    tags?: string[];
  } | null;
}

/**
 * Shape of `GET /api/knowledge/ninja-price/:game/:category` or the
 * engine's `/ninja/lookup` batch endpoint.
 * Mirror of fetch-prices.ts::PriceEntry in poetrade-dev.
 */
export interface PriceData {
  name: string;
  chaos: number;
  divine: number;
  listingCount?: number;
  icon?: string | null;
  category?: string;
}

/**
 * Keyed map of PriceData returned by the engine's batch price lookup.
 * Keys are lowercase item names.
 */
export type PriceMap = Record<string, PriceData>;

/**
 * Shape of `GET /api/passives/:name/raw` from the engine.
 * Mirror of fetch-passive.ts::PassiveRawData in poetrade-dev.
 */
export type PassiveKind =
  | "notable"
  | "keystone"
  | "ascendancy"
  | "mastery"
  | "jewel_socket"
  | "small";

export interface PassiveData {
  rawText: string;
  name: string;
  kind: PassiveKind;
  iconUrl: string | null;
  ascendancyClass: string | null;
  isAtlasPassive: boolean;
  patchVersion: string;
}

/**
 * Shape of `GET /api/pob/items/:id/raw` from the engine.
 * Mirror of fetch-pob-items.ts::PobItemRawData in poetrade-dev.
 */
export interface PobItemData {
  rawText: string;
  iconUrl: string | null;
  name: string;
  baseName: string | null;
  rarity: string | null;
  classId: string | null;
}

// ─── Internal resolver state ──────────────────────────────────────────────────

/** Internal state threaded through the transform phase of resolveBlocks(). */
export interface ResolveState {
  ctx: ResolveContext;
  prices: PriceMap;
  items: Record<string, ItemRawData>;
  pobItems: Record<string, PobItemData>;
  passives: Map<string, PassiveData>;
}

// ─── CTA block ────────────────────────────────────────────────────────────────

export type CtaGameVersion = "path-of-exile-1" | "path-of-exile-2";
export type CtaVariant = "currency" | "product" | "builds";

/**
 * Resolved CTA block injected by the placeholder resolver.
 * Rendered by the `poeCta` type handler in portable-text-components.tsx.
 */
export interface PoeCtaBlock {
  _type: "poeCta";
  _key: string;
  variant: CtaVariant;
  slug?: string;
  gameVersion: CtaGameVersion;
  leagueName: string | null;
  productIconUrl?: string | null;
}
