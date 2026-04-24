/**
 * Round-trip tests Part 2: serializer round-trips 7–17 + PT→Tiptap one-way cases.
 *
 * Covers: code blocks, images, poeItem/poePrice/poeCta nodes, mixed paragraphs,
 * the complex full-doc case, regression tests, and edge cases (multi-word
 * placeholder values, sequential placeholders in a single span).
 *
 * Part 1 (placeholder helpers + round-trips 1–6): round-trip.test.ts
 */

import { describe, it, expect } from "vitest";
import { tiptapToPortable } from "../tiptap-to-portable";
import { portableToTiptap } from "../portable-to-tiptap";
import { parsePlaceholders } from "../placeholders";
import {
  ttDoc,
  ttParagraph,
  ttHeading,
  ttBulletList,
  ttListItem,
  ttText,
  ttBold,
  ttCodeBlock,
  ttImage,
  ttPoeItem,
  ttPoePrice,
  ttPoeCTA,
  ptListItem,
  ptSpan,
  ptCode,
  ptImage,
} from "./fixtures";
import type { PortableTextBlock } from "@/lib/sanity/types";

// ─── Round-trip 7: code block ─────────────────────────────────────────────────

describe("round-trip: 7 — code block with language", () => {
  it("serializes code block with language", () => {
    const doc = ttDoc(ttCodeBlock('console.log("hi")', "javascript"));
    const pt = tiptapToPortable(doc);

    expect(pt[0]._type).toBe("code");
    const codeBlock = pt[0] as { _type: string; code: string; language: string };
    expect(codeBlock.code).toBe('console.log("hi")');
    expect(codeBlock.language).toBe("javascript");

    const back = portableToTiptap(pt);
    const node = back.content?.[0] as {
      type: string;
      attrs: { language: string };
      content: { text: string }[];
    };
    expect(node.type).toBe("codeBlock");
    expect(node.attrs.language).toBe("javascript");
    expect(node.content[0].text).toBe('console.log("hi")');
  });

  it("handles code block without language", () => {
    const doc = ttDoc(ttCodeBlock("def foo():\n    pass", ""));
    const pt = tiptapToPortable(doc);
    const back = portableToTiptap(pt);
    const node = back.content?.[0] as { attrs: { language: string } };
    expect(node.attrs.language).toBe("");
  });
});

// ─── Round-trip 8: image ──────────────────────────────────────────────────────

describe("round-trip: 8 — image block with asset ref", () => {
  it("serializes image with Sanity asset ref", () => {
    const ref = "image-abc123-300x200-jpg";
    const doc = ttDoc(ttImage(ref, "A screenshot"));
    const pt = tiptapToPortable(doc);

    expect(pt[0]._type).toBe("image");
    const imgBlock = pt[0] as { asset: { _ref: string }; alt?: string };
    expect(imgBlock.asset._ref).toBe(ref);
    expect(imgBlock.alt).toBe("A screenshot");

    const back = portableToTiptap(pt);
    const node = back.content?.[0] as {
      type: string;
      attrs: { "data-sanity-ref": string; alt?: string };
    };
    expect(node.type).toBe("image");
    expect(node.attrs["data-sanity-ref"]).toBe(ref);
  });
});

// ─── Round-trip 9: poeItem without modifier ───────────────────────────────────

describe("round-trip: 9 — poeItem inline (no modifier)", () => {
  it("serializes poeItem as {{item:Name}} placeholder in span", () => {
    const doc = ttDoc(ttParagraph(ttPoeItem("Divine Orb")));
    const pt = tiptapToPortable(doc);

    const block = pt[0] as PortableTextBlock;
    expect(block.children[0].text).toBe("{{item:Divine Orb}}");

    // Round-trip: placeholder parsed back into poeItem node
    const back = portableToTiptap(pt);
    const para = back.content?.[0] as {
      content: { type: string; attrs: { itemName: string } }[];
    };
    expect(para.content[0].type).toBe("poeItem");
    expect(para.content[0].attrs.itemName).toBe("Divine Orb");
  });
});

// ─── Round-trip 10: poeItem with modifier ─────────────────────────────────────

describe("round-trip: 10 — poeItem with modifier", () => {
  it("serializes poeItem with modifier as {{item:Name|mod}}", () => {
    const doc = ttDoc(ttParagraph(ttPoeItem("Mageblood", "poe2")));
    const pt = tiptapToPortable(doc);

    const block = pt[0] as PortableTextBlock;
    expect(block.children[0].text).toBe("{{item:Mageblood|poe2}}");

    const back = portableToTiptap(pt);
    const node = (
      back.content?.[0] as {
        content: { attrs: { itemName: string; modifier?: string } }[];
      }
    ).content[0];
    expect(node.attrs.itemName).toBe("Mageblood");
    expect(node.attrs.modifier).toBe("poe2");
  });
});

// ─── Round-trip 11: poePrice ──────────────────────────────────────────────────

describe("round-trip: 11 — poePrice inline", () => {
  it("serializes poePrice as {{price:Name|mod}} placeholder", () => {
    const doc = ttDoc(ttParagraph(ttPoePrice("Divine Orb", "chaos")));
    const pt = tiptapToPortable(doc);

    const block = pt[0] as PortableTextBlock;
    expect(block.children[0].text).toBe("{{price:Divine Orb|chaos}}");

    const back = portableToTiptap(pt);
    const node = (
      back.content?.[0] as {
        content: { type: string; attrs: { itemName: string } }[];
      }
    ).content[0];
    expect(node.type).toBe("poePrice");
    expect(node.attrs.itemName).toBe("Divine Orb");
  });
});

// ─── Round-trip 12: poeCta ────────────────────────────────────────────────────

describe("round-trip: 12 — poeCta block-level", () => {
  it("serializes poeCta as a block whose text is {{cta:variant|mod}}", () => {
    const doc = ttDoc(ttPoeCTA("currency", "poe2"));
    const pt = tiptapToPortable(doc);

    const block = pt[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.children[0].text).toBe("{{cta:currency|poe2}}");
  });

  it("round-trips a poeCta block from Sanity Studio", () => {
    // Blocks emitted by resolveBlocks() as _type:'poeCta' should come back as poeCta nodes
    const ctaBlock = {
      _type: "poeCta",
      _key: "cta-abc",
      variant: "currency",
      gameVersion: "path-of-exile-2",
    } as unknown as import("@/lib/sanity/types").PortableTextContent;

    const back = portableToTiptap([ctaBlock]);
    const node = back.content?.[0] as { type: string; attrs: { variant: string } };
    expect(node.type).toBe("poeCta");
    expect(node.attrs.variant).toBe("currency");
  });
});

// ─── Round-trip 13: mixed inline nodes ───────────────────────────────────────

describe("round-trip: 13 — mixed: bold + poeItem + plain + poePrice", () => {
  it("preserves all inline node types in one paragraph", () => {
    const doc = ttDoc(
      ttParagraph(
        ttBold("Price of "),
        ttPoeItem("Divine Orb"),
        ttText(" is "),
        ttPoePrice("Divine Orb", "chaos"),
      ),
    );

    const pt = tiptapToPortable(doc);
    const block = pt[0] as PortableTextBlock;

    expect(block.children).toHaveLength(4);
    expect(block.children[0].marks).toContain("strong");
    expect(block.children[1].text).toBe("{{item:Divine Orb}}");
    expect(block.children[2].text).toBe(" is ");
    expect(block.children[3].text).toBe("{{price:Divine Orb|chaos}}");

    const back = portableToTiptap(pt);
    const para = back.content?.[0] as {
      content: { type: string; attrs?: { value: string } }[];
    };
    expect(para.content[0].type).toBe("text");
    expect(para.content[1].type).toBe("poeItem");
    expect(para.content[2].type).toBe("text");
    expect(para.content[3].type).toBe("poePrice");
  });
});

// ─── Round-trip 14: complex doc ───────────────────────────────────────────────

describe("round-trip: 14 — complex doc (paragraph + h2 + list + code + image + cta)", () => {
  it("round-trips a realistic multi-block document", () => {
    const doc = ttDoc(
      ttParagraph(ttText("Introduction")),
      ttHeading(2, ttText("Section")),
      ttBulletList(
        ttListItem(ttParagraph(ttText("Point A"))),
        ttListItem(ttParagraph(ttText("Point B"))),
      ),
      ttCodeBlock("const x = 1;", "javascript"),
      ttImage("image-xyz-100x100-png"),
      ttPoeCTA("currency"),
    );

    const pt = tiptapToPortable(doc);
    // 1 para + 1 h2 + 2 list items + 1 code + 1 image + 1 cta paragraph
    expect(pt).toHaveLength(7);
    expect((pt[0] as PortableTextBlock).style).toBe("normal");
    expect((pt[1] as PortableTextBlock).style).toBe("h2");
    expect((pt[2] as PortableTextBlock).listItem).toBe("bullet");
    expect((pt[3] as PortableTextBlock).listItem).toBe("bullet");
    expect(pt[4]._type).toBe("code");
    expect(pt[5]._type).toBe("image");
    expect((pt[6] as PortableTextBlock)._type).toBe("block");
    expect((pt[6] as PortableTextBlock).children[0].text).toBe("{{cta:currency}}");

    const back = portableToTiptap(pt);
    const types = (back.content ?? []).map((n) => (n as { type: string }).type);
    expect(types[0]).toBe("paragraph");
    expect(types[1]).toBe("heading");
    expect(types[2]).toBe("bulletList");
    expect(types[3]).toBe("codeBlock");
    expect(types[4]).toBe("image");
  });
});

// ─── Regression 15: no false placeholder matches ──────────────────────────────

describe("regression: 15 — plain text without placeholders", () => {
  it("does not false-match placeholder regex on normal text", () => {
    const doc = ttDoc(ttParagraph(ttText("Buy currency now for profit")));
    const pt = tiptapToPortable(doc);
    const back = portableToTiptap(pt);

    const para = back.content?.[0] as {
      content: { type: string; text: string }[];
    };
    // Must be a single text node — not split on the word "currency"
    expect(para.content[0].type).toBe("text");
    expect(para.content[0].text).toBe("Buy currency now for profit");
  });

  it("handles text with single braces that look like placeholders", () => {
    const doc = ttDoc(ttParagraph(ttText("Use {shorthand} here")));
    const pt = tiptapToPortable(doc);
    const back = portableToTiptap(pt);

    const para = back.content?.[0] as { content: { type: string; text: string }[] };
    expect(para.content[0].text).toBe("Use {shorthand} here");
  });
});

// ─── Edge 16: multi-word placeholder values ───────────────────────────────────

describe("edge: 16 — placeholder with spaces in value", () => {
  it("round-trips multi-word placeholder value", () => {
    const doc = ttDoc(ttParagraph(ttPoeItem("Divine Orb")));
    const pt = tiptapToPortable(doc);

    const block = pt[0] as PortableTextBlock;
    // Spaces in value must be preserved exactly in the token
    expect(block.children[0].text).toBe("{{item:Divine Orb}}");

    const phs = parsePlaceholders(block.children[0].text);
    expect(phs[0].value).toBe("Divine Orb");
  });

  it("round-trips multi-word value with apostrophe", () => {
    const doc = ttDoc(ttParagraph(ttPoeItem("Kaom's Heart")));
    const pt = tiptapToPortable(doc);
    const block = pt[0] as PortableTextBlock;
    expect(block.children[0].text).toBe("{{item:Kaom's Heart}}");

    const back = portableToTiptap(pt);
    const node = (
      back.content?.[0] as { content: { attrs: { itemName: string } }[] }
    ).content[0];
    expect(node.attrs.itemName).toBe("Kaom's Heart");
  });
});

// ─── Edge 17: multiple sequential placeholders ───────────────────────────────

describe("edge: 17 — multiple sequential placeholders in same span", () => {
  it("splits multiple placeholders within one Portable Text span", () => {
    const ptBlocks = [
      {
        _type: "block" as const,
        _key: "test",
        style: "normal" as const,
        markDefs: [],
        children: [
          {
            _type: "span" as const,
            _key: "span1",
            text: "{{item:Divine Orb}}{{price:Chaos Orb|chaos}}",
            marks: [] as string[],
          },
        ],
      },
    ];

    const back = portableToTiptap(ptBlocks);
    const para = back.content?.[0] as {
      content: { type: string; attrs: { itemName: string } }[];
    };
    expect(para.content).toHaveLength(2);
    expect(para.content[0].type).toBe("poeItem");
    expect(para.content[0].attrs.itemName).toBe("Divine Orb");
    expect(para.content[1].type).toBe("poePrice");
    expect(para.content[1].attrs.itemName).toBe("Chaos Orb");
  });

  it("splits span with text before, between, and after two placeholders", () => {
    const ptBlocks = [
      {
        _type: "block" as const,
        _key: "test",
        style: "normal" as const,
        markDefs: [],
        children: [
          {
            _type: "span" as const,
            _key: "span1",
            text: "Buy {{item:Divine Orb}} and {{item:Chaos Orb}} now",
            marks: [] as string[],
          },
        ],
      },
    ];

    const back = portableToTiptap(ptBlocks);
    const para = back.content?.[0] as {
      content: { type: string; text?: string }[];
    };
    // Expected: "Buy " + poeItem + " and " + poeItem + " now"
    expect(para.content).toHaveLength(5);
    expect(para.content[0].type).toBe("text");
    expect(para.content[0].text).toBe("Buy ");
    expect(para.content[1].type).toBe("poeItem");
    expect(para.content[2].type).toBe("text");
    expect(para.content[2].text).toBe(" and ");
    expect(para.content[3].type).toBe("poeItem");
    expect(para.content[4].type).toBe("text");
    expect(para.content[4].text).toBe(" now");
  });
});

// ─── PT → Tiptap one-way cases ───────────────────────────────────────────────

describe("round-trip: PT → Tiptap one-way cases", () => {
  it("converts block listItem from Portable Text to bulletList", () => {
    const pt = [
      ptListItem("bullet", 1, [ptSpan("First")]),
      ptListItem("bullet", 1, [ptSpan("Second")]),
    ];

    const back = portableToTiptap(pt);
    const list = back.content?.[0] as { type: string; content: { type: string }[] };
    expect(list.type).toBe("bulletList");
    expect(list.content).toHaveLength(2);
  });

  it("converts Portable Text code block", () => {
    const pt = [ptCode("print('hello')", "python")];
    const back = portableToTiptap(pt);
    const node = back.content?.[0] as {
      type: string;
      attrs: { language: string };
      content: { text: string }[];
    };
    expect(node.type).toBe("codeBlock");
    expect(node.attrs.language).toBe("python");
    expect(node.content[0].text).toBe("print('hello')");
  });

  it("converts Portable Text image block", () => {
    const pt = [ptImage("image-ref-100x100-jpg", "Alt text")];
    const back = portableToTiptap(pt);
    const node = back.content?.[0] as {
      type: string;
      attrs: { "data-sanity-ref": string; alt?: string };
    };
    expect(node.type).toBe("image");
    expect(node.attrs["data-sanity-ref"]).toBe("image-ref-100x100-jpg");
  });

  it("converts Portable Text link markDef", () => {
    const pt: import("@/lib/sanity/types").PortableTextContent[] = [
      {
        _type: "block" as const,
        _key: "b1",
        style: "normal" as const,
        markDefs: [{ _type: "link" as const, _key: "lk1", href: "https://poe.com", blank: true }],
        children: [{ _type: "span" as const, _key: "s1", text: "Visit", marks: ["lk1"] }],
      },
    ];

    const back = portableToTiptap(pt);
    const para = back.content?.[0] as {
      content: { type: string; marks?: { type: string; attrs: { href: string } }[] }[];
    };
    const textNode = para.content[0];
    expect(textNode.type).toBe("text");
    expect(textNode.marks?.[0].type).toBe("link");
    expect(textNode.marks?.[0].attrs.href).toBe("https://poe.com");
  });
});
