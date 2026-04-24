/**
 * Tests for lib/sanity/publish.ts
 *
 * The Sanity client is mocked via vi.mock so no real Sanity project is needed.
 * We test the validation layer, draft round-trip, deleteDraft, and publishDraft.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishPost, saveDraft, deleteDraft, publishDraft, sanityPostSchema } from "../publish";
import type { SanityPost } from "../types";

// ─── Mock the Sanity client module ────────────────────────────────────────────

const mockCreateOrReplace = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockGetDocument = vi.fn();

// Transaction chain mock: each method returns the chain itself so the caller
// can do `.createOrReplace(...).delete(...).commit()`. `.commit()` resolves
// to a mutation result (caller ignores body — publishPost reads back via
// getDocument).
const mockTxCreateOrReplace = vi.fn();
const mockTxDelete = vi.fn();
const mockTxCommit = vi.fn();
const mockTx = {
  createOrReplace: mockTxCreateOrReplace,
  delete: mockTxDelete,
  commit: mockTxCommit,
};
mockTxCreateOrReplace.mockReturnValue(mockTx);
mockTxDelete.mockReturnValue(mockTx);

vi.mock("../client", () => ({
  getSanityClient: () => ({
    createOrReplace: mockCreateOrReplace,
    create: mockCreate,
    delete: mockDelete,
    getDocument: mockGetDocument,
    transaction: () => mockTx,
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeValidPost(overrides: Partial<SanityPost> = {}): SanityPost {
  return {
    _id: "post-abc123",
    _type: "post",
    language: "pt-br",
    title: "Guia completo de Divine Orbs",
    metadata: "Tudo que você precisa saber sobre Divine Orbs no PoE2",
    gameVersion: "path-of-exile-2",
    category: { _type: "reference", _ref: "cat-001" },
    slug: { _type: "slug", current: "guia-divine-orbs" },
    tags: ["divine", "currency", "poe2"],
    author: { _type: "reference", _ref: "author-001" },
    publishedAt: "2026-04-23T12:00:00.000Z",
    body: [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        children: [{ _type: "span", _key: "s1", text: "Introdução.", marks: [] }],
        markDefs: [],
      },
    ],
    ...overrides,
  };
}

// ─── publishPost ──────────────────────────────────────────────────────────────

describe("publishPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm the chain returns after clearAllMocks wiped them.
    mockTxCreateOrReplace.mockReturnValue(mockTx);
    mockTxDelete.mockReturnValue(mockTx);
    mockTxCommit.mockResolvedValue({ transactionId: "tx-1", results: [] });
    mockGetDocument.mockResolvedValue(makeValidPost({ _id: "post-abc123" }));
  });

  it("should call transaction.createOrReplace with bare ID (no drafts. prefix)", async () => {
    const post = makeValidPost({ _id: "post-abc123" });
    await publishPost(post);

    const arg = mockTxCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
    expect(typeof arg._id === "string" && arg._id.startsWith("drafts.")).toBe(false);
  });

  it("should call transaction.delete with drafts. prefixed id (atomic cleanup)", async () => {
    await publishPost(makeValidPost({ _id: "post-abc123" }));
    expect(mockTxDelete).toHaveBeenCalledWith("drafts.post-abc123");
  });

  it("should commit the transaction exactly once", async () => {
    await publishPost(makeValidPost({ _id: "post-abc123" }));
    expect(mockTxCommit).toHaveBeenCalledOnce();
  });

  it("should strip drafts. prefix from _id before writing", async () => {
    const post = makeValidPost({ _id: "drafts.post-abc123" });
    await publishPost(post);

    const arg = mockTxCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
    // And delete should still target the drafts. prefix
    expect(mockTxDelete).toHaveBeenCalledWith("drafts.post-abc123");
  });

  it("should return the doc read back via getDocument after commit", async () => {
    const expected = makeValidPost({ _id: "post-abc123" });
    mockGetDocument.mockResolvedValue(expected);

    const result = await publishPost(makeValidPost());
    expect(mockGetDocument).toHaveBeenCalledWith("post-abc123");
    expect(result._id).toBe("post-abc123");
    expect(result.title).toBe("Guia completo de Divine Orbs");
  });

  it("should throw when title is missing", async () => {
    const post = { ...makeValidPost(), title: "" };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when metadata is missing", async () => {
    const post = { ...makeValidPost(), metadata: "" };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when slug is invalid (contains spaces)", async () => {
    const post = makeValidPost({
      slug: { _type: "slug", current: "guia divine orbs" },
    });
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when tags is empty array", async () => {
    const post = { ...makeValidPost(), tags: [] };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when body is empty array", async () => {
    const post = { ...makeValidPost(), body: [] };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when gameVersion is invalid", async () => {
    const post = { ...makeValidPost(), gameVersion: "path-of-exile-3" as "path-of-exile-1" };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when language is invalid", async () => {
    const post = { ...makeValidPost(), language: "fr" as "pt-br" };
    await expect(publishPost(post)).rejects.toThrow("validation failed");
  });

  it("should throw when transaction commit fails", async () => {
    mockTxCommit.mockRejectedValue(new Error("Sanity API error"));
    await expect(publishPost(makeValidPost())).rejects.toThrow(
      "[sanity.publish] transaction commit failed"
    );
  });

  it("should throw when getDocument read-back returns null", async () => {
    mockGetDocument.mockResolvedValue(null);
    await expect(publishPost(makeValidPost())).rejects.toThrow(
      "[sanity.publish] read-back failed"
    );
  });

  it("should throw when _id is missing (required for atomic draft cleanup)", async () => {
    const post = { ...makeValidPost(), _id: "" };
    await expect(publishPost(post)).rejects.toThrow(
      "[sanity.publish] missing _id for publish"
    );
  });

  it("should include validation issues list in error message", async () => {
    const post = { ...makeValidPost(), title: "", metadata: "" };
    try {
      await publishPost(post);
      throw new Error("Expected to throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch("title");
      expect(message).toMatch("metadata");
    }
  });
});

// ─── saveDraft ────────────────────────────────────────────────────────────────

describe("saveDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call createOrReplace with drafts. prefix when id is provided", async () => {
    mockCreateOrReplace.mockResolvedValue({ _id: "drafts.post-abc123" });

    await saveDraft({ _type: "post", id: "post-abc123", title: "Draft" });

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("drafts.post-abc123");
  });

  it("should call createOrReplace with drafts. prefix when id already has drafts. prefix", async () => {
    mockCreateOrReplace.mockResolvedValue({ _id: "drafts.post-abc123" });

    await saveDraft({ _type: "post", id: "drafts.post-abc123", title: "Draft" });

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("drafts.post-abc123");
  });

  it("should call create (no _id) when no id is provided", async () => {
    mockCreate.mockResolvedValue({ _id: "drafts.new-generated" });

    const result = await saveDraft({ _type: "post", title: "New draft" });
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.id).toBe("drafts.new-generated");
  });

  it("should return the id from Sanity response", async () => {
    mockCreateOrReplace.mockResolvedValue({ _id: "drafts.post-abc123" });

    const result = await saveDraft({ _type: "post", id: "post-abc123" });
    expect(result.id).toBe("drafts.post-abc123");
  });

  it("should not include the helper `id` field in the Sanity doc", async () => {
    mockCreateOrReplace.mockResolvedValue({ _id: "drafts.post-abc123" });

    await saveDraft({ _type: "post", id: "post-abc123" });

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect("id" in arg).toBe(false);
  });

  it("should throw when createOrReplace fails", async () => {
    mockCreateOrReplace.mockRejectedValue(new Error("network error"));

    await expect(saveDraft({ _type: "post", id: "xyz" })).rejects.toThrow(
      "[sanity.publish] saveDraft failed"
    );
  });
});

// ─── deleteDraft ──────────────────────────────────────────────────────────────

describe("deleteDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue({ _id: "drafts.post-abc123" });
  });

  it("should call client.delete with drafts. prefixed id", async () => {
    await deleteDraft("post-abc123");
    expect(mockDelete).toHaveBeenCalledWith("drafts.post-abc123");
  });

  it("should normalise already-prefixed id", async () => {
    await deleteDraft("drafts.post-abc123");
    expect(mockDelete).toHaveBeenCalledWith("drafts.post-abc123");
  });

  it("should throw when delete fails", async () => {
    mockDelete.mockRejectedValue(new Error("not found"));
    await expect(deleteDraft("post-abc123")).rejects.toThrow(
      "[sanity.publish] deleteDraft failed"
    );
  });
});

// ─── publishDraft ─────────────────────────────────────────────────────────────

describe("publishDraft", () => {
  const draftDoc = makeValidPost({ _id: "drafts.post-abc123" });
  const publishedDoc = makeValidPost({ _id: "post-abc123" });

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm transaction chain after clearAllMocks.
    mockTxCreateOrReplace.mockReturnValue(mockTx);
    mockTxDelete.mockReturnValue(mockTx);
    mockTxCommit.mockResolvedValue({ transactionId: "tx-1", results: [] });
    // getDocument is called twice: once for the initial draft fetch (prefixed
    // id) and once for the publishPost read-back (bare id).
    mockGetDocument.mockImplementation(async (id: string) =>
      id === "drafts.post-abc123" ? draftDoc : publishedDoc,
    );
  });

  it("should fetch draft then publish via transaction (atomic publish+delete)", async () => {
    await publishDraft("post-abc123");

    expect(mockGetDocument).toHaveBeenCalledWith("drafts.post-abc123");
    expect(mockTxCreateOrReplace).toHaveBeenCalledOnce();
    expect(mockTxDelete).toHaveBeenCalledWith("drafts.post-abc123");
    expect(mockTxCommit).toHaveBeenCalledOnce();
  });

  it("should return the published document (read back via getDocument)", async () => {
    const result = await publishDraft("post-abc123");
    expect(result._id).toBe("post-abc123");
    expect(result.title).toBe("Guia completo de Divine Orbs");
  });

  it("should throw when draft is not found", async () => {
    mockGetDocument.mockResolvedValue(null);

    await expect(publishDraft("post-abc123")).rejects.toThrow(
      'draft not found: "drafts.post-abc123"'
    );
  });

  it("should throw when getDocument fails", async () => {
    mockGetDocument.mockRejectedValue(new Error("connection refused"));

    await expect(publishDraft("post-abc123")).rejects.toThrow(
      "[sanity.publish] failed to fetch draft"
    );
  });

  it("should handle drafts. prefix in id argument gracefully", async () => {
    await publishDraft("drafts.post-abc123");

    expect(mockGetDocument).toHaveBeenCalledWith("drafts.post-abc123");
    // Published ID should have no prefix
    const arg = mockTxCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
  });
});

// ─── sanityPostSchema — strict body validation ────────────────────────────────
// These tests exercise the portableTextContentSchema discriminated union
// without invoking publishPost (no Sanity client needed). They are the
// backstop that catches session-10 regressions where custom _types were
// silently dropped by the Studio.

/** Minimal valid post fixture with a body that can be overridden per-test. */
function makePostPayload(body: unknown[]): unknown {
  return {
    _id: "post-abc123",
    _type: "post",
    language: "pt-br",
    title: "Test",
    metadata: "Test description for SEO",
    gameVersion: "path-of-exile-2",
    category: { _type: "reference", _ref: "cat-001" },
    slug: { _type: "slug", current: "test-slug" },
    tags: ["test"],
    author: { _type: "reference", _ref: "author-001" },
    publishedAt: "2026-04-24T00:00:00.000Z",
    body,
  };
}

describe("sanityPostSchema — body strict validation", () => {
  // Happy path: mixed valid block types all accepted together.
  it("accepts body with block + code + poeItem blocks", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          children: [{ _type: "span", _key: "s1", text: "Hello.", marks: [] }],
          markDefs: [],
        },
        {
          _type: "code",
          _key: "c1",
          code: 'print("hello")',
          language: "python",
        },
        {
          _type: "poeItem",
          _key: "p1",
          rawText: "Chaos Orb",
          iconUrl: "https://example.com/chaos.png",
        },
      ]),
    );
    expect(result.success).toBe(true);
  });

  // Regression S10: poeCurrency was silently dropped by Studio because it's
  // not in blockContent. Now zod must reject it before the write happens.
  // Zod v4 discriminatedUnion reports code="invalid_union" with path ending in
  // "_type" — the path is our confirmation that the discriminator was the issue.
  it("rejects body with _type 'poeCurrency' (S10 regression)", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([{ _type: "poeCurrency", _key: "x1", value: "1c" }]),
    );
    expect(result.success).toBe(false);
    // Path must point at the _type field so the error is traceable to the offender.
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("_type"))).toBe(true);
  });

  // Regression S10: poePassive same silent-drop family.
  it("rejects body with _type 'poePassive' (S10 regression)", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([{ _type: "poePassive", _key: "x2", name: "Iron Grip" }]),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("_type"))).toBe(true);
  });

  it("rejects block without _key", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", _key: "s1", text: "Hi.", marks: [] }],
          markDefs: [],
        },
      ]),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("_key"))).toBe(true);
  });

  it("rejects block with empty children array", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          children: [],
          markDefs: [],
        },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes("at least one span"))).toBe(true);
  });

  it("rejects span without text field", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          children: [{ _type: "span", _key: "s1", marks: [] }],
          markDefs: [],
        },
      ]),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("text"))).toBe(true);
  });

  it("rejects link markDef without href", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          children: [{ _type: "span", _key: "s1", text: "Click here.", marks: ["lnk1"] }],
          markDefs: [{ _type: "link", _key: "lnk1" }],
        },
      ]),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("href"))).toBe(true);
  });

  it("rejects image block without asset._ref", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "image",
          _key: "img1",
          asset: { _type: "reference", _ref: "" },
        },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes("_ref"))).toBe(true);
  });

  it("rejects table block with empty rows array", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "table",
          _key: "tbl1",
          rows: [],
        },
      ]),
    );
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes("at least one row"))).toBe(true);
  });

  it("rejects poeItem block without rawText", () => {
    const result = sanityPostSchema.safeParse(
      makePostPayload([
        {
          _type: "poeItem",
          _key: "pi1",
          rawText: "",
        },
      ]),
    );
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths.some((p) => p.includes("rawText"))).toBe(true);
  });
});
