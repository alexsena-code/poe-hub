/**
 * Tests for markdownToPortableText (Session 11.b — @portabletext/block-tools path).
 *
 * Tests verify invariants, NOT snapshots — _key values are randomly generated
 * so we assert structure and content rather than exact objects.
 *
 * Key behavioural differences from old remark-based converter:
 * - h5/h6 clamp to h4 via custom deserialize rule (old: clamped in convertHeading).
 * - ordered lists emit `listItem:'number'` because schema now includes 'number'.
 * - inline code preserves `code` mark (schema decorator added).
 * - thematicBreak (`---`) → 0 blocks (htmlToBlocks ignores <hr> — same as old).
 * - Inline images → empty paragraph (block-tools emits an empty span block; old
 *   converter emitted alt text as '[alt]' span). We assert it's skipped or empty.
 *
 * Session 11.b.
 */

import { describe, it, expect } from "vitest";
import { markdownToPortableText } from "../markdown-to-portable";
import type { PortableTextBlock, PortableTextCodeBlock } from "@/lib/sanity/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Filter output to blocks of a specific _type. */
function findBlocks<T = PortableTextBlock>(
  out: ReturnType<typeof markdownToPortableText>,
  type: string,
): T[] {
  return out.filter((b) => b._type === type) as T[];
}

/** Concatenate all span text from a PortableTextBlock. */
function spanText(block: PortableTextBlock): string {
  return block.children.map((s) => s.text).join("");
}

/** Assert every block and every span has a non-empty _key. */
function assertAllHaveKey(out: ReturnType<typeof markdownToPortableText>): void {
  for (const block of out) {
    expect(block._key, `block missing _key: ${JSON.stringify(block)}`).toBeTruthy();
    if (block._type === "block") {
      const b = block as PortableTextBlock;
      for (const span of b.children) {
        expect(span._key, `span missing _key in block ${block._key}`).toBeTruthy();
      }
    }
  }
}

/** Allowed block _type values in the schema declared by this converter. */
const ALLOWED_TYPES = new Set(["block", "image", "code"]);

/** Assert no block uses a custom PoE-specific type (regression for session-10 bug). */
function assertNoCustomPoeTypes(out: ReturnType<typeof markdownToPortableText>): void {
  const forbidden = ["poeCurrency", "poePassive", "poeItem", "poeCta", "poePrice"];
  for (const block of out) {
    for (const type of forbidden) {
      expect(block._type).not.toBe(type);
    }
  }
}

// ─── 1. Empty input ───────────────────────────────────────────────────────────

describe("empty input", () => {
  it("returns [] for empty string", () => {
    expect(markdownToPortableText("")).toEqual([]);
  });

  it("returns [] for whitespace-only string", () => {
    expect(markdownToPortableText("   \n  \t  ")).toEqual([]);
  });
});

// ─── 2. Headings ──────────────────────────────────────────────────────────────

describe("headings", () => {
  it("h1 → style:'h1' with correct text", () => {
    const out = markdownToPortableText("# Hello World");
    expect(out).toHaveLength(1);
    const block = out[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("h1");
    expect(spanText(block)).toBe("Hello World");
    expect(block.children.length).toBeGreaterThanOrEqual(1);
  });

  it("h2 → style:'h2'", () => {
    const block = markdownToPortableText("## Section")[0] as PortableTextBlock;
    expect(block.style).toBe("h2");
  });

  it("h3 → style:'h3'", () => {
    const block = markdownToPortableText("### Sub")[0] as PortableTextBlock;
    expect(block.style).toBe("h3");
  });

  it("h4 → style:'h4'", () => {
    const block = markdownToPortableText("#### Sub4")[0] as PortableTextBlock;
    expect(block.style).toBe("h4");
  });

  it("h5 is clamped to h4 via custom rule", () => {
    const block = markdownToPortableText("##### Too Deep")[0] as PortableTextBlock;
    expect(block.style).toBe("h4");
  });

  it("h6 is clamped to h4 via custom rule", () => {
    const block = markdownToPortableText("###### Way Too Deep")[0] as PortableTextBlock;
    expect(block.style).toBe("h4");
  });

  it("four heading levels in sequence → 4 blocks with correct styles", () => {
    const out = markdownToPortableText("# H1\n\n## H2\n\n### H3\n\n#### H4");
    const blocks = findBlocks(out, "block");
    expect(blocks[0].style).toBe("h1");
    expect(blocks[1].style).toBe("h2");
    expect(blocks[2].style).toBe("h3");
    expect(blocks[3].style).toBe("h4");
  });
});

// ─── 3. Paragraph ─────────────────────────────────────────────────────────────

describe("paragraph", () => {
  it("plain paragraph → style:'normal', span with correct text, marks:[]", () => {
    const out = markdownToPortableText("This is a paragraph.");
    expect(out).toHaveLength(1);
    const block = out[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("normal");
    expect(spanText(block)).toBe("This is a paragraph.");
    const allMarksEmpty = block.children.every((s) => s.marks.length === 0);
    expect(allMarksEmpty).toBe(true);
  });

  it("bold text → span with mark:'strong'", () => {
    const block = markdownToPortableText("Buy **Divine Orb** now.")[0] as PortableTextBlock;
    const boldSpan = block.children.find((s) => s.marks.includes("strong"));
    expect(boldSpan).toBeDefined();
    expect(boldSpan?.text).toBe("Divine Orb");
  });

  it("italic text → span with mark:'em'", () => {
    const block = markdownToPortableText("*important* info")[0] as PortableTextBlock;
    const italicSpan = block.children.find((s) => s.marks.includes("em"));
    expect(italicSpan).toBeDefined();
    expect(italicSpan?.text).toBe("important");
  });

  it("inline code → span with mark:'code'", () => {
    const block = markdownToPortableText("Run `npm install` here.")[0] as PortableTextBlock;
    const codeSpan = block.children.find((s) => s.marks.includes("code"));
    expect(codeSpan?.text).toBe("npm install");
  });
});

// ─── 4. Links ─────────────────────────────────────────────────────────────────

describe("link", () => {
  it("link → markDef with correct href, span references the markDef _key", () => {
    const out = markdownToPortableText("[Path of Exile](https://pathofexile.com)");
    const block = out[0] as PortableTextBlock;
    expect(block.markDefs).toHaveLength(1);
    const def = block.markDefs[0];
    expect(def._type).toBe("link");
    // Narrow to access href
    const href = (def as { _type: string; _key: string; href: string }).href;
    expect(href).toBe("https://pathofexile.com");
    const linkSpan = block.children.find((s) => s.marks.includes(def._key));
    expect(linkSpan?.text).toBe("Path of Exile");
  });
});

// ─── 5. Lists ─────────────────────────────────────────────────────────────────

describe("bullet list", () => {
  it("bullet items → listItem:'bullet', level:1", () => {
    const out = markdownToPortableText("- First item\n- Second item\n- Third item");
    expect(out).toHaveLength(3);
    for (const b of out) {
      const block = b as PortableTextBlock;
      expect(block._type).toBe("block");
      expect(block.listItem).toBe("bullet");
      expect(block.level).toBe(1);
    }
    expect(spanText(out[0] as PortableTextBlock)).toBe("First item");
    expect(spanText(out[1] as PortableTextBlock)).toBe("Second item");
  });
});

describe("ordered list", () => {
  it("numbered items → listItem:'number'", () => {
    const out = markdownToPortableText("1. Step one\n2. Step two");
    expect(out).toHaveLength(2);
    const block = out[0] as PortableTextBlock;
    expect(block.listItem).toBe("number");
    expect(block.level).toBe(1);
  });
});

describe("nested list", () => {
  it("nested bullet → level:2 for child item", () => {
    const out = markdownToPortableText("- Parent\n  - Child");
    const child = (out as PortableTextBlock[]).find((b) => b.level === 2);
    expect(child).toBeDefined();
    expect(spanText(child!)).toBe("Child");
  });
});

// ─── 6. Code block ────────────────────────────────────────────────────────────

describe("code block", () => {
  it("fenced code block → _type:'code' with code and language", () => {
    const out = markdownToPortableText("```python\nprint('hello')\n```");
    expect(out).toHaveLength(1);
    const block = out[0] as PortableTextCodeBlock;
    expect(block._type).toBe("code");
    expect(block.code).toBe("print('hello')");
    expect(block.language).toBe("python");
  });

  it("fenced code block without language → language:'text'", () => {
    const out = markdownToPortableText("```\nplain code\n```");
    const block = out[0] as PortableTextCodeBlock;
    expect(block.language).toBe("text");
  });
});

// ─── 7. Blockquote ────────────────────────────────────────────────────────────

describe("blockquote", () => {
  it("blockquote → style:'blockquote' with text", () => {
    const out = markdownToPortableText("> Important note here.");
    expect(out).toHaveLength(1);
    const block = out[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("blockquote");
    expect(spanText(block)).toContain("Important note here");
  });
});

// ─── 8. Thematic break ────────────────────────────────────────────────────────

describe("thematic break", () => {
  it("--- (hr) → 0 blocks emitted (not supported in schema)", () => {
    // htmlToBlocks ignores <hr> — consistent with old converter behaviour.
    const out = markdownToPortableText("---");
    expect(out).toHaveLength(0);
  });
});

// ─── 9. Inline image ──────────────────────────────────────────────────────────

describe("inline image", () => {
  it("inline image → 0 or 1 empty blocks (no image asset available)", () => {
    // @portabletext/block-tools emits an empty-text span block for <img> tags
    // with no Sanity asset refs. We assert it emits ≤1 block and no _type:'image'
    // with a real asset (which would need a Sanity upload).
    const out = markdownToPortableText("![alt text](https://img.com/x.png)");
    expect(out.length).toBeLessThanOrEqual(1);
    // If it emits a block, it must not be a type we don't support
    if (out.length === 1) {
      expect(ALLOWED_TYPES.has(out[0]._type)).toBe(true);
    }
  });
});

// ─── 10. Placeholders (regression: session-10 bug) ────────────────────────────

describe("placeholders — literal span text", () => {
  it("{{currency:Chaos Orb}} in paragraph → span text contains token", () => {
    const out = markdownToPortableText("Buy {{currency:Chaos Orb}} at market price.");
    const block = out[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("normal");
    expect(spanText(block)).toContain("{{currency:Chaos Orb}}");
  });

  it("standalone {{currency:Chaos Orb}} → 1 block with literal token", () => {
    const out = markdownToPortableText("{{currency:Chaos Orb}}");
    expect(out).toHaveLength(1);
    expect(out[0]._type).toBe("block");
    expect(spanText(out[0] as PortableTextBlock)).toContain("{{currency:Chaos Orb}}");
  });

  it("multiple placeholders in same paragraph → all in text as literals", () => {
    const out = markdownToPortableText("{{currency:Divine Orb}} costs {{price:Divine Orb}}.");
    const block = out[0] as PortableTextBlock;
    const text = spanText(block);
    expect(text).toContain("{{currency:Divine Orb}}");
    expect(text).toContain("{{price:Divine Orb}}");
  });

  it("placeholder in list item → literal token inside bullet block", () => {
    const out = markdownToPortableText("- Use {{item:Tabula Rasa}} early");
    const block = out[0] as PortableTextBlock;
    expect(block.listItem).toBe("bullet");
    expect(spanText(block)).toContain("{{item:Tabula Rasa}}");
  });

  it("placeholder in bold → literal token preserved inside strong span", () => {
    const out = markdownToPortableText("Buy **{{currency:Chaos Orb}}** now.");
    const block = out[0] as PortableTextBlock;
    const boldSpan = block.children.find((s) => s.marks.includes("strong"));
    expect(boldSpan).toBeDefined();
    expect(boldSpan?.text).toContain("{{currency:Chaos Orb}}");
  });

  it("{{passive:Iron Will}} → literal block token", () => {
    const out = markdownToPortableText("{{passive:Iron Will}}");
    expect(out[0]._type).toBe("block");
    expect(spanText(out[0] as PortableTextBlock)).toContain("{{passive:Iron Will}}");
  });

  it("{{cta:currency|buy}} → literal block token (not custom block type)", () => {
    const out = markdownToPortableText("{{cta:currency|buy}}");
    expect(out[0]._type).toBe("block");
    expect(spanText(out[0] as PortableTextBlock)).toContain("{{cta:currency|buy}}");
  });
});

// ─── 11. Critical regression: no custom PoE block types (session-10) ──────────

describe("S10 regression: no custom PoE block types emitted", () => {
  const fixtures = [
    "{{currency:Chaos Orb}}",
    "{{item:Kaom's Heart}}",
    "{{passive:Iron Will}}",
    "{{price:Void Battery}}",
    "{{cta:currency|buy}}",
    "Costs **{{currency:Divine Orb}}** per try.",
    "# Guide\n\nUse {{item:Tabula Rasa}} early.\n\n- {{currency:Chaos Orb}}\n- {{passive:Iron Will}}",
  ];

  for (const md of fixtures) {
    it(`no custom types in: "${md.substring(0, 40)}"`, () => {
      const out = markdownToPortableText(md);
      assertNoCustomPoeTypes(out);
    });
  }
});

// ─── 12. Invariants ───────────────────────────────────────────────────────────

describe("invariant: _type always in allowed set", () => {
  it("all blocks have _type ∈ {block, image, code}", () => {
    const md = [
      "# H1",
      "",
      "Para with **bold** and *em* and `code`.",
      "",
      "- Bullet one",
      "- Bullet two",
      "",
      "> Quote",
      "",
      "```js\nconsole.log('hi')\n```",
      "",
      "[Link](https://poe.com)",
    ].join("\n");
    const out = markdownToPortableText(md);
    for (const block of out) {
      expect(ALLOWED_TYPES.has(block._type), `unexpected _type: ${block._type}`).toBe(true);
    }
  });
});

describe("invariant: all blocks and spans have non-empty _key", () => {
  it("_key is present and non-empty on every block and span", () => {
    const md = "# H\n\nPara.\n\n- A\n- B\n\n> Quote\n\n```py\ncode\n```";
    assertAllHaveKey(markdownToPortableText(md));
  });
});

describe("invariant: block._type==='block' has children array with ≥1 span", () => {
  it("each 'block' has ≥1 child span with _type, _key, text, marks", () => {
    const md = "# Heading\n\nParagraph.\n\n- Item";
    const out = markdownToPortableText(md);
    for (const b of out.filter((x) => x._type === "block")) {
      const block = b as PortableTextBlock;
      expect(Array.isArray(block.children)).toBe(true);
      expect(block.children.length).toBeGreaterThanOrEqual(1);
      for (const span of block.children) {
        expect(span._type).toBe("span");
        expect(span._key).toBeTruthy();
        expect(typeof span.text).toBe("string");
        expect(Array.isArray(span.marks)).toBe(true);
      }
    }
  });
});

describe("invariant: _key values are unique within a conversion", () => {
  it("no two blocks share the same _key", () => {
    const md = "# H\n\nPara.\n\n- A\n- B\n\n> Quote\n\n```py\nx\n```";
    const out = markdownToPortableText(md);
    const keys = out.map((b) => b._key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── 13. Mixed content ────────────────────────────────────────────────────────

describe("multi-section markdown", () => {
  it("heading + paragraph + list all present and correct", () => {
    const md = [
      "# Build Guide",
      "",
      "This build uses {{currency:Divine Orb}}.",
      "",
      "- Fast clear",
      "- High DPS",
    ].join("\n");

    const out = markdownToPortableText(md);
    const heading = findBlocks(out, "block").find((b) => b.style === "h1");
    expect(heading).toBeDefined();
    const listItems = findBlocks(out, "block").filter((b) => b.listItem === "bullet");
    expect(listItems).toHaveLength(2);
    // Placeholder is literal
    const para = findBlocks(out, "block").find((b) => b.style === "normal" && !b.listItem);
    expect(para).toBeDefined();
    expect(spanText(para!)).toContain("{{currency:Divine Orb}}");
  });
});
