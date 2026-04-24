/**
 * Converts raw Markdown to Sanity Portable Text blocks.
 *
 * WHY this exists: the engine LLM produces guides as Markdown strings per
 * section/language. When the operator clicks "Editar no Blog" we need to
 * produce Portable Text that the existing blog editor (Tiptap ↔ Sanity) can
 * open without loss. This is a one-way converter: Markdown → PortableTextContent[].
 *
 * Placeholder support: inline tokens `{{kind:value|modifier}}` emitted by the
 * engine are parsed and converted to custom Portable Text blocks consumed by
 * the editor's `portableToTiptap` deserialiser. The node types and value-attrs
 * mirror `components/editor/serializer/tiptap-to-portable.ts`.
 *
 * The output shape is consumed by `portableToTiptap()` in
 * `components/editor/serializer/portable-to-tiptap.ts`. Both sides must agree
 * on `_type` values and attribute names — see POE_BLOCK_TYPE_FOR_KIND below.
 *
 * Session 10.e.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString as mdastToString } from "mdast-util-to-string";
import { nanoid } from "nanoid";
import { parsePlaceholders } from "@/components/editor/serializer/placeholders";
import type {
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDef,
  PortableTextCodeBlock,
} from "@/lib/sanity/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A custom inline Portable Text block for PoE placeholders. */
interface PoeCustomBlock {
  _type: "poeCurrency" | "poeItem" | "poePassive" | "poePrice";
  _key: string;
  [attr: string]: unknown;
}

/** Union of all blocks this converter may emit. */
type EmittedBlock = PortableTextContent | PoeCustomBlock;

/** Portable Text span marks recognised by the editor. */
type SpanMark = "strong" | "em" | "code";

// ─── Placeholder → Portable Text block mapping ────────────────────────────────

/**
 * Maps `{{kind:...}}` placeholder kinds to Portable Text `_type` + value attr.
 * Mirrors the reverse table in `portable-to-tiptap.ts`.
 *
 * `cta` becomes a `poeCta` block-level node (variant = modifier or value).
 */
const POE_BLOCK_TYPE_FOR_KIND: Record<
  string,
  { _type: string; valueAttr: string } | undefined
> = {
  currency: { _type: "poeCurrency", valueAttr: "currencyName" },
  item:     { _type: "poeItem",     valueAttr: "itemName" },
  passive:  { _type: "poePassive",  valueAttr: "passiveName" },
  price:    { _type: "poePrice",    valueAttr: "itemName" },
  // `cta` is handled inline as a span token; block-level conversion is
  // only needed for the serialiser going the other way.
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Convert a Markdown string to a Portable Text block array.
 *
 * @example
 * const blocks = markdownToPortableText("# Hello\n\nBuy {{currency:Chaos Orb}}.")
 * // → [{ _type:'block', style:'h1', ... }, { _type:'block', style:'normal', children:[...] }]
 */
export function markdownToPortableText(md: string): EmittedBlock[] {
  if (!md || md.trim() === "") return [];

  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(md);

  const blocks: EmittedBlock[] = [];
  for (const node of tree.children) {
    const converted = convertNode(node as MdastNode);
    blocks.push(...converted);
  }
  return blocks;
}

// ─── MDAST node types (minimal subset we need) ────────────────────────────────

interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  lang?: string;
  url?: string;
  alt?: string;
  title?: string;
  spread?: boolean;
}

// ─── Node dispatcher ──────────────────────────────────────────────────────────

function convertNode(node: MdastNode): EmittedBlock[] {
  switch (node.type) {
    case "heading":      return [convertHeading(node)];
    case "paragraph":    return convertParagraph(node);
    case "list":         return convertList(node);
    case "listItem":     return convertListItem(node, "bullet", 1);
    case "blockquote":   return [convertBlockquote(node)];
    case "code":         return [convertCode(node)];
    case "thematicBreak": return [];
    case "image":        return []; // images need Sanity asset refs — skip for now
    default:             return [];
  }
}

// ─── Heading ──────────────────────────────────────────────────────────────────

function convertHeading(node: MdastNode): PortableTextBlock {
  const level = Math.min(node.depth ?? 1, 4) as 1 | 2 | 3 | 4;
  const style = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const text = mdastToString(node as Parameters<typeof mdastToString>[0]);
  return makeTextBlock(style, text, [], []);
}

// ─── Paragraph (may contain placeholders → split into spans + custom blocks) ──

/**
 * A paragraph with placeholders is split: each placeholder becomes a custom
 * Portable Text block (poeCurrency, poeItem, etc.) adjacent to the paragraph
 * text spans. Plain text and marks are preserved as spans within PortableTextBlock.
 */
function convertParagraph(node: MdastNode): EmittedBlock[] {
  const { spans, markDefs } = convertInlineChildren(node.children ?? []);

  if (!spans.length) return [];

  // Reconstruct full raw text to detect placeholder-only paragraphs that
  // should become block-level nodes (no surrounding text).
  const rawText = spans.map((s) => s.text).join("");
  const phs = parsePlaceholders(rawText);

  // If the whole paragraph is a single placeholder, emit it as a custom block.
  if (phs.length === 1 && rawText.trim() === phs[0].raw.trim()) {
    const custom = placeholderToBlock(phs[0].kind, phs[0].value, phs[0].modifier);
    if (custom) return [custom];
  }

  // Mixed text + placeholders: keep as normal paragraph with span tokens.
  // The `portableToTiptap` deserialiser's `splitByPlaceholders` will expand them.
  return [{ _type: "block", _key: nanoid(), style: "normal", children: spans, markDefs }];
}

// ─── List ─────────────────────────────────────────────────────────────────────

function convertList(node: MdastNode): EmittedBlock[] {
  const listType = node.ordered ? "number" : "bullet";
  const blocks: EmittedBlock[] = [];
  for (const child of node.children ?? []) {
    blocks.push(...convertListItem(child, listType, 1));
  }
  return blocks;
}

function convertListItem(
  node: MdastNode,
  listType: "bullet" | "number",
  level: number,
): EmittedBlock[] {
  const blocks: EmittedBlock[] = [];

  for (const child of node.children ?? []) {
    if (child.type === "paragraph") {
      const { spans, markDefs } = convertInlineChildren(child.children ?? []);
      if (spans.length) {
        const block: PortableTextBlock = {
          _type: "block",
          _key: nanoid(),
          style: "normal",
          listItem: listType,
          level,
          children: spans,
          markDefs,
        };
        blocks.push(block);
      }
    } else if (child.type === "list") {
      // Nested list — increase level.
      const nestedType = child.ordered ? "number" : "bullet";
      for (const nestedItem of child.children ?? []) {
        blocks.push(...convertListItem(nestedItem, nestedType, level + 1));
      }
    }
  }

  return blocks;
}

// ─── Blockquote ───────────────────────────────────────────────────────────────

function convertBlockquote(node: MdastNode): PortableTextBlock {
  const text = mdastToString(node as Parameters<typeof mdastToString>[0]);
  return makeTextBlock("blockquote", text, [], []);
}

// ─── Code block ───────────────────────────────────────────────────────────────

function convertCode(node: MdastNode): PortableTextCodeBlock {
  return {
    _type: "code",
    _key: nanoid(),
    code: node.value ?? "",
    language: node.lang ?? "text",
  };
}

// ─── Inline children → spans ─────────────────────────────────────────────────

interface SpanResult {
  spans: PortableTextSpan[];
  markDefs: PortableTextMarkDef[];
}

function convertInlineChildren(
  nodes: MdastNode[],
  inheritedMarks: SpanMark[] = [],
): SpanResult {
  const spans: PortableTextSpan[] = [];
  const markDefs: PortableTextMarkDef[] = [];

  for (const node of nodes) {
    const result = convertInlineNode(node, inheritedMarks, markDefs);
    spans.push(...result);
  }

  return { spans, markDefs };
}

function convertInlineNode(
  node: MdastNode,
  marks: SpanMark[],
  markDefs: PortableTextMarkDef[],
): PortableTextSpan[] {
  switch (node.type) {
    case "text":
      return [makeSpan(node.value ?? "", marks)];

    case "strong": {
      const children = convertInlineChildren(node.children ?? [], [...marks, "strong"]);
      markDefs.push(...children.markDefs);
      return children.spans;
    }

    case "emphasis": {
      const children = convertInlineChildren(node.children ?? [], [...marks, "em"]);
      markDefs.push(...children.markDefs);
      return children.spans;
    }

    case "inlineCode":
      return [makeSpan(node.value ?? "", [...marks, "code"])];

    case "link": {
      const linkKey = nanoid();
      const href = node.url ?? "";
      markDefs.push({ _type: "link", _key: linkKey, href, blank: true });
      const linkMark = linkKey as unknown as SpanMark;
      const children = convertInlineChildren(node.children ?? [], [...marks, linkMark]);
      markDefs.push(...children.markDefs);
      return children.spans;
    }

    case "image":
      // Inline images lack Sanity asset refs — emit alt text as a span.
      return node.alt ? [makeSpan(`[${node.alt}]`, marks)] : [];

    default:
      // Unknown inline node — extract plain text as fallback.
      return [makeSpan(mdastToString(node as Parameters<typeof mdastToString>[0]), marks)];
  }
}

// ─── Placeholder → custom block ───────────────────────────────────────────────

/**
 * Converts a single `{{kind:value|modifier}}` placeholder to a Portable Text
 * custom block. Returns null for unknown kinds.
 */
function placeholderToBlock(
  kind: string,
  value: string,
  modifier?: string,
): PoeCustomBlock | null {
  if (kind === "cta") {
    return {
      _type: "poeCta" as unknown as PoeCustomBlock["_type"],
      _key: nanoid(),
      variant: value,
      modifier,
    } as unknown as PoeCustomBlock;
  }

  const mapping = POE_BLOCK_TYPE_FOR_KIND[kind];
  if (!mapping) return null;

  return {
    _type: mapping._type as PoeCustomBlock["_type"],
    _key: nanoid(),
    [mapping.valueAttr]: value,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSpan(text: string, marks: SpanMark[]): PortableTextSpan {
  return {
    _type: "span",
    _key: nanoid(),
    text,
    marks: marks as string[],
  };
}

function makeTextBlock(
  style: PortableTextBlock["style"],
  text: string,
  spans: PortableTextSpan[],
  markDefs: PortableTextMarkDef[],
): PortableTextBlock {
  const children: PortableTextSpan[] =
    spans.length > 0 ? spans : [makeSpan(text, [])];
  return {
    _type: "block",
    _key: nanoid(),
    style,
    children,
    markDefs,
  };
}
