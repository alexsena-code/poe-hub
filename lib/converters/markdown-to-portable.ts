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
import type {
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDef,
  PortableTextCodeBlock,
} from "@/lib/sanity/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Blocks emitted by this converter — only types the Sanity blockContent
 * schema accepts: `block`, `code`. (`image` and `table` aren't produced by
 * the LLM markdown.) Custom block types like poeCurrency/poePassive used to
 * be emitted here but Sanity schema dropped them silently — placeholders
 * `{{kind:value}}` now stay as literal span text and are expanded at render
 * time by the resolver. */
type EmittedBlock = PortableTextContent;

/** Portable Text span marks recognised by the editor. */
type SpanMark = "strong" | "em" | "code";

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
 * Converts a paragraph to a Portable Text block. Placeholder tokens
 * `{{kind:value|modifier}}` are preserved as literal span text — the
 * blog frontend's resolver (and the editor's portableToTiptap) detect
 * them at render-time and expand into chips/refs.
 *
 * Why not emit custom blocks (poeCurrency, poePassive, etc.): the Sanity
 * `blockContent` schema only allows `block | image | code | table | poeItem`.
 * Custom block types are silently dropped on write — that was the cause of
 * "body Empty" after publish. Keeping placeholders as span text guarantees
 * the body round-trips through Sanity intact.
 */
function convertParagraph(node: MdastNode): EmittedBlock[] {
  const { spans, markDefs } = convertInlineChildren(node.children ?? []);
  if (!spans.length) return [];
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
