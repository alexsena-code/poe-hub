/**
 * Tests for markdownToPortableText.
 *
 * Each test verifies the _type of emitted blocks and key content. _key values
 * are nanoid-generated, so we use expect.objectContaining() everywhere.
 *
 * Session 10.e.
 */

import { describe, it, expect } from "vitest";
import { markdownToPortableText } from "../markdown-to-portable";
import type { PortableTextBlock, PortableTextCodeBlock } from "@/lib/sanity/types";

// Helper: find blocks by _type
function blocksOfType(blocks: ReturnType<typeof markdownToPortableText>, type: string) {
  return blocks.filter((b) => b._type === type);
}

// Helper: get span text from a PortableTextBlock
function spanText(block: PortableTextBlock): string {
  return block.children.map((s) => s.text).join("");
}

// ─── Empty input ──────────────────────────────────────────────────────────────

describe("empty input", () => {
  it("returns empty array for empty string", () => {
    expect(markdownToPortableText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(markdownToPortableText("   \n  \t  ")).toEqual([]);
  });
});

// ─── Headings ─────────────────────────────────────────────────────────────────

describe("headings", () => {
  it("converts h1", () => {
    const blocks = markdownToPortableText("# Hello World");
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("h1");
    expect(spanText(block)).toBe("Hello World");
  });

  it("converts h2", () => {
    const blocks = markdownToPortableText("## Section Title");
    const block = blocks[0] as PortableTextBlock;
    expect(block.style).toBe("h2");
    expect(spanText(block)).toBe("Section Title");
  });

  it("converts h3", () => {
    const blocks = markdownToPortableText("### Subsection");
    const block = blocks[0] as PortableTextBlock;
    expect(block.style).toBe("h3");
  });

  it("clamps h5+ to h4", () => {
    const blocks = markdownToPortableText("##### Too Deep");
    const block = blocks[0] as PortableTextBlock;
    expect(block.style).toBe("h4");
  });
});

// ─── Paragraph ────────────────────────────────────────────────────────────────

describe("paragraph", () => {
  it("converts plain paragraph", () => {
    const blocks = markdownToPortableText("This is a paragraph.");
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("normal");
    expect(spanText(block)).toBe("This is a paragraph.");
  });

  it("bold text emits strong mark", () => {
    const blocks = markdownToPortableText("Buy **Divine Orb** now.");
    const block = blocks[0] as PortableTextBlock;
    const boldSpan = block.children.find((s) => s.marks.includes("strong"));
    expect(boldSpan).toBeDefined();
    expect(boldSpan?.text).toBe("Divine Orb");
  });

  it("italic text emits em mark", () => {
    const blocks = markdownToPortableText("*important* info");
    const block = blocks[0] as PortableTextBlock;
    const italicSpan = block.children.find((s) => s.marks.includes("em"));
    expect(italicSpan).toBeDefined();
    expect(italicSpan?.text).toBe("important");
  });
});

// ─── Lists ────────────────────────────────────────────────────────────────────

describe("bullet list", () => {
  it("converts bullet list items", () => {
    const md = "- First item\n- Second item\n- Third item";
    const blocks = markdownToPortableText(md);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) {
      const block = b as PortableTextBlock;
      expect(block._type).toBe("block");
      expect(block.listItem).toBe("bullet");
      expect(block.level).toBe(1);
    }
    expect(spanText(blocks[0] as PortableTextBlock)).toBe("First item");
    expect(spanText(blocks[1] as PortableTextBlock)).toBe("Second item");
  });
});

describe("ordered list", () => {
  it("converts numbered list items", () => {
    const md = "1. Step one\n2. Step two";
    const blocks = markdownToPortableText(md);
    expect(blocks).toHaveLength(2);
    const block = blocks[0] as PortableTextBlock;
    expect(block.listItem).toBe("number");
    expect(block.level).toBe(1);
  });
});

describe("nested list", () => {
  it("emits level=2 for nested items", () => {
    const md = "- Parent\n  - Child";
    const blocks = markdownToPortableText(md);
    const child = blocks.find((b) => (b as PortableTextBlock).level === 2) as PortableTextBlock | undefined;
    expect(child).toBeDefined();
    expect(spanText(child!)).toBe("Child");
  });
});

// ─── Code ─────────────────────────────────────────────────────────────────────

describe("code block", () => {
  it("converts fenced code block", () => {
    const md = "```python\nprint('hello')\n```";
    const blocks = markdownToPortableText(md);
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as PortableTextCodeBlock;
    expect(block._type).toBe("code");
    expect(block.code).toBe("print('hello')");
    expect(block.language).toBe("python");
  });

  it("defaults language to 'text' when none specified", () => {
    const md = "```\nplain code\n```";
    const blocks = markdownToPortableText(md);
    const block = blocks[0] as PortableTextCodeBlock;
    expect(block.language).toBe("text");
  });
});

describe("inline code", () => {
  it("emits code mark on inline code spans", () => {
    const blocks = markdownToPortableText("Run `npm install` here.");
    const block = blocks[0] as PortableTextBlock;
    const codeSpan = block.children.find((s) => s.marks.includes("code"));
    expect(codeSpan?.text).toBe("npm install");
  });
});

// ─── Blockquote ───────────────────────────────────────────────────────────────

describe("blockquote", () => {
  it("converts blockquote to blockquote style block", () => {
    const blocks = markdownToPortableText("> Important note here.");
    expect(blocks).toHaveLength(1);
    const block = blocks[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("blockquote");
    expect(spanText(block)).toContain("Important note here");
  });
});

// ─── Link ─────────────────────────────────────────────────────────────────────

describe("link", () => {
  it("converts link to markDef + span with link key as mark", () => {
    const blocks = markdownToPortableText("[Path of Exile](https://pathofexile.com)");
    const block = blocks[0] as PortableTextBlock;
    expect(block.markDefs).toHaveLength(1);
    const def = block.markDefs[0];
    expect(def._type).toBe("link");
    // Narrow to LinkMark to access href safely
    const href = def._type === "link" ? (def as import("@/lib/sanity/types").LinkMark).href : undefined;
    expect(href).toBe("https://pathofexile.com");
    const linkSpan = block.children.find((s) =>
      s.marks.includes(def._key),
    );
    expect(linkSpan?.text).toBe("Path of Exile");
  });
});

// ─── Placeholders ─────────────────────────────────────────────────────────────

describe("{{currency:...}} placeholder", () => {
  it("emits a paragraph block preserving the placeholder token inline", () => {
    const blocks = markdownToPortableText("Buy {{currency:Chaos Orb}} at market price.");
    // Mixed text + placeholder → stays as a normal paragraph block with raw token
    const block = blocks[0] as PortableTextBlock;
    expect(block._type).toBe("block");
    expect(block.style).toBe("normal");
    const raw = spanText(block);
    expect(raw).toContain("{{currency:Chaos Orb}}");
  });

  it("standalone placeholder paragraph becomes a poeCurrency block", () => {
    const blocks = markdownToPortableText("{{currency:Chaos Orb}}");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]._type).toBe("poeCurrency");
    const b = blocks[0] as unknown as { currencyName: string };
    expect(b.currencyName).toBe("Chaos Orb");
  });
});

describe("{{item:...}} placeholder", () => {
  it("standalone item placeholder becomes poeItem block", () => {
    const blocks = markdownToPortableText("{{item:Kaom's Heart}}");
    expect(blocks[0]._type).toBe("poeItem");
    const b = blocks[0] as unknown as { itemName: string };
    expect(b.itemName).toBe("Kaom's Heart");
  });

  it("item placeholder in a list item stays as inline token", () => {
    const blocks = markdownToPortableText("- Use {{item:Tabula Rasa}} early");
    const block = blocks[0] as PortableTextBlock;
    expect(block.listItem).toBe("bullet");
    expect(spanText(block)).toContain("{{item:Tabula Rasa}}");
  });
});

describe("{{passive:...}} placeholder", () => {
  it("standalone passive placeholder becomes poePassive block", () => {
    const blocks = markdownToPortableText("{{passive:Iron Will}}");
    expect(blocks[0]._type).toBe("poePassive");
    const b = blocks[0] as unknown as { passiveName: string };
    expect(b.passiveName).toBe("Iron Will");
  });
});

describe("{{price:...}} placeholder", () => {
  it("standalone price placeholder becomes poePrice block", () => {
    const blocks = markdownToPortableText("{{price:Void Battery}}");
    expect(blocks[0]._type).toBe("poePrice");
    const b = blocks[0] as unknown as { itemName: string };
    expect(b.itemName).toBe("Void Battery");
  });
});

describe("{{cta:...}} placeholder", () => {
  it("standalone cta placeholder becomes poeCta block", () => {
    const blocks = markdownToPortableText("{{cta:currency|buy}}");
    expect(blocks[0]._type).toBe("poeCta");
    const b = blocks[0] as unknown as { variant: string; modifier?: string };
    expect(b.variant).toBe("currency");
    expect(b.modifier).toBe("buy");
  });
});

// ─── Mixed content ────────────────────────────────────────────────────────────

describe("multi-section markdown", () => {
  it("converts heading + paragraph + list correctly", () => {
    const md = [
      "# Build Guide",
      "",
      "This build uses {{currency:Divine Orb}}.",
      "",
      "- Fast clear",
      "- High DPS",
    ].join("\n");

    const blocks = markdownToPortableText(md);
    const heading = blocksOfType(blocks, "block").find(
      (b) => (b as PortableTextBlock).style === "h1",
    );
    expect(heading).toBeDefined();
    const listItems = (blocks as PortableTextBlock[]).filter((b) => b.listItem === "bullet");
    expect(listItems).toHaveLength(2);
  });
});

// ─── All _keys unique ─────────────────────────────────────────────────────────

describe("key uniqueness", () => {
  it("all emitted blocks have unique _key values", () => {
    const md = "# H\n\nPara.\n\n- A\n- B\n\n> Quote";
    const blocks = markdownToPortableText(md);
    const keys = blocks.map((b) => b._key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
