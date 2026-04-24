/**
 * Tests for POST /api/sanity/publish
 *
 * Route: app/api/sanity/publish/route.ts
 *
 * Session 10.c — tests for the new publishRequestSchema (meta + body + draftId)
 * including slug collision detection and the transform path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../publish/route";

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

// ─── Sanity client mock ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
const mockGetDocument = vi.fn();
// Transaction chain (publishPost now writes atomically via transaction).
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

vi.mock("@/lib/sanity/client", () => ({
  getSanityClient: () => ({
    fetch: mockFetch,
    getDocument: mockGetDocument,
    transaction: () => mockTx,
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validMeta = {
  title: "Guia de Currency Trading",
  metadata: "Aprenda a fazer trades eficientes no Path of Exile 2.",
  slug: "guia-currency-trading",
  gameVersion: "path-of-exile-2",
  categoryId: "cat-001",
  authorId: "author-001",
  tags: ["currency", "trading"],
  publishedAt: "2026-04-24T10:00:00.000Z",
  language: "pt-br",
};

const validBody = [
  {
    _type: "block",
    _key: "b1",
    style: "normal",
    children: [{ _type: "span", _key: "s1", text: "Conteúdo.", marks: [] }],
    markDefs: [],
  },
];

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sanity/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
  // Default: no slug collision
  mockFetch.mockResolvedValue(null);
  // Re-arm transaction chain after clearAllMocks wiped return values.
  mockTxCreateOrReplace.mockReturnValue(mockTx);
  mockTxDelete.mockReturnValue(mockTx);
  mockTxCommit.mockResolvedValue({ transactionId: "tx-1", results: [] });
  // publishPost reads back via getDocument(baseId) after commit.
  mockGetDocument.mockResolvedValue({
    _id: "post-abc123",
    _type: "post",
    language: "pt-br",
    title: validMeta.title,
    metadata: validMeta.metadata,
    gameVersion: validMeta.gameVersion,
    category: { _type: "reference", _ref: "cat-001" },
    slug: { _type: "slug", current: validMeta.slug },
    tags: validMeta.tags,
    author: { _type: "reference", _ref: "author-001" },
    publishedAt: validMeta.publishedAt,
    body: validBody,
  });
});

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("POST /api/sanity/publish — auth", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(
      buildRequest({ meta: validMeta, body: validBody, draftId: "post-abc123" }),
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });
});

// ─── Validation tests ─────────────────────────────────────────────────────────

describe("POST /api/sanity/publish — validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/sanity/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when draftId is missing", async () => {
    const res = await POST(
      buildRequest({ meta: validMeta, body: validBody }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("returns 400 when meta.title is missing", async () => {
    const res = await POST(
      buildRequest({
        meta: { ...validMeta, title: "" },
        body: validBody,
        draftId: "post-abc123",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty array", async () => {
    const res = await POST(
      buildRequest({ meta: validMeta, body: [], draftId: "post-abc123" }),
    );
    expect(res.status).toBe(400);
  });
});

// ─── Slug collision tests ─────────────────────────────────────────────────────

describe("POST /api/sanity/publish — slug collision", () => {
  it("returns 409 when slug already exists for same language", async () => {
    mockFetch.mockResolvedValue({
      _id: "existing-post-999",
      slug: { _type: "slug", current: validMeta.slug },
      language: "pt-br",
    });

    const res = await POST(
      buildRequest({ meta: validMeta, body: validBody, draftId: "post-abc123" }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Slug já em uso para este idioma");
    expect(data.existingId).toBe("existing-post-999");
    expect(data.slug).toBe(validMeta.slug);
  });

  it("does NOT return 409 when same slug exists but for different language", async () => {
    // Same slug, but the GROQ query filters by language — so for 'en' it won't match
    // the 'pt-br' post. Simulate no collision returned.
    mockFetch.mockResolvedValue(null);

    const enMeta = { ...validMeta, language: "en" };
    const res = await POST(
      buildRequest({ meta: enMeta, body: validBody, draftId: "post-abc123" }),
    );

    // Should proceed to publish (not 409)
    expect(res.status).toBe(200);
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/sanity/publish — success", () => {
  it("returns 200 with ok, postId, slug, language on success", async () => {
    const res = await POST(
      buildRequest({ meta: validMeta, body: validBody, draftId: "post-abc123" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.postId).toBe("post-abc123");
    expect(data.slug).toBe(validMeta.slug);
    expect(data.language).toBe("pt-br");
  });

  it("calls transaction.createOrReplace with Sanity reference shapes (not bare IDs)", async () => {
    await POST(
      buildRequest({ meta: validMeta, body: validBody, draftId: "post-abc123" }),
    );

    expect(mockTxCreateOrReplace).toHaveBeenCalledOnce();
    const arg = mockTxCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;

    // category and author must be references, not bare strings
    expect(arg.category).toEqual({ _type: "reference", _ref: "cat-001" });
    expect(arg.author).toEqual({ _type: "reference", _ref: "author-001" });
    // slug must be a slug object
    expect(arg.slug).toEqual({ _type: "slug", current: "guia-currency-trading" });
    // _id must be bare (no drafts. prefix) for publish
    expect(arg._id).toBe("post-abc123");
  });

  it("deletes drafts.<id> atomically in the same transaction", async () => {
    await POST(
      buildRequest({ meta: validMeta, body: validBody, draftId: "post-abc123" }),
    );

    expect(mockTxDelete).toHaveBeenCalledWith("drafts.post-abc123");
    expect(mockTxCommit).toHaveBeenCalledOnce();
  });
});
