/**
 * Converts raw Markdown to Sanity Portable Text blocks.
 *
 * WHY this exists: the engine LLM produces guides as Markdown strings per
 * section/language. When the operator clicks "Editar no Blog" we need to
 * produce Portable Text that the existing blog editor (Tiptap ↔ Sanity) can
 * open without loss. This is a one-way converter: Markdown → PortableTextContent[].
 *
 * Implementation: `marked` (MD → HTML) + `@portabletext/block-tools.htmlToBlocks`
 * with a compiled @sanity/schema. This is the canonical Sanity path — the schema
 * constrains output to only types Sanity accepts, closing the door on session-10-
 * style bugs (emitting custom block types that Sanity silently drops).
 *
 * Reference implementation: poetrade-dev/scripts/sync-wiki-to-sanity.ts:38-66.
 * Schema mirrors: poetrade-dev/sanity/schemas/blockContent.ts (block + code types
 * only — image omitted because `options:{hotspot}` requires sanity.imageHotspot
 * which is unavailable in a local compile, and the LLM never emits images anyway).
 *
 * Placeholder tokens `{{kind:value|modifier}}` pass through as literal span text
 * because `marked` emits them verbatim in <p> tags — the blog resolver and
 * portableToTiptap expand them at render time.
 *
 * Session 10.e / Session 11.b.
 */

import { marked } from "marked";
import { htmlToBlocks } from "@portabletext/block-tools";
import type { DeserializerRule, ArbitraryTypedObject } from "@portabletext/block-tools";
// JSDOM has no bundled types — @types/jsdom provides them (devDep, session 11.b).
import { JSDOM } from "jsdom";
// Named import — default export is deprecated per @sanity/schema warning.
import { Schema } from "@sanity/schema";
import { nanoid } from "nanoid";
import type { PortableTextContent, PortableTextBlock, PortableTextCodeBlock } from "@/lib/sanity/types";

// ─── Module-scope singletons (expensive to create — do once) ──────────────────

const { window: jsdomWindow } = new JSDOM("");

/** Schema declaration mirrors poetrade-dev blockContent.ts (block + code).
 * `number` list and `code` decorator added to match old converter's output.
 * `image` omitted: sanity.imageHotspot unknown in local compile; LLM never
 * produces image markdown with valid Sanity asset refs anyway. */
const compiledSchema = Schema.compile({
  name: "default",
  types: [
    {
      type: "object",
      name: "postBody",
      fields: [
        {
          name: "body",
          type: "array",
          of: [
            {
              type: "block",
              styles: [
                { title: "Normal", value: "normal" },
                { title: "H1", value: "h1" },
                { title: "H2", value: "h2" },
                { title: "H3", value: "h3" },
                { title: "H4", value: "h4" },
                { title: "Quote", value: "blockquote" },
              ],
              lists: [
                { title: "Bullet", value: "bullet" },
                { title: "Number", value: "number" },
              ],
              marks: {
                decorators: [
                  { title: "Strong", value: "strong" },
                  { title: "Emphasis", value: "em" },
                  // code inline mark — needed so <code> inside <p> is preserved.
                  { title: "Code", value: "code" },
                ],
                annotations: [
                  {
                    title: "URL",
                    name: "link",
                    type: "object",
                    fields: [
                      { title: "URL", name: "href", type: "string" },
                      { title: "Open in new tab", name: "blank", type: "boolean" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
});

const blockContentType = compiledSchema
  .get("postBody")
  .fields.find((f: { name: string }) => f.name === "body").type;

// ─── Custom htmlToBlocks rules ────────────────────────────────────────────────

/** Rules passed to htmlToBlocks to handle elements that the default parser
 * doesn't map correctly given our constrained schema.
 * Types come from @portabletext/block-tools: DeserializerRule uses `Node` (DOM)
 * for `el`, and `ArbitraryTypedObject` for the createBlock props. */
const DESERIALIZE_RULES: DeserializerRule[] = [
  {
    // <pre><code class="language-*"> → custom code block type.
    // Default parser converts <pre> to a normal paragraph — not what we want.
    deserialize(el: Node, _next, block) {
      if (el.nodeName !== "PRE") return undefined;
      const preEl = el as Element;
      const codeEl = preEl.querySelector("code");
      const rawText = codeEl?.textContent ?? preEl.textContent ?? "";
      // Trim trailing newline that marked appends inside <code>.
      const code = rawText.replace(/\n$/, "");
      const langMatch = codeEl?.className.match(/language-(\w+)/);
      const language = langMatch ? langMatch[1] : "text";
      return block({ _type: "code", code, language } as ArbitraryTypedObject);
    },
  },
  {
    // <h5>/<h6> → h4 (schema only goes to h4; default parser falls back to normal).
    deserialize(el: Node, next, block) {
      if (!["H5", "H6"].includes(el.nodeName)) return undefined;
      return block({
        _type: "block",
        style: "h4",
        children: next((el as Element).childNodes),
      } as ArbitraryTypedObject);
    },
  },
];

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Convert a Markdown string to a Portable Text block array.
 * Signature is preserved from the old unified/remark implementation so
 * existing callers (app/api/sanity/draft-from-guide/route.ts) need no changes.
 *
 * @example
 * const blocks = markdownToPortableText("# Hello\n\nBuy {{currency:Chaos Orb}}.")
 * // → [{ _type:'block', style:'h1', ... }, { _type:'block', style:'normal', children:[...] }]
 */
export function markdownToPortableText(md: string): PortableTextContent[] {
  if (!md || md.trim() === "") return [];

  // marked.parse with async:false uses the synchronous overload — no await needed.
  const html = marked.parse(md, { async: false }) as string;

  const rawBlocks = htmlToBlocks(html, blockContentType, {
    parseHtml: (htmlStr) =>
      new jsdomWindow.DOMParser().parseFromString(htmlStr, "text/html"),
    rules: DESERIALIZE_RULES,
  });

  // htmlToBlocks returns PortableTextBlock[] from @portabletext/block-tools, but
  // our PortableTextContent type adds _key as required and includes the code
  // variant — cast via unknown because the shapes diverge intentionally here.
  return (rawBlocks as unknown as Record<string, unknown>[]).map(normalizeBlock);
}

// ─── Block normalisation ──────────────────────────────────────────────────────

/** Ensure every block has `_type`, `_key`, and (for `block` type) `markDefs`. */
function normalizeBlock(raw: Record<string, unknown>): PortableTextContent {
  const withKey = raw._key ? raw : { ...raw, _key: nanoid() };

  // Custom code blocks from our PRE rule have _type:'code' set explicitly.
  if (withKey._type === "code") return normalizeCodeBlock(withKey);

  // All other blocks are standard `block` type (htmlToBlocks default).
  return normalizeTextBlock(withKey);
}

function normalizeCodeBlock(raw: Record<string, unknown>): PortableTextCodeBlock {
  return {
    _type: "code",
    _key: (raw._key as string) || nanoid(),
    code: (raw.code as string) ?? "",
    language: (raw.language as string) ?? "text",
  };
}

function normalizeTextBlock(raw: Record<string, unknown>): PortableTextBlock {
  // @portabletext/block-tools emits plain objects; our PortableTextBlock requires
  // _key + typed children — cast via unknown to bridge the structural gap.
  const block = raw as unknown as PortableTextBlock;
  return {
    _type: "block",
    _key: block._key || nanoid(),
    style: block.style ?? "normal",
    ...(block.listItem ? { listItem: block.listItem, level: block.level ?? 1 } : {}),
    children: (block.children ?? []).map((s) => normalizeSpan(s as unknown as Record<string, unknown>)),
    markDefs: block.markDefs ?? [],
  };
}

function normalizeSpan(span: Record<string, unknown>) {
  return {
    _type: "span" as const,
    _key: (span._key as string) || nanoid(),
    text: (span.text as string) ?? "",
    marks: (span.marks as string[]) ?? [],
  };
}
