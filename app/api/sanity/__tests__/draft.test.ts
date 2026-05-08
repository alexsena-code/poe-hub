/**
 * Tests for PUT and GET /api/sanity/draft/[id]
 *
 * Route: app/api/sanity/draft/[id]/route.ts
 *
 * Session 10.c — tests for the new partial meta + body shape (PUT) and
 * the EditorMetaForm-friendly reverse transform (GET).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../draft/[id]/route";

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

// ─── Sanity client mock ───────────────────────────────────────────────────────

const mockCreateOrReplace = vi.fn();
const mockGetDocument = vi.fn();
const mockDelete = vi.fn();
const mockTransactionCommit = vi.fn();

// deletePost (used by DELETE handler) uses a transaction:
// `client.transaction().delete(draftId).delete(baseId).commit()`. The chained
// .delete() returns the same transaction object so each call must be reachable
// via that object, hence the self-referential builder below.
function makeTransactionStub() {
  const tx: { delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> } = {
    delete: vi.fn(),
    commit: mockTransactionCommit,
  };
  tx.delete.mockReturnValue(tx);
  return tx;
}

vi.mock("@/lib/sanity/client", () => ({
  getSanityClient: () => ({
    createOrReplace: mockCreateOrReplace,
    getDocument: mockGetDocument,
    delete: mockDelete,
    transaction: () => makeTransactionStub(),
  }),
}));

// ─── Route context helper ─────────────────────────────────────────────────────

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildPutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sanity/draft/post-abc123", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const partialMeta = {
  language: "pt-br" as const,
  title: "Rascunho parcial",
  categoryId: "cat-001",
  authorId: "author-001",
};

const sanityDraftDoc = {
  _id: "drafts.post-abc123",
  _type: "post",
  language: "pt-br",
  title: "Guia salvo",
  metadata: "Descrição SEO salva.",
  slug: { _type: "slug", current: "guia-salvo" },
  gameVersion: "path-of-exile-2",
  category: { _type: "reference", _ref: "cat-001" },
  author: { _type: "reference", _ref: "author-001" },
  tags: ["currency"],
  mainImage: {
    _type: "image",
    asset: { _type: "reference", _ref: "image-asset-001" },
  },
  publishedAt: "2026-04-24T10:00:00.000Z",
  body: [],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
  mockCreateOrReplace.mockResolvedValue({ _id: "drafts.post-abc123" });
  mockGetDocument.mockResolvedValue(sanityDraftDoc);
  mockDelete.mockResolvedValue({});
  mockTransactionCommit.mockResolvedValue({});
});

// ─── PUT tests ────────────────────────────────────────────────────────────────

describe("PUT /api/sanity/draft/[id]", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await PUT(
      buildPutRequest({ meta: partialMeta, body: [] }),
      makeContext("post-abc123"),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when language is missing in meta", async () => {
    const res = await PUT(
      buildPutRequest({ meta: { title: "No language" }, body: [] }),
      makeContext("post-abc123"),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("creates draft with drafts.<id> _id in Sanity", async () => {
    const res = await PUT(
      buildPutRequest({ meta: partialMeta, body: [] }),
      makeContext("post-abc123"),
    );

    expect(res.status).toBe(200);
    expect(mockCreateOrReplace).toHaveBeenCalledOnce();

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("drafts.post-abc123");
    expect(arg._type).toBe("post");
  });

  it("converts categoryId and authorId to Sanity references", async () => {
    await PUT(
      buildPutRequest({ meta: partialMeta, body: [] }),
      makeContext("post-abc123"),
    );

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.category).toEqual({ _type: "reference", _ref: "cat-001" });
    expect(arg.author).toEqual({ _type: "reference", _ref: "author-001" });
  });

  it("omits reference fields when IDs are absent in partial meta", async () => {
    const minimalMeta = { language: "pt-br" as const };

    await PUT(
      buildPutRequest({ meta: minimalMeta, body: [] }),
      makeContext("post-abc123"),
    );

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect("category" in arg).toBe(false);
    expect("author" in arg).toBe(false);
  });

  it("returns ok, draftId, savedAt on success", async () => {
    const res = await PUT(
      buildPutRequest({ meta: partialMeta, body: [] }),
      makeContext("post-abc123"),
    );

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.draftId).toBe("post-abc123");
    expect(typeof data.savedAt).toBe("string");
  });

  it("strips drafts. prefix from id param before building draftId", async () => {
    await PUT(
      buildPutRequest({ meta: partialMeta, body: [] }),
      makeContext("drafts.post-abc123"),
    );

    const arg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(arg._id).toBe("drafts.post-abc123");
  });
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe("GET /api/sanity/draft/[id]", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/sanity/draft/post-abc123");
    const res = await GET(req, makeContext("post-abc123"));

    expect(res.status).toBe(401);
  });

  it("returns 404 when draft not found", async () => {
    mockGetDocument.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/sanity/draft/post-abc123");
    const res = await GET(req, makeContext("post-abc123"));

    expect(res.status).toBe(404);
  });

  it("returns EditorMetaForm-friendly shape (IDs, not references)", async () => {
    const req = new NextRequest("http://localhost/api/sanity/draft/post-abc123");
    const res = await GET(req, makeContext("post-abc123"));

    expect(res.status).toBe(200);
    const data = await res.json();

    // References must be unwrapped to bare IDs
    expect(data.meta.categoryId).toBe("cat-001");
    expect(data.meta.authorId).toBe("author-001");
    expect(data.meta.mainImageAssetId).toBe("image-asset-001");
    // Slug object must be unwrapped to string
    expect(data.meta.slug).toBe("guia-salvo");
    // language passes through
    expect(data.meta.language).toBe("pt-br");
    expect(data.draftId).toBe("post-abc123");
  });
});

// ─── DELETE tests ─────────────────────────────────────────────────────────────

describe("DELETE /api/sanity/draft/[id]", () => {
  it("returns 204 on success", async () => {
    const req = new NextRequest("http://localhost/api/sanity/draft/post-abc123", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeContext("post-abc123"));

    expect(res.status).toBe(204);
  });
});
