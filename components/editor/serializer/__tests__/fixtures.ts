/**
 * Shared fixtures and builder helpers for the serializer round-trip test suite.
 *
 * Each builder returns a small, fully-typed snippet of either Tiptap JSON or
 * Portable Text. Using named builders instead of inline literals makes test
 * failures point at a specific fixture, and lets us compose complex docs
 * from primitives without copy-paste.
 *
 * Naming convention:
 *   tt*  — Tiptap JSON shapes
 *   pt*  — Portable Text shapes
 */

import type { TiptapDoc } from "../tiptap-to-portable";
import type {
  PortableTextContent,
  PortableTextBlock,
  PortableTextCodeBlock,
  PortableTextImageBlock,
} from "@/lib/sanity/types";

// ─── Tiptap doc builders ──────────────────────────────────────────────────────

export function ttDoc(...content: object[]): TiptapDoc {
  return { type: "doc", content: content as TiptapDoc["content"] };
}

export function ttParagraph(...content: object[]) {
  return { type: "paragraph", content };
}

export function ttHeading(level: number, ...content: object[]) {
  return { type: "heading", attrs: { level }, content };
}

export function ttBlockquote(...paragraphs: object[]) {
  return { type: "blockquote", content: paragraphs };
}

export function ttBulletList(...items: object[]) {
  return { type: "bulletList", content: items };
}

export function ttOrderedList(...items: object[]) {
  return { type: "orderedList", content: items };
}

export function ttListItem(...content: object[]) {
  return { type: "listItem", content };
}

export function ttText(text: string, ...marks: object[]) {
  if (!marks.length) return { type: "text", text };
  return { type: "text", text, marks };
}

export function ttBold(text: string) {
  return ttText(text, { type: "bold" });
}

export function ttItalic(text: string) {
  return ttText(text, { type: "italic" });
}

export function ttLink(text: string, href: string, blank?: boolean) {
  const attrs: Record<string, unknown> = { href };
  if (blank) attrs.target = "_blank";
  return ttText(text, { type: "link", attrs });
}

export function ttCodeBlock(code: string, language = "") {
  return {
    type: "codeBlock",
    attrs: { language },
    content: [{ type: "text", text: code }],
  };
}

export function ttImage(sanityRef: string, alt?: string) {
  return {
    type: "image",
    attrs: { src: sanityRef, alt, "data-sanity-ref": sanityRef },
  };
}

export function ttPoeItem(value: string, modifier?: string) {
  return { type: "poeItem", attrs: { itemName: value, modifier } };
}

export function ttPoePrice(value: string, modifier?: string) {
  return { type: "poePrice", attrs: { itemName: value, modifier } };
}

export function ttPoeCTA(variant: string, modifier?: string) {
  return { type: "poeCta", attrs: { variant, modifier } };
}

// ─── Portable Text builders ───────────────────────────────────────────────────

export function ptBlock(
  style: PortableTextBlock["style"],
  children: object[],
  markDefs: object[] = [],
  extra: Partial<PortableTextBlock> = {},
): PortableTextContent {
  return {
    _type: "block",
    _key: "test-key",
    style,
    markDefs,
    children,
    ...extra,
  } as unknown as PortableTextContent;
}

export function ptNormal(children: object[], markDefs: object[] = []) {
  return ptBlock("normal", children, markDefs);
}

export function ptHeading(level: 1 | 2 | 3 | 4, children: object[]) {
  return ptBlock(`h${level}` as "h1" | "h2" | "h3" | "h4", children);
}

export function ptBlockquote(children: object[]) {
  return ptBlock("blockquote", children);
}

export function ptListItem(
  listItem: "bullet" | "number",
  level: number,
  children: object[],
) {
  return ptBlock("normal", children, [], { listItem, level } as Partial<PortableTextBlock>);
}

export function ptSpan(text: string, marks: string[] = []) {
  return { _type: "span", _key: "test-span-key", text, marks };
}

export function ptLinkDef(key: string, href: string, blank = false) {
  return { _type: "link", _key: key, href, blank: blank || undefined };
}

export function ptCode(code: string, language?: string): PortableTextContent {
  return {
    _type: "code",
    _key: "test-code-key",
    code,
    language,
  } as PortableTextCodeBlock;
}

export function ptImage(ref: string, alt?: string): PortableTextContent {
  return {
    _type: "image",
    _key: "test-image-key",
    asset: { _type: "reference", _ref: ref },
    alt,
  } as PortableTextImageBlock;
}
