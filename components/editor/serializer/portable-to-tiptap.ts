/**
 * Converts Sanity Portable Text blocks back to a Tiptap editor JSON document.
 * One-way: PortableTextContent[] → TiptapDoc.
 *
 * Design intent:
 * - Pure function — no side effects, no I/O, deterministic.
 * - Inverse of tiptap-to-portable.ts. Round-trip should be lossless for the
 *   content types the schema supports.
 * - Placeholder detection: span texts are scanned for `{{kind:value|mod}}`
 *   tokens. Matches are split into custom inline Tiptap nodes; surrounding
 *   plain text becomes regular text nodes.
 * - Nested list consolidation: sequential `block.listItem` entries with the
 *   same level are grouped into a single bulletList/orderedList node.
 *
 * TODO: move TiptapDoc back-reference to components/editor/types.ts when
 * S08.b completes that file.
 */

import { splitByPlaceholders } from "./placeholders";
import { imageUrlFor } from "@/lib/sanity/image-url";
import type {
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDef,
  PortableTextImageBlock,
  PortableTextCodeBlock,
  PoeItemBlock,
} from "@/lib/sanity/types";
import type { TiptapDoc } from "./tiptap-to-portable";

// ─── Tiptap node shapes (mirrors tiptap-to-portable, keep in sync) ───────────

interface TiptapTextNode {
  type: "text";
  text: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

interface TiptapPoeInlineNode {
  type: "poeItem" | "poePrice" | "poeCurrency" | "poePassive";
  // Attr name varies by node type — see POE_INLINE_VALUE_ATTR.
  attrs: Record<string, string | null | undefined>;
}

/** Inverse of the same table in tiptap-to-portable.ts. */
const POE_INLINE_VALUE_ATTR: Record<TiptapPoeInlineNode["type"], string> = {
  poeItem: "itemName",
  poePrice: "itemName",
  poeCurrency: "currencyName",
  poePassive: "passiveName",
};

interface TiptapParagraphNode {
  type: "paragraph";
  content: (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[];
}

interface TiptapHeadingNode {
  type: "heading";
  attrs: { level: number };
  content: (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[];
}

interface TiptapHardBreakNode {
  type: "hardBreak";
}

interface TiptapBlockquoteNode {
  type: "blockquote";
  content: TiptapParagraphNode[];
}

interface TiptapListItemNode {
  type: "listItem";
  content: (TiptapParagraphNode | TiptapListNode)[];
}

interface TiptapListNode {
  type: "bulletList" | "orderedList";
  content: TiptapListItemNode[];
}

interface TiptapCodeBlockNode {
  type: "codeBlock";
  attrs: { language: string };
  content: TiptapTextNode[];
}

interface TiptapImageNode {
  type: "image";
  attrs: {
    src: string;
    alt?: string;
    "data-sanity-ref"?: string;
    width?: number;
    height?: number;
  };
}

interface TiptapPoeCTANode {
  type: "poeCta";
  attrs: { variant: string; modifier?: string };
}

type TiptapTopNode =
  | TiptapParagraphNode
  | TiptapHeadingNode
  | TiptapBlockquoteNode
  | TiptapListNode
  | TiptapCodeBlockNode
  | TiptapImageNode
  | TiptapPoeCTANode;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert Sanity Portable Text blocks to a Tiptap document.
 *
 * @example
 * const doc = portableToTiptap(post.body)
 * editor.commands.setContent(doc)
 */
export function portableToTiptap(blocks: PortableTextContent[]): TiptapDoc {
  if (!blocks.length) return { type: "doc", content: [] };

  const content: TiptapTopNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (isListBlock(block)) {
      // Consume a run of consecutive list blocks at the same list type
      const { nodes, consumed } = consumeListBlocks(blocks, i);
      content.push(...nodes);
      i += consumed;
      continue;
    }

    const node = convertBlock(block);
    if (node) content.push(node);
    i++;
  }

  return { type: "doc", content };
}

// ─── Block dispatchers ────────────────────────────────────────────────────────

function convertBlock(block: PortableTextContent): TiptapTopNode | null {
  switch (block._type) {
    case "block":
      return convertTextBlock(block as PortableTextBlock);
    case "image":
      return convertImageBlock(block as PortableTextImageBlock);
    case "code":
      return convertCodeBlockNode(block as PortableTextCodeBlock);
    case "poeItem":
      // Block-level poeItem (Sanity Studio direct insert) → paragraph with token
      return convertPoeItemBlock(block as PoeItemBlock);
    default:
      // poeCta and unknown custom types — attempt cta detection or skip
      return tryConvertCustomBlock(block);
  }
}

// ─── Text block conversion ────────────────────────────────────────────────────

function convertTextBlock(block: PortableTextBlock): TiptapTopNode {
  const markDefsMap = buildMarkDefsMap(block.markDefs ?? []);

  if (block.style === "blockquote") {
    const inlines = convertChildren(block.children, markDefsMap);
    return { type: "blockquote", content: [{ type: "paragraph", content: inlines }] };
  }

  const headingLevel = extractHeadingLevel(block.style);
  if (headingLevel !== null) {
    const inlines = convertChildren(block.children, markDefsMap);
    return { type: "heading", attrs: { level: headingLevel }, content: inlines };
  }

  // Normal paragraph (listItem blocks are handled by consumeListBlocks caller)
  const inlines = convertChildren(block.children, markDefsMap);
  return { type: "paragraph", content: inlines };
}

function extractHeadingLevel(style: string): number | null {
  const match = style.match(/^h([1-4])$/);
  return match ? parseInt(match[1], 10) : null;
}

// ─── Children / spans ─────────────────────────────────────────────────────────

function buildMarkDefsMap(defs: PortableTextMarkDef[]): Map<string, PortableTextMarkDef> {
  const map = new Map<string, PortableTextMarkDef>();
  for (const def of defs) map.set(def._key, def);
  return map;
}

function convertChildren(
  spans: PortableTextSpan[],
  markDefsMap: Map<string, PortableTextMarkDef>,
): (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[] {
  const result: (TiptapTextNode | TiptapPoeInlineNode | TiptapHardBreakNode)[] = [];

  for (const span of spans) {
    if (span._type !== "span") continue;

    const tiptapMarks = resolveSpanMarks(span.marks, markDefsMap);
    const lines = span.text.split("\n");

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const segments = splitByPlaceholders(line);

      for (const seg of segments) {
        if (seg.type === "text") {
          if (seg.text) result.push(makeTextNode(seg.text, tiptapMarks));
        } else {
          // Placeholder segment — convert to custom inline node
          const ph = seg.placeholder;
          const node = placeholderToInlineNode(ph.kind, ph.value, ph.modifier);
          if (node) {
            result.push(node);
          } else {
            // Unknown kind — preserve as text
            result.push(makeTextNode(ph.raw, tiptapMarks));
          }
        }
      }

      // Add hardBreak for newlines within a span
      if (l < lines.length - 1) {
        result.push({ type: "hardBreak" });
      }
    }
  }

  return result;
}

function resolveSpanMarks(
  marks: string[],
  markDefsMap: Map<string, PortableTextMarkDef>,
): { type: string; attrs?: Record<string, unknown> }[] {
  const tiptapMarks: { type: string; attrs?: Record<string, unknown> }[] = [];

  for (const mark of marks) {
    if (mark === "strong") {
      tiptapMarks.push({ type: "bold" });
    } else if (mark === "em") {
      tiptapMarks.push({ type: "italic" });
    } else {
      // Might be a markDef key
      const def = markDefsMap.get(mark);
      if (def?._type === "link") {
        tiptapMarks.push({
          type: "link",
          attrs: { href: def.href, target: def.blank ? "_blank" : undefined },
        });
      }
      // poeItem mark annotations (from resolveBlocks) are not re-inflated here
      // since the hub emits raw {{...}} placeholders, not poeItem marks.
    }
  }

  return tiptapMarks;
}

function makeTextNode(
  text: string,
  marks: { type: string; attrs?: Record<string, unknown> }[],
): TiptapTextNode {
  if (!marks.length) return { type: "text", text };
  return { type: "text", text, marks };
}

// ─── Placeholder → Tiptap inline node ────────────────────────────────────────

const PLACEHOLDER_KIND_TO_NODE: Record<string, TiptapPoeInlineNode["type"]> = {
  item: "poeItem",
  price: "poePrice",
  passive: "poePassive",
};

function placeholderToInlineNode(
  kind: string,
  value: string,
  modifier?: string,
): TiptapPoeInlineNode | null {
  const nodeType = PLACEHOLDER_KIND_TO_NODE[kind];
  if (!nodeType) return null;
  const valueAttr = POE_INLINE_VALUE_ATTR[nodeType];
  const attrs: Record<string, string | undefined> = { [valueAttr]: value };
  if (modifier) attrs.modifier = modifier;
  return { type: nodeType, attrs };
}

// ─── List consolidation ────────────────────────────────────────────────────────

function isListBlock(block: PortableTextContent): boolean {
  return block._type === "block" && !!(block as PortableTextBlock).listItem;
}

/**
 * Consume a sequential run of listItem blocks, building nested
 * bulletList/orderedList Tiptap nodes that mirror the `level` structure.
 *
 * Portable Text represents each list item as a flat block with `listItem`
 * and `level`; Tiptap expects a tree of list/listItem nodes. We rebuild the
 * tree greedily based on consecutive runs.
 */
function consumeListBlocks(
  blocks: PortableTextContent[],
  startIdx: number,
): { nodes: TiptapListNode[]; consumed: number } {
  // Collect the contiguous run of list blocks
  const run: PortableTextBlock[] = [];
  let j = startIdx;

  while (j < blocks.length && isListBlock(blocks[j])) {
    run.push(blocks[j] as PortableTextBlock);
    j++;
  }

  // Group into top-level lists, each top-level item at level 1
  // Consecutive items of the same listItem kind + level 1 belong to the same list.
  const nodes: TiptapListNode[] = [];
  let k = 0;

  while (k < run.length) {
    const first = run[k];
    const listKind = first.listItem!;
    const nodeType: "bulletList" | "orderedList" =
      listKind === "bullet" ? "bulletList" : "orderedList";
    const items: TiptapListItemNode[] = [];
    const baseLevel = first.level ?? 1;

    while (k < run.length && run[k].listItem === listKind) {
      const block = run[k];
      const level = block.level ?? 1;

      if (level > baseLevel) {
        // Attach as nested list to the last listItem
        const last = items[items.length - 1];
        if (last) {
          const { nodes: nested, consumed } = buildNestedList(run, k, listKind, level);
          last.content.push(...nested);
          k += consumed;
        } else {
          k++;
        }
        continue;
      }

      const markDefsMap = buildMarkDefsMap(block.markDefs ?? []);
      const inlines = convertChildren(block.children, markDefsMap);
      items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inlines }],
      });
      k++;
    }

    nodes.push({ type: nodeType, content: items });
  }

  return { nodes, consumed: j - startIdx };
}

function buildNestedList(
  run: PortableTextBlock[],
  startIdx: number,
  listKind: "bullet" | "number",
  targetLevel: number,
): { nodes: TiptapListNode[]; consumed: number } {
  const nodeType: "bulletList" | "orderedList" =
    listKind === "bullet" ? "bulletList" : "orderedList";
  const items: TiptapListItemNode[] = [];
  let k = startIdx;

  while (k < run.length && (run[k].level ?? 1) >= targetLevel) {
    const block = run[k];
    const level = block.level ?? 1;
    if (level > targetLevel) {
      // Deeper nesting — recurse
      const last = items[items.length - 1];
      if (last) {
        const { nodes: nested, consumed } = buildNestedList(run, k, listKind, level);
        last.content.push(...nested);
        k += consumed;
      } else {
        k++;
      }
      continue;
    }
    const markDefsMap = buildMarkDefsMap(block.markDefs ?? []);
    const inlines = convertChildren(block.children, markDefsMap);
    items.push({
      type: "listItem",
      content: [{ type: "paragraph", content: inlines }],
    });
    k++;
  }

  return { nodes: [{ type: nodeType, content: items }], consumed: k - startIdx };
}

// ─── Non-block top-level types ────────────────────────────────────────────────

function convertImageBlock(block: PortableTextImageBlock): TiptapImageNode {
  const ref = block.asset._ref;
  // The src must be a renderable URL — Tiptap puts it straight into <img src>.
  // Build the CDN URL from the asset ref; if the ref is malformed for any
  // reason, fall back to the raw value so at least nothing crashes.
  let src = ref;
  try {
    src = imageUrlFor({ asset: { _ref: ref, _type: "reference" } } as Parameters<typeof imageUrlFor>[0])
      .auto("format")
      .url();
  } catch {
    // imageUrlFor throws on malformed refs — keep src=ref as a last resort.
  }
  return {
    type: "image",
    attrs: {
      src,
      alt: block.alt,
      "data-sanity-ref": ref,
      width: block.width,
      height: block.height,
    },
  };
}

function convertCodeBlockNode(block: PortableTextCodeBlock): TiptapCodeBlockNode {
  return {
    type: "codeBlock",
    attrs: { language: block.language ?? "" },
    content: [{ type: "text", text: block.code }],
  };
}

function convertPoeItemBlock(block: PoeItemBlock): TiptapParagraphNode {
  // A block-level poeItem in Sanity Studio → paragraph with raw text as content.
  // The rawText is the game's Ctrl+C clipboard text, not a placeholder token.
  return {
    type: "paragraph",
    content: [{ type: "text", text: block.rawText }],
  };
}

function tryConvertCustomBlock(block: PortableTextContent): TiptapPoeCTANode | null {
  // Detect poeCta blocks written by older resolveBlocks() passes or direct
  // Sanity Studio edits. These have _type === 'poeCta'. Cast to unknown first
  // because PortableTextContent union doesn't include 'poeCta' — it's a runtime
  // custom block type that Sanity allows despite the schema not listing it.
  const b = block as unknown as Record<string, unknown>;
  if (b["_type"] === "poeCta") {
    return {
      type: "poeCta",
      attrs: {
        variant: typeof b.variant === "string" ? b.variant : "currency",
        modifier: typeof b.modifier === "string" ? b.modifier : undefined,
      },
    };
  }
  return null;
}
