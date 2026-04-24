/**
 * Individual placeholder resolvers — the per-kind logic called by expandSpan()
 * in resolve-blocks.ts during the transform phase.
 *
 * Split from resolve-blocks.ts for the 500L limit (SRP: each fragment resolver
 * handles exactly one placeholder kind). The shared `ResolvedFragment` union is
 * also exported here so callers don't need to reach into resolve-blocks.
 *
 * Session 08.d.
 */

import { slugify } from "@/components/editor/serializer/placeholders";
import type { Placeholder } from "@/components/editor/serializer/placeholders";
import type { ResolveState } from "./types";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ResolvedFragment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | {
      type: "item";
      text: string;
      rawText: string;
      iconUrl: string | null;
      isCurrency?: boolean;
      isGem?: boolean;
      primaryAttribute?: "Strength" | "Dexterity" | "Intelligence" | null;
      isAwakened?: boolean;
      isVaal?: boolean;
    };

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a parsed placeholder to the correct resolver.
 * Unknown kinds fall back to the literal value so readers never see `{{...}}`.
 */
export function resolvePlaceholder(ph: Placeholder, state: ResolveState): ResolvedFragment {
  switch (ph.kind) {
    case "price":
      return resolvePrice(ph, state);
    case "link":
      return resolveLink(ph, state);
    case "item":
      return resolveItem(ph, state);
    case "pobitem":
      return resolvePobItem(ph, state);
    case "passive":
      return resolvePassive(ph, state);
    case "patch":
      // Single-value patch placeholder — emit the version number literally
      return { type: "text", text: ph.value };
    case "cta":
      // Inline CTA (mixed with prose) is intentionally dropped.
      // Standalone-block pre-pass in resolveBlocks() already promoted solo
      // occurrences to poeCta blocks; any remaining inline ones would break
      // the banner layout, so we emit empty text and let prose flow.
      return { type: "text", text: "" };
    default:
      return { type: "text", text: ph.value };
  }
}

// ─── Price ────────────────────────────────────────────────────────────────────

function resolvePrice(ph: Placeholder, state: ResolveState): ResolvedFragment {
  const entry = state.prices[ph.value.toLowerCase()];
  if (!entry) return { type: "text", text: ph.value };

  const modifier = (ph.modifier ?? "").toLowerCase();
  const chaos = Math.round(entry.chaos);
  const divineFloat = entry.divine;
  const divineLabel =
    divineFloat >= 1
      ? `${divineFloat.toFixed(divineFloat >= 10 ? 0 : 1)} div`
      : divineFloat > 0
        ? `${(1 / divineFloat).toFixed(0)}c per div`
        : "";

  switch (modifier) {
    case "divine":
      return { type: "text", text: divineLabel || `${chaos.toLocaleString()}c` };
    case "chaos":
      return { type: "text", text: `${chaos.toLocaleString()}c` };
    case "short":
      return {
        type: "text",
        text: divineFloat >= 1 ? divineLabel : `${chaos.toLocaleString()}c`,
      };
    default: {
      const primary = divineFloat >= 1 ? divineLabel : `${chaos.toLocaleString()}c`;
      const secondary = divineFloat >= 1 ? ` (${chaos.toLocaleString()}c)` : "";
      return { type: "text", text: `${primary}${secondary}` };
    }
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function resolveItem(ph: Placeholder, state: ResolveState): ResolvedFragment {
  const data = state.items[ph.value.toLowerCase()];
  if (!data || !data.rawText) {
    // Engine doesn't know this item — fall back to a product-page link
    return resolveLink({ ...ph, modifier: ph.modifier ?? "product" }, state);
  }
  return {
    type: "item",
    text: data.name || ph.value,
    rawText: data.rawText,
    iconUrl: data.iconUrl ?? null,
    isCurrency: isMinimalTooltipItem(data.classId, data.rarity),
    isGem: isGemClass(data.classId),
    primaryAttribute: data.gemInfo?.primaryAttribute ?? null,
    isAwakened: data.gemInfo?.isAwakened ?? false,
    isVaal: data.gemInfo?.isVaal ?? false,
  };
}

// ─── PoB item ─────────────────────────────────────────────────────────────────

function resolvePobItem(ph: Placeholder, state: ResolveState): ResolvedFragment {
  const data = state.pobItems[ph.value];
  if (!data || !data.rawText) {
    return { type: "text", text: data?.name ?? ph.value };
  }
  return {
    type: "item",
    text: data.name || ph.value,
    rawText: data.rawText,
    iconUrl: data.iconUrl ?? null,
    isCurrency: isMinimalTooltipItem(data.classId, data.rarity),
    isGem: false,
    primaryAttribute: null,
    isAwakened: false,
    isVaal: false,
  };
}

// ─── Passive ──────────────────────────────────────────────────────────────────

function resolvePassive(ph: Placeholder, state: ResolveState): ResolvedFragment {
  const data = state.passives.get(ph.value.toLowerCase());
  if (!data || !data.rawText) {
    return { type: "text", text: data?.name ?? ph.value };
  }
  return {
    type: "item",
    text: data.name || ph.value,
    rawText: data.rawText,
    iconUrl: data.iconUrl ?? null,
    isCurrency: false,
    isGem: false,
    primaryAttribute: null,
    isAwakened: false,
    isVaal: false,
  };
}

// ─── Link ─────────────────────────────────────────────────────────────────────

function resolveLink(ph: Placeholder, state: ResolveState): ResolvedFragment {
  const locale = state.ctx.locale || "en";
  const localePrefix = locale && locale !== "en" ? `/${locale}` : "";
  const target = (ph.modifier ?? "product").toLowerCase();
  const slug = slugify(ph.value);
  const href = (() => {
    switch (target) {
      case "blog":
      case "post":
        return `${localePrefix}/blog/${slug}`;
      case "build":
        return `${localePrefix}/builds/${slug}`;
      default:
        return `${localePrefix}/products/${slug}`;
    }
  })();
  return { type: "link", text: ph.value, href };
}

// ─── Class helpers ────────────────────────────────────────────────────────────

function isGemClass(classId: string | null): boolean {
  const c = (classId ?? "").toLowerCase();
  return c === "active skill gem" || c === "support skill gem";
}

/**
 * Returns true for item classes that use the minimal currency-style tooltip:
 * StackableCurrencies, MapFragments (scarabs, Sacrifice/Mortal), and anything
 * whose rarity is "Currency".
 */
function isMinimalTooltipItem(classId: string | null, rarity: string | null): boolean {
  const c = (classId ?? "").toLowerCase();
  if (c.includes("currency")) return true;
  if (c === "mapfragment") return true;
  return (rarity ?? "").toLowerCase() === "currency";
}
