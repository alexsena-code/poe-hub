/**
 * Placeholder parse + serialize helpers for the hub's blog editor.
 *
 * Grammar (mirrors poetrade-dev/lib/placeholders/parse.ts — do NOT import
 * cross-repo; keep this a standalone copy so either repo can evolve independently):
 *
 *   {{kind:value}}              — no modifier
 *   {{kind:value|modifier}}     — with modifier
 *
 * Values are greedy up to `|` or `}}` so multi-word names work:
 *   {{item:Divine Orb}}
 *   {{price:Kaom's Heart|divine}}
 *
 * Kind is lowercase ASCII. Unknown kinds are preserved as-is in round-trips.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * All placeholder kinds understood by the poetrade-dev rendering pipeline.
 * `cta` is block-level in practice but serialized as inline text in Sanity.
 */
export type PlaceholderKind =
  | "item"
  | "price"
  | "cta"
  | "passive"
  | "pobitem"
  | "link"
  | "patch";

export interface Placeholder {
  kind: string;
  value: string;
  modifier?: string;
  /** Full matched text including `{{` and `}}`. */
  raw: string;
  /** Byte offset inside the source string. */
  index: number;
  length: number;
}

// ─── Regex ────────────────────────────────────────────────────────────────────

/**
 * Single shared regex. Always reset `lastIndex` before use because it has the
 * `g` flag — if reused across calls without reset it will skip matches.
 *
 * Group layout:
 *   1 — kind  (lowercase ASCII)
 *   2 — value (greedy up to `|` or `}}`, no newlines)
 *   3 — modifier (optional, greedy up to `}}`, no newlines)
 */
export const PLACEHOLDER_REGEX = /\{\{([a-z]+):([^|}\n]+?)(?:\|([^}\n]+))?\}\}/gi;

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Extract every placeholder from a string.
 *
 * @example
 * parsePlaceholders("Buy {{item:Divine Orb}} for {{price:Chaos Orb|chaos}}")
 * // → [{ kind:'item', value:'Divine Orb', ... }, { kind:'price', value:'Chaos Orb', modifier:'chaos', ... }]
 */
export function parsePlaceholders(text: string): Placeholder[] {
  if (!text || typeof text !== "string") return [];

  const out: Placeholder[] = [];
  PLACEHOLDER_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    out.push({
      kind: match[1].toLowerCase(),
      value: match[2].trim(),
      modifier: match[3]?.trim(),
      raw: match[0],
      index: match.index,
      length: match[0].length,
    });
  }

  return out;
}

/**
 * Find the first placeholder in `text`, or null if none.
 * Convenience wrapper around `parsePlaceholders` for single-match callers.
 */
export function parsePlaceholder(text: string): Placeholder | null {
  const all = parsePlaceholders(text);
  return all.length > 0 ? all[0] : null;
}

// ─── Serialize ────────────────────────────────────────────────────────────────

/**
 * Produce a canonical `{{kind:value|modifier}}` token from parts.
 * Modifier is omitted when undefined or empty string.
 *
 * @example
 * formatPlaceholder('item', 'Divine Orb')           // "{{item:Divine Orb}}"
 * formatPlaceholder('price', "Kaom's Heart", 'chaos') // "{{price:Kaom's Heart|chaos}}"
 */
export function formatPlaceholder(
  kind: PlaceholderKind | string,
  value: string,
  modifier?: string,
): string {
  const modSuffix = modifier ? `|${modifier}` : "";
  return `{{${kind}:${value}${modSuffix}}}`;
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

/**
 * Slugify a display name to a URL slug.
 * Mirrors the poetrade-dev convention for product/blog/build URLs.
 *
 * @example
 * slugify("Mirror of Kalandra") // "mirror-of-kalandra"
 * slugify("Kaom's Heart")       // "kaoms-heart"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks (U+0300–U+036F) after NFD normalisation
    .replace(/[̀-ͯ]/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Split helpers ────────────────────────────────────────────────────────────

/**
 * Split `text` into alternating plain-text and placeholder segments.
 * Used by the deserializer to reconstruct inline Tiptap nodes from spans
 * that carry serialized `{{...}}` tokens.
 *
 * Returns an array of segments — either:
 *   { type: 'text',        text: string }
 *   { type: 'placeholder', placeholder: Placeholder }
 *
 * Zero-length text segments are omitted.
 *
 * @example
 * splitByPlaceholders("Buy {{item:Divine Orb}} now")
 * // → [text("Buy "), ph(item, Divine Orb), text(" now")]
 */
export type TextSegment = { type: "text"; text: string };
export type PlaceholderSegment = { type: "placeholder"; placeholder: Placeholder };
export type StringSegment = TextSegment | PlaceholderSegment;

export function splitByPlaceholders(text: string): StringSegment[] {
  const placeholders = parsePlaceholders(text);
  if (!placeholders.length) return [{ type: "text", text }];

  const segments: StringSegment[] = [];
  let cursor = 0;

  for (const ph of placeholders) {
    if (ph.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, ph.index) });
    }
    segments.push({ type: "placeholder", placeholder: ph });
    cursor = ph.index + ph.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }

  return segments;
}
