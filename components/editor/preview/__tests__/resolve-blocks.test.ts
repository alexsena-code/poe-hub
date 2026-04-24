/**
 * Unit tests for the preview pane's resolveBlocks() function.
 *
 * All fetch-helpers are mocked so tests run without a real engine.
 * The tests verify the same phases as the poetrade-dev original:
 *   1. Block without placeholder → returned unchanged
 *   2. {{item:Divine Orb}} → fetch called, block transformed with span + markDef
 *   3. Multiple placeholders in one block → batch fetch (all names collected)
 *   4. Placeholder with modifier → modifier forwarded to resolver
 *   5. CTA standalone → poeCta block promoted
 *   6. Fetch error → literal text fallback (fail-soft)
 *
 * Session 08.d.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveBlocks } from "../resolve-blocks";
import type { PortableTextBlock, PortableTextContent } from "@/lib/sanity/types";

// Tests assume blocks returned are text blocks. Use this cast helper where the
// union narrowing would be noisy. Resolver preserves type/shape for text blocks.
const asBlock = (b: PortableTextContent) => b as PortableTextBlock;

// ─── Mock fetch-helpers ───────────────────────────────────────────────────────

vi.mock("../fetch-helpers", () => ({
  fetchCurrencyNames: vi.fn(async () => ["Divine Orb", "Chaos Orb"]),
  fetchItemRawMany: vi.fn(async (names: string[]) => {
    const map: Record<string, object> = {};
    for (const n of names) {
      map[n.toLowerCase()] = {
        rawText: `Rarity: Currency\n${n}\n--------\nRight click to use.`,
        iconUrl: `https://cdn.example.com/${n.replace(/ /g, "_")}.png`,
        name: n,
        baseName: n,
        rarity: "Currency",
        classId: "StackableCurrency",
        gemInfo: null,
      };
    }
    return map;
  }),
  fetchPrices: vi.fn(async (names: string[], league: string) => {
    const map: Record<string, object> = {};
    for (const n of names) {
      map[n.toLowerCase()] = {
        name: n,
        chaos: n === "Divine Orb" ? 215 : 1,
        divine: n === "Divine Orb" ? 1 : 1 / 215,
        listingCount: 100,
        category: "Currency",
      };
    }
    return map;
  }),
  fetchPassiveRawMany: vi.fn(async () => new Map()),
  fetchPobItemRawMany: vi.fn(async () => ({})),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlock(text: string, key = "b1"): PortableTextBlock {
  return {
    _type: "block",
    _key: key,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `${key}-s`, text, marks: [] }],
  };
}

const CTX = { locale: "pt-br", gameVersion: "path-of-exile-1" as const };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when blocks is null", async () => {
    const result = await resolveBlocks(null, CTX);
    expect(result).toEqual([]);
  });

  it("returns empty array when blocks is empty", async () => {
    const result = await resolveBlocks([], CTX);
    expect(result).toEqual([]);
  });

  it("test 1: block without placeholder passes through unchanged", async () => {
    const block = makeBlock("This is a paragraph with no placeholders.");
    const result = await resolveBlocks([block], CTX);

    // One block returned
    expect(result).toHaveLength(1);
    // All children are spans
    const firstChild = asBlock(result[0]).children[0];
    // The text should be preserved (no fetch mutations on plain text)
    expect(firstChild.text).toContain("paragraph with no placeholders");
  });

  it("test 2: {{item:Divine Orb}} → fetch called, block has poeItem markDef", async () => {
    const { fetchItemRawMany } = await import("../fetch-helpers");

    const block = makeBlock("Buy {{item:Divine Orb}} now.");
    const result = await resolveBlocks([block], CTX);

    // fetchItemRawMany should have been called with "Divine Orb"
    expect(fetchItemRawMany).toHaveBeenCalledWith(expect.arrayContaining(["Divine Orb"]));

    expect(result).toHaveLength(1);
    const resolved = asBlock(result[0]);

    // markDefs should contain a poeItem entry
    const poeItemDef = resolved.markDefs?.find((m) => m._type === "poeItem");
    expect(poeItemDef).toBeDefined();
    expect((poeItemDef as unknown as Record<string, unknown>).rawText).toContain("Rarity: Currency");

    // Children: "Buy " + item span + " now."
    expect(resolved.children.length).toBeGreaterThanOrEqual(2);
  });

  it("test 3: multiple placeholders → batch fetch collects all names", async () => {
    const { fetchItemRawMany } = await import("../fetch-helpers");

    const block = makeBlock("Trade {{item:Divine Orb}} for {{item:Chaos Orb}} easily.");
    await resolveBlocks([block], CTX);

    const callArgs = (fetchItemRawMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[];
    expect(callArgs).toEqual(expect.arrayContaining(["Divine Orb", "Chaos Orb"]));
    // Should be called once (batch), not twice
    expect(fetchItemRawMany).toHaveBeenCalledTimes(1);
  });

  it("test 4: placeholder with modifier → modifier is forwarded to markDef / text", async () => {
    // {{price:Divine Orb|divine}} should emit a text span with divine price label
    const { fetchPrices } = await import("../fetch-helpers");

    const block = makeBlock("Price: {{price:Divine Orb|divine}}.");
    const result = await resolveBlocks([block], CTX);

    expect(fetchPrices).toHaveBeenCalled();
    const resolved = asBlock(result[0]);
    // The price span should contain "div" (formatted divine label)
    const spanTexts = resolved.children.map((c) => c.text ?? "").join("");
    // "1.0 div" or "1 div" depending on the value
    expect(spanTexts).toMatch(/div/);
  });

  it("test 5: standalone {{cta:currency|poe2}} → poeCta block promoted", async () => {
    const ctaBlock = makeBlock("{{cta:currency|poe2}}", "cta-b");
    const result = await resolveBlocks([ctaBlock], { ...CTX });

    expect(result).toHaveLength(1);
    // The block should be of type poeCta
    const cta = result[0] as unknown as Record<string, unknown>;
    expect(cta._type).toBe("poeCta");
    expect(cta.variant).toBe("currency");
    expect(cta.gameVersion).toBe("path-of-exile-2");
  });

  it("test 6: fetch error → placeholder literal text preserved (fail-soft)", async () => {
    const { fetchItemRawMany } = await import("../fetch-helpers");
    // Make the fetch fail
    (fetchItemRawMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    const block = makeBlock("Look at {{item:Mageblood}} in action.");
    const result = await resolveBlocks([block], CTX);

    expect(result).toHaveLength(1);
    const resolved = asBlock(result[0]);

    // Fail-soft: falls back to a link (resolveLink) or literal text
    // Either a link markDef or plain text span — no raw {{...}} token visible
    const spanTexts = resolved.children.map((c) => c.text ?? "").join("");
    expect(spanTexts).not.toContain("{{");
    expect(spanTexts).not.toContain("}}");
    // The item name should still be present
    expect(spanTexts).toContain("Mageblood");
  });

  it("inline currency mention promotion: bare 'Divine Orb' gets wrapped", async () => {
    // The inline mention regex should promote "Divine Orb" to {{item:Divine Orb}}
    // before placeholder collection, causing fetchItemRawMany to receive it.
    const { fetchItemRawMany } = await import("../fetch-helpers");

    const block = makeBlock("The Divine Orb is very valuable this league.");
    await resolveBlocks([block], CTX);

    const callArgs = (fetchItemRawMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | string[]
      | undefined;
    // If promotion fired, Divine Orb should be in the batch
    if (callArgs) {
      expect(callArgs).toEqual(expect.arrayContaining(["Divine Orb"]));
    }
    // At minimum, fetchItemRawMany was called (promotion triggered a placeholder)
    expect(fetchItemRawMany).toHaveBeenCalled();
  });

  it("markdown block splitting: single block with \\n\\n → multiple blocks", async () => {
    const bigBlock = makeBlock("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
    const result = await resolveBlocks([bigBlock], CTX);

    // Should be split into 3 individual blocks
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("heading promotion: '## Title' span gets h2 style", async () => {
    const block = makeBlock("## Section Title");
    const result = await resolveBlocks([block], CTX);

    // The block should be promoted to h2
    const headingBlock = result
      .map((b) => asBlock(b))
      .find((b) => b.style === "h2");
    expect(headingBlock).toBeDefined();
    expect(headingBlock?.children[0]?.text).toBe("Section Title");
  });
});
