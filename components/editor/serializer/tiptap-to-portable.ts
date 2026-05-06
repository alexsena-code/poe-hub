/**
 * Converts a Tiptap editor JSON document to Portable Text blocks for storage
 * in Sanity. One-way: Tiptap JSON → PortableTextContent[].
 *
 * Design intent:
 * - Pure function — no side effects, no I/O, deterministic.
 * - Placeholder-aware: poeItem/poePrice/poePassive/poeCurrency inline nodes
 *   are serialized as {{kind:value|modifier}} text tokens inside regular
 *   Portable Text spans. The poetrade-dev renderer resolves them at read time.
 * - poeCta block nodes become top-level `poeCta` Portable Text blocks.
 * - Links become markDef entries so Sanity can render them as annotations.
 * - Nested lists are supported via Portable Text's `level` field.
 *
 * TODO: move TiptapDoc / TiptapNode types to components/editor/types.ts when
 * S08.b completes that file.
 */

import { nanoid } from "nanoid";
import { formatPlaceholder } from "./placeholders";
import type {
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDef,
  LinkMark,
  PortableTextImageBlock,
  PortableTextCodeBlock,
} from "@/lib/sanity/types";

// ─── Local Tiptap types (temporary until S08.b types.ts lands) ───────────────

/** Marks a Tiptap text node can carry. */
interface TiptapTextMark {
  type: "bold" | "italic" | "code" | "link" | "strike" | string;
  attrs?: Record<string, unknown>;
}

/** An inline node for PoE custom extensions. */
interface TiptapPoeInlineNode {
  type: "poeItem" | "poePrice" | "poeCurrency" | "poePassive";
  // Attr name varies by node type (itemName / currencyName / passiveName) —
  // see POE_INLINE_VALUE_ATTR below. Keep flexible.
  attrs: Record<string, string | null | undefined>;
}

/** Maps each PoE inline node type to the attribute holding its display value. */
const POE_INLINE_VALUE_ATTR: Record<TiptapPoeInlineNode["type"], string> = {
  poeItem: "itemName",
  poePrice: "itemName",
  poeCurrency: "currencyName",
  poePassive: "passiveName",
};

/** A text leaf node. */
interface TiptapTextNode {
  type: "text";
  text: string;
  marks?: TiptapTextMark[];
}

/** A poeCta block node (block-level). */
interface TiptapPoeCTANode {
  type: "poeCta";
  attrs: {
    variant: string;
    modifier?: string;
  };
}

/** Image node. */
interface TiptapImageNode {
  type: "image";
  attrs: {
    src: string;
    alt?: string;
    /** Sanity asset _ref — present when image was uploaded to Sanity. */
    "data-sanity-ref"?: string;
    /** Natural pixel dimensions captured at upload time. */
    width?: number | null;
    height?: number | null;
  };
}

/** Code block node. */
interface TiptapCodeBlockNode {
  type: "codeBlock";
  attrs?: { language?: string };
  content?: TiptapTextNode[];
}

/** A list item wrapper node. */
interface TiptapListItemNode {
  type: "listItem";
  content?: TiptapGenericNode[];
}

/** Bullet or ordered list container. */
interface TiptapListNode {
  type: "bulletList" | "orderedList";
  content?: TiptapListItemNode[];
}

/** Blockquote container. */
interface TiptapBlockquoteNode {
  type: "blockquote";
  content?: TiptapGenericNode[];
}

/** Heading node. */
interface TiptapHeadingNode {
  type: "heading";
  attrs: { level: number };
  content?: (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[];
}

/** A paragraph node. */
interface TiptapParagraphNode {
  type: "paragraph";
  content?: (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[];
}

/** A hard break node. */
interface TiptapHardBreakNode {
  type: "hardBreak";
}


type TiptapGenericNode =
  | TiptapTextNode
  | TiptapPoeInlineNode
  | TiptapParagraphNode
  | TiptapHeadingNode
  | TiptapBlockquoteNode
  | TiptapListNode
  | TiptapListItemNode
  | TiptapCodeBlockNode
  | TiptapImageNode
  | TiptapPoeCTANode
  | TiptapHardBreakNode
  | { type: string; attrs?: Record<string, unknown>; content?: TiptapGenericNode[] };

export interface TiptapDoc {
  type: "doc";
  content?: TiptapGenericNode[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a Tiptap editor document to a Portable Text block array.
 *
 * @example
 * const pt = tiptapToPortable(editor.getJSON())
 * // → PortableTextContent[] ready for Sanity's `body` field
 */
export function tiptapToPortable(doc: TiptapDoc): PortableTextContent[] {
  const nodes = doc.content ?? [];
  const blocks: PortableTextContent[] = [];

  for (const node of nodes) {
    const converted = convertTopLevel(node);
    blocks.push(...converted);
  }

  return blocks;
}

// ─── Top-level node dispatchers ───────────────────────────────────────────────

function convertTopLevel(node: TiptapGenericNode): PortableTextContent[] {
  switch (node.type) {
    case "paragraph":
      return [convertParagraph(node as TiptapParagraphNode)];
    case "heading":
      return [convertHeading(node as TiptapHeadingNode)];
    case "blockquote":
      return [convertBlockquote(node as TiptapBlockquoteNode)];
    case "bulletList":
      return convertList(node as TiptapListNode, "bullet", 1);
    case "orderedList":
      return convertList(node as TiptapListNode, "number", 1);
    case "codeBlock":
      return [convertCodeBlock(node as TiptapCodeBlockNode)];
    case "image":
      return [convertImage(node as TiptapImageNode)];
    case "poeCta":
      return [convertPoeCTABlock(node as TiptapPoeCTANode)];
    default:
      // Unknown top-level node — emit empty paragraph so content isn't silently dropped.
      return [emptyBlock()];
  }
}

// ─── Block converters ─────────────────────────────────────────────────────────

function convertParagraph(node: TiptapParagraphNode): PortableTextBlock {
  const { children, markDefs } = buildChildrenFromInlines(node.content ?? []);
  return makeBlock("normal", children, markDefs);
}

function convertHeading(node: TiptapHeadingNode): PortableTextBlock {
  // Cap at h4 to match Sanity blockContent schema
  const level = Math.min(Math.max(node.attrs.level, 1), 4);
  const style = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const { children, markDefs } = buildChildrenFromInlines(node.content ?? []);
  return makeBlock(style, children, markDefs);
}

function convertBlockquote(node: TiptapBlockquoteNode): PortableTextBlock {
  // Blockquote may contain paragraph children — flatten their inline content.
  const inlines = flattenBlockquoteContent(node.content ?? []);
  const { children, markDefs } = buildChildrenFromInlines(inlines);
  return makeBlock("blockquote", children, markDefs);
}

function convertList(
  node: TiptapListNode,
  listItem: "bullet" | "number",
  level: number,
): PortableTextContent[] {
  const blocks: PortableTextContent[] = [];
  const items = node.content ?? [];

  for (const item of items) {
    if (item.type !== "listItem") continue;

    const itemContent = (item as TiptapListItemNode).content ?? [];

    for (const child of itemContent) {
      if (child.type === "bulletList" || child.type === "orderedList") {
        // Nested list — recurse with incremented level
        const nested = convertList(
          child as TiptapListNode,
          child.type === "bulletList" ? "bullet" : "number",
          level + 1,
        );
        blocks.push(...nested);
      } else if (child.type === "paragraph") {
        const { children, markDefs } = buildChildrenFromInlines(
          (child as TiptapParagraphNode).content ?? [],
        );
        const block = makeBlock("normal", children, markDefs);
        block.listItem = listItem;
        block.level = level;
        blocks.push(block);
      }
    }
  }

  return blocks;
}

function convertCodeBlock(node: TiptapCodeBlockNode): PortableTextCodeBlock {
  const code = (node.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => (c as TiptapTextNode).text)
    .join("\n");

  return {
    _type: "code",
    _key: nanoid(8),
    code,
    language: node.attrs?.language ?? undefined,
  };
}

function convertImage(node: TiptapImageNode): PortableTextImageBlock {
  const sanityRef = node.attrs["data-sanity-ref"] ?? "";
  const width = typeof node.attrs.width === "number" && node.attrs.width > 0 ? node.attrs.width : undefined;
  const height = typeof node.attrs.height === "number" && node.attrs.height > 0 ? node.attrs.height : undefined;
  return {
    _type: "image",
    _key: nanoid(8),
    asset: {
      _type: "reference",
      _ref: sanityRef || node.attrs.src,
    },
    alt: node.attrs.alt,
    width,
    height,
  };
}

function convertPoeCTABlock(node: TiptapPoeCTANode): PortableTextContent {
  // Emit as a normal block whose full text is a single cta placeholder.
  // The poetrade-dev resolveBlocks() promotes these to poeCta block type.
  const token = formatPlaceholder("cta", node.attrs.variant, node.attrs.modifier);
  const spanKey = nanoid(8);
  return {
    _type: "block",
    _key: nanoid(8),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: spanKey, text: token, marks: [] }],
  } as PortableTextBlock;
}

// ─── Inline content builders ──────────────────────────────────────────────────

interface InlineResult {
  children: PortableTextSpan[];
  markDefs: PortableTextMarkDef[];
}

function buildChildrenFromInlines(
  nodes: (TiptapTextNode | TiptapPoeInlineNode | TiptapGenericNode)[],
): InlineResult {
  const children: PortableTextSpan[] = [];
  const markDefs: PortableTextMarkDef[] = [];

  if (!nodes.length) {
    children.push(emptySpan());
    return { children, markDefs };
  }

  for (const node of nodes) {
    if (node.type === "text") {
      const spans = convertTextNode(node as TiptapTextNode, markDefs);
      children.push(...spans);
    } else if (node.type === "hardBreak") {
      children.push({ _type: "span", _key: nanoid(8), text: "\n", marks: [] });
    } else if (isPoeInlineNode(node)) {
      const span = convertPoeInlineNode(node as TiptapPoeInlineNode);
      children.push(span);
    }
    // Unknown inline nodes are silently skipped
  }

  if (!children.length) {
    children.push(emptySpan());
  }

  return { children, markDefs };
}

function convertTextNode(
  node: TiptapTextNode,
  markDefs: PortableTextMarkDef[],
): PortableTextSpan[] {
  const marks: string[] = [];

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") marks.push("strong");
    else if (mark.type === "italic") marks.push("em");
    else if (mark.type === "link") {
      // Create a linkMarkDef and reference it by key
      const linkKey = nanoid(8);
      const href =
        typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
      const blank =
        mark.attrs?.target === "_blank" ||
        mark.attrs?.blank === true;
      const def: LinkMark = {
        _type: "link",
        _key: linkKey,
        href,
        blank: blank || undefined,
      };
      markDefs.push(def);
      marks.push(linkKey);
    }
    // code, strike etc. — not in Sanity schema; drop silently
  }

  return [{ _type: "span", _key: nanoid(8), text: node.text, marks }];
}

function convertPoeInlineNode(node: TiptapPoeInlineNode): PortableTextSpan {
  // Map Tiptap node type → placeholder kind
  const kindMap: Record<TiptapPoeInlineNode["type"], string> = {
    poeItem: "item",
    poePrice: "price",
    poeCurrency: "item", // currencies are `item` kind in the poetry pipeline
    poePassive: "passive",
  };
  const kind = kindMap[node.type];
  const valueAttr = POE_INLINE_VALUE_ATTR[node.type];
  const value = (node.attrs[valueAttr] as string | undefined) ?? "";
  const modifier = (node.attrs.modifier as string | undefined) ?? undefined;
  const token = formatPlaceholder(kind, value, modifier);
  return { _type: "span", _key: nanoid(8), text: token, marks: [] };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function makeBlock(
  style: PortableTextBlock["style"],
  children: PortableTextSpan[],
  markDefs: PortableTextMarkDef[],
): PortableTextBlock {
  return {
    _type: "block",
    _key: nanoid(8),
    style,
    markDefs,
    children,
  };
}

function emptyBlock(): PortableTextBlock {
  return makeBlock("normal", [emptySpan()], []);
}

function emptySpan(): PortableTextSpan {
  return { _type: "span", _key: nanoid(8), text: "", marks: [] };
}

function isPoeInlineNode(node: TiptapGenericNode): boolean {
  return (
    node.type === "poeItem" ||
    node.type === "poePrice" ||
    node.type === "poeCurrency" ||
    node.type === "poePassive"
  );
}

/**
 * Blockquotes in Tiptap wrap content in `paragraph` nodes — we need to
 * unwrap them to get the inline nodes for a single Portable Text block.
 * If the blockquote has multiple paragraphs, they're joined with a space
 * (Sanity blockquotes are single-block by convention).
 */
function flattenBlockquoteContent(
  nodes: TiptapGenericNode[],
): (TiptapTextNode | TiptapPoeInlineNode)[] {
  const inlines: (TiptapTextNode | TiptapPoeInlineNode)[] = [];

  for (const node of nodes) {
    if (node.type === "paragraph") {
      const para = node as TiptapParagraphNode;
      inlines.push(...(para.content ?? []) as (TiptapTextNode | TiptapPoeInlineNode)[]);
    }
  }

  return inlines;
}
