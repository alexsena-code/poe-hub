/**
 * Tests for lib/sanity/publish.ts
 *
 * The Sanity client is mocked via vi.mock so no real Sanity project is needed.
 * We test the validation layer, draft round-trip, deleteDraft, and publishDraft.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishPost, saveDraft, deleteDraft, publishDraft } from "../publish";
import type { SanityPost } from "../types";

// ─── Mock the Sanity client module ────────────────────────────────────────────

const mockCreateOrReplace = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockGetDocument = vi.fn();

vi.mock("../client", () => ({
  getSanityClient: () => ({
    createOrReplace: mockCreateOrReplace,
    create: mockCreate,
    delete: mockDelete,
    getDocument: mockGetDocument,
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
    mockCreateOrReplace.mockResolvedValue(makeValidPost({ _id: "post-abc123" }));
  });

  it("should call createOrReplace with bare ID (no drafts. prefix)", async () => {
    const post = makeValidPost({ _id: "post-abc123" });
    await publishPost(post);

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
    expect(typeof arg._id === "string" && arg._id.startsWith("drafts.")).toBe(false);
  });

  it("should strip drafts. prefix from _id before writing", async () => {
    const post = makeValidPost({ _id: "drafts.post-abc123" });
    await publishPost(post);

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
  });

  it("should return the result from createOrReplace", async () => {
    const expected = makeValidPost({ _id: "post-abc123" });
    mockCreateOrReplace.mockResolvedValue(expected);

    const result = await publishPost(makeValidPost());
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

  it("should throw when createOrReplace fails", async () => {
    mockCreateOrReplace.mockRejectedValue(new Error("Sanity API error"));
    await expect(publishPost(makeValidPost())).rejects.toThrow(
      "[sanity.publish] createOrReplace failed"
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
    mockGetDocument.mockResolvedValue(draftDoc);
    mockCreateOrReplace.mockResolvedValue(publishedDoc);
    mockDelete.mockResolvedValue({});
  });

  it("should fetch draft, publish it, then delete the draft", async () => {
    await publishDraft("post-abc123");

    expect(mockGetDocument).toHaveBeenCalledWith("drafts.post-abc123");
    expect(mockCreateOrReplace).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith("drafts.post-abc123");
  });

  it("should return the published document", async () => {
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

  it("should still return published doc even if draft delete fails (warn only)", async () => {
    mockDelete.mockRejectedValue(new Error("delete failed"));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await publishDraft("post-abc123");

    expect(result._id).toBe("post-abc123");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to delete draft"),
      expect.any(String)
    );

    consoleErrorSpy.mockRestore();
  });

  it("should handle drafts. prefix in id argument gracefully", async () => {
    await publishDraft("drafts.post-abc123");

    expect(mockGetDocument).toHaveBeenCalledWith("drafts.post-abc123");
    // Published ID should have no prefix
    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("post-abc123");
  });
});
