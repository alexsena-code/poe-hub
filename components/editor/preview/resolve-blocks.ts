/**
 * Pre-resolve placeholders in a Portable Text tree for the hub's preview pane.
 *
 * Port of poetrade-dev/lib/placeholders/resolve-blocks.ts. Key differences:
 *   - Removed 'server-only' — must run in both Server and Client contexts
 *     because preview-pane.tsx is a Client Component using SWR.
 *   - Fetch functions use hub's fetch-helpers.ts (proxy /api/engine/* routes)
 *     instead of the engine directly.
 *   - CTA leagueName + productIconUrl are null in preview (cosmetic gap —
 *     getCurrentTempLeague() and getItemIconMap() from the poetrade-dev app
 *     layer are not ported; acceptable for operator preview).
 *   - PortableTextContent imported from lib/sanity/types.ts (hub's local mirror).
 *   - Individual resolvers extracted to resolve-fragments.ts (SRP split).
 *
 * Phases (identical to poetrade-dev original):
 *   0.   Split markdown blocks (\n\n → individual blocks)
 *   0.5. Promote inline currency mentions ("Divine Orb" → "{{item:Divine Orb}}")
 *   1.   Collect placeholder kinds for batch fetch
 *   2.   Batch-fetch in parallel (items, prices, passives, pob)
 *   2.5. CTA block promotion (standalone {{cta:…}} → poeCta block)
 *   3.   Transform spans (expand placeholders → spans + markDefs)
 *
 * Session 08.d.
 */

import { parsePlaceholders } from "@/components/editor/serializer/placeholders";
import type { Placeholder } from "@/components/editor/serializer/placeholders";
import type { PortableTextContent } from "@/lib/sanity/types";
import type {
  ResolveContext,
  ResolveState,
  ItemRawData,
  PriceData,
  PassiveData,
  PobItemData,
  CtaGameVersion,
} from "./types";
import {
  fetchItemRawMany,
  fetchPassiveRawMany,
  fetchPobItemRawMany,
  fetchPrices,
  fetchCurrencyNames,
} from "./fetch-helpers";
import { resolvePlaceholder } from "./resolve-fragments";

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Resolve all placeholders in a Portable Text block array.
 *
 * Returns a new array with placeholders expanded into enriched spans and
 * markDefs. Blocks that can't be enriched (engine down, unknown names) fall
 * back to literal text so the preview always renders something readable.
 *
 * @example
 * const resolved = await resolveBlocks(post.body, { locale: 'pt-br', gameVersion: 'path-of-exile-1' });
 */
export async function resolveBlocks(
  blocks: PortableTextContent[] | null | undefined,
  ctx: ResolveContext,
): Promise<PortableTextContent[]> {
  if (!blocks?.length) return blocks ?? [];

  // Phase 0: split markdown blocks (LLM-imported posts often land as one giant block)
  const splitAll: unknown[] = [];
  for (const b of blocks) {
    for (const part of splitMarkdownBlock(b)) splitAll.push(part);
  }

  // Phase 0.5: promote inline currency mentions → {{item:Name}}
  const currencyNames = await fetchCurrencyNames();
  const inlineRegex = buildInlineMentionRegex(currencyNames);
  const expanded = splitAll.map((b) => promoteInlineMentions(b, inlineRegex));

  // Phase 1: collect placeholder kinds for batch fetch
  const priceNames = new Set<string>();
  const itemNames = new Set<string>();
  const pobItemIds = new Set<string>();
  const passiveNames = new Set<string>();

  for (const block of expanded) {
    for (const ph of collectFromBlock(block)) {
      if (ph.kind === "price") priceNames.add(ph.value);
      if (ph.kind === "item") {
        itemNames.add(ph.value);
        priceNames.add(ph.value); // item cards also show a price sub-line
      }
      if (ph.kind === "pobitem") pobItemIds.add(ph.value);
      if (ph.kind === "passive") passiveNames.add(ph.value);
    }
  }

  // Phase 2: batch-fetch in parallel
  // Fallback em liga PERMANENTE de propósito. Aqui já esteve "Mirage", que ao
  // terminar passou a devolver preço vazio sem erro — o preview simplesmente
  // não mostrava número e ninguém sabia por quê. Standard nunca encerra.
  const league = ctx.league ?? "Standard";
  const [prices, items, pobItems, passives] = await Promise.all([
    priceNames.size
      ? fetchPrices(Array.from(priceNames), league)
      : Promise.resolve({} as Record<string, PriceData>),
    itemNames.size
      ? fetchItemRawMany(Array.from(itemNames))
      : Promise.resolve({} as Record<string, ItemRawData>),
    pobItemIds.size
      ? fetchPobItemRawMany(Array.from(pobItemIds))
      : Promise.resolve({} as Record<string, PobItemData>),
    passiveNames.size
      ? fetchPassiveRawMany(Array.from(passiveNames))
      : Promise.resolve(new Map<string, PassiveData>()),
  ]);

  // Phase 2.5: CTA block promotion
  const ctxGameVersion: CtaGameVersion = ctx.gameVersion ?? "path-of-exile-1";
  const ctaBlocksByIdx = new Map<number, Placeholder>();
  expanded.forEach((b, i) => {
    const ph = extractCtaPlaceholder(b);
    if (ph) ctaBlocksByIdx.set(i, ph);
  });

  const ctaResolved = expanded.map((b, i) => {
    const ph = ctaBlocksByIdx.get(i);
    // leagueName + productIconUrl are null — cosmetic gap acceptable for preview
    return ph ? makeCtaBlock(ph, ctxGameVersion) : b;
  });

  // Phase 3: transform spans
  const state: ResolveState = { ctx, prices, items, pobItems, passives };
  return ctaResolved.map((b) =>
    transformBlock(promoteMarkdownHeading(b), state),
  ) as PortableTextContent[];
}

// ---------------------------------------------------------------------------
// CTA block promotion
// ---------------------------------------------------------------------------

function extractCtaPlaceholder(block: unknown): Placeholder | null {
  if (!block || typeof block !== "object") return null;
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return null;
  const fullText = (b.children as unknown[])
    .filter((c): c is Record<string, unknown> =>
      !!c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string",
    )
    .map((c) => c.text as string)
    .join("")
    .trim();
  if (!fullText) return null;
  const placeholders = parsePlaceholders(fullText);
  if (placeholders.length !== 1) return null;
  const ph = placeholders[0];
  if (ph.kind !== "cta" || ph.raw.trim() !== fullText) return null;
  return ph;
}

const POE1_TOKENS = new Set(["poe1", "poe-1", "path-of-exile-1"]);
const POE2_TOKENS = new Set(["poe2", "poe-2", "path-of-exile-2"]);

function parseCtaModifier(
  modifier: string | undefined,
  defaultGameVersion: CtaGameVersion,
): { slug?: string; gameVersion: CtaGameVersion } {
  if (!modifier) return { gameVersion: defaultGameVersion };
  const parts = modifier.split("|").map((p) => p.trim()).filter(Boolean);
  let slug: string | undefined;
  let gameVersion = defaultGameVersion;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (POE2_TOKENS.has(lower)) gameVersion = "path-of-exile-2";
    else if (POE1_TOKENS.has(lower)) gameVersion = "path-of-exile-1";
    else if (slug === undefined) slug = lower;
  }
  return { slug, gameVersion };
}

function makeCtaBlock(ph: Placeholder, defaultGameVersion: CtaGameVersion): unknown {
  const variant = ph.value.toLowerCase();
  const { slug, gameVersion } = parseCtaModifier(ph.modifier, defaultGameVersion);
  const key = `cta-${Math.random().toString(36).slice(2, 8)}`;
  if (variant === "product") {
    return {
      _type: "poeCta",
      _key: key,
      variant: "product",
      slug: slug ?? "divine-orb",
      gameVersion,
      leagueName: null,
      productIconUrl: null,
    };
  }
  return { _type: "poeCta", _key: key, variant: "currency", gameVersion, leagueName: null };
}

// ---------------------------------------------------------------------------
// Inline mention promotion
// ---------------------------------------------------------------------------

/**
 * Build the rewrite regex from the currency name list.
 * Sorted longest-first so multi-word names win over partial overlaps.
 * Negative lookbehind prevents rewriting names already inside {{kind:...}}.
 */
function buildInlineMentionRegex(names: readonly string[]): RegExp | null {
  if (!names.length) return null;
  const sorted = Array.from(new Set(names)).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(
    `(?<!\\{\\{[a-z]+:)\\b(?:${escaped.join("|")})\\b(?![|}])`,
    "gi",
  );
}

function promoteInlineMentions(block: unknown, regex: RegExp | null): unknown {
  if (!regex || !block || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return block;
  const newChildren = (b.children as unknown[]).map((c) => {
    if (!c || typeof c !== "object") return c;
    const child = c as Record<string, unknown>;
    if (child._type !== "span" || typeof child.text !== "string" || !child.text) return c;
    // Skip spans with marks — they carry intent from the CMS
    if (Array.isArray(child.marks) && child.marks.length > 0) return c;
    if (!regex.test(child.text)) {
      regex.lastIndex = 0;
      return c;
    }
    regex.lastIndex = 0;
    return { ...child, text: child.text.replace(regex, (m: string) => `{{item:${m}}}`) };
  });
  return { ...b, children: newChildren };
}

// ---------------------------------------------------------------------------
// Markdown block splitting
// ---------------------------------------------------------------------------

/**
 * Splits a block whose single text child contains \n\n-separated markdown
 * into one Portable Text block per paragraph. Headings get the correct style.
 */
function splitMarkdownBlock(block: unknown): unknown[] {
  if (!block || typeof block !== "object") return [block];
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return [block];

  const styleNormalish = !b.style || b.style === "normal" || b.style === "";
  if (!styleNormalish) return [block];

  const textChildren = (b.children as unknown[]).filter(
    (c): c is Record<string, unknown> =>
      !!c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string",
  );
  if (textChildren.length !== 1) return [block];
  const span = textChildren[0];
  if (Array.isArray(span.marks) && span.marks.length > 0) return [block];
  const text = span.text as string;
  if (!text.includes("\n")) return [block];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return [block];

  const baseKey = (b._key as string) ?? "md";
  return paragraphs.map((para, i) => {
    const headingMatch = para.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4);
      return {
        _type: "block",
        _key: `${baseKey}-${i}-h`,
        style: `h${level}`,
        markDefs: [],
        children: [{ _type: "span", _key: `${baseKey}-${i}-hs`, text: headingMatch[2], marks: [] }],
      };
    }
    return {
      _type: "block",
      _key: `${baseKey}-${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `${baseKey}-${i}-s`, text: para, marks: [] }],
    };
  });
}

// ---------------------------------------------------------------------------
// Markdown heading promotion
// ---------------------------------------------------------------------------

/**
 * Promotes a block whose combined text starts with "## " into a proper heading.
 * Runs before span expansion so h1–h4 handlers fire correctly.
 */
function promoteMarkdownHeading(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return block;

  const styleNormalish = !b.style || b.style === "normal" || b.style === "";
  if (!styleNormalish) return block;

  const children = b.children as unknown[];
  const firstTextIdx = children.findIndex(
    (c): c is Record<string, unknown> =>
      !!c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string",
  );
  if (firstTextIdx < 0) return block;

  const fullLeading = children
    .filter(
      (c): c is Record<string, unknown> =>
        !!c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string",
    )
    .map((c) => c.text as string)
    .join("");

  const m = fullLeading.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
  if (!m || /\n/.test(fullLeading)) return block;

  const level = Math.min(m[1].length, 4);
  const stripRe = /^\s*#{1,6}\s+/;
  const newChildren = children.map((c, idx) => {
    if (idx !== firstTextIdx) return c;
    const child = c as Record<string, unknown>;
    if (typeof child.text !== "string") return c;
    return { ...child, text: (child.text as string).replace(stripRe, "") };
  });

  return { ...b, style: `h${level}`, children: newChildren };
}

// ---------------------------------------------------------------------------
// Collect phase
// ---------------------------------------------------------------------------

function collectFromBlock(block: unknown): Placeholder[] {
  if (!block || typeof block !== "object") return [];
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return [];

  const out: Placeholder[] = [];
  for (const child of b.children as unknown[]) {
    if (!child || typeof child !== "object") continue;
    const c = child as Record<string, unknown>;
    if (c._type === "span" && typeof c.text === "string") {
      out.push(...parsePlaceholders(c.text));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transform phase
// ---------------------------------------------------------------------------

function transformBlock(block: unknown, state: ResolveState): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;
  if (b._type !== "block" || !Array.isArray(b.children)) return block;

  const newChildren: unknown[] = [];
  const newMarkDefs: unknown[] = [...((b.markDefs as unknown[]) ?? [])];

  for (const child of b.children as unknown[]) {
    if (!child || typeof child !== "object") {
      newChildren.push(child);
      continue;
    }
    const c = child as Record<string, unknown>;
    if (c._type === "span" && typeof c.text === "string") {
      newChildren.push(...expandSpan(c, state, newMarkDefs));
    } else {
      newChildren.push(child);
    }
  }

  return { ...b, markDefs: newMarkDefs, children: newChildren };
}

/**
 * Expands a single span into an array of spans where each placeholder has been
 * replaced (text, link, or poeItem mark). Appends markDefs as needed.
 */
function expandSpan(
  span: Record<string, unknown>,
  state: ResolveState,
  markDefs: unknown[],
): unknown[] {
  const text = span.text as string;
  const placeholders = parsePlaceholders(text);
  if (!placeholders.length) return [span];

  const originalMarks: string[] = Array.isArray(span.marks) ? (span.marks as string[]) : [];
  const out: unknown[] = [];
  let cursor = 0;
  let keyCounter = 0;
  const nextKey = () => `ph-${(span._key as string) ?? "auto"}-${keyCounter++}`;

  for (const ph of placeholders) {
    if (ph.index > cursor) {
      out.push(makeSpan(text.slice(cursor, ph.index), originalMarks, nextKey()));
    }

    const resolved = resolvePlaceholder(ph, state);
    if (resolved.type === "text") {
      out.push(makeSpan(resolved.text, originalMarks, nextKey()));
    } else if (resolved.type === "link") {
      const linkKey = `phlink-${(span._key as string) ?? "auto"}-${keyCounter++}`;
      markDefs.push({ _key: linkKey, _type: "link", href: resolved.href });
      out.push(
        makeSpan(resolved.text, [...originalMarks.filter((m) => m !== "link"), linkKey], nextKey()),
      );
    } else {
      // Inline item reference — rendered via poeItem mark handler in portable-text-components
      const itemKey = `phitem-${(span._key as string) ?? "auto"}-${keyCounter++}`;
      markDefs.push({
        _key: itemKey,
        _type: "poeItem",
        rawText: resolved.rawText,
        iconUrl: resolved.iconUrl,
        itemName: resolved.text,
        isCurrency: resolved.isCurrency ?? false,
        isGem: resolved.isGem ?? false,
        primaryAttribute: resolved.primaryAttribute ?? null,
        isAwakened: resolved.isAwakened ?? false,
        isVaal: resolved.isVaal ?? false,
      });
      out.push(makeSpan(resolved.text, [...originalMarks, itemKey], nextKey()));
    }

    cursor = ph.index + ph.length;
  }

  if (cursor < text.length) {
    out.push(makeSpan(text.slice(cursor), originalMarks, nextKey()));
  }

  return out;
}

function makeSpan(text: string, marks: string[], key: string): unknown {
  return { _type: "span", _key: key, text, marks };
}
