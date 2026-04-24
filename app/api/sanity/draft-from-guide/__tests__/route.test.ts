/**
 * Integration-style tests for POST /api/sanity/draft-from-guide.
 *
 * We mock:
 *   - next-auth (getServerSession) to control auth state.
 *   - global fetch to control engine responses.
 *   - @sanity/client to avoid real Sanity writes.
 *
 * Session 10.e.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// ─── Mock Sanity client ────────────────────────────────────────────────────────

const mockCreateOrReplace = vi.fn().mockResolvedValue({ _id: "drafts.test-id" });

vi.mock("@/lib/sanity/client", () => ({
  getSanityClient: () => ({
    createOrReplace: mockCreateOrReplace,
  }),
}));

// ─── Mock nanoid (stable IDs in tests) ────────────────────────────────────────

let nanoidCounter = 0;
vi.mock("nanoid", () => ({
  nanoid: (size?: number) => {
    nanoidCounter++;
    // Return a fixed-length string so tests can assert on count, not on value.
    const base = `test-draft-id-${nanoidCounter}`;
    return size ? base.slice(0, size).padEnd(size, "x") : base;
  },
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import { getServerSession } from "next-auth";
import { POST } from "../route";

// ─── Minimal guide fixture ─────────────────────────────────────────────────────

const GUIDE_FIXTURE = {
  slug: "chaos-orb-farming",
  title: { "pt-br": "Farmar Caos", en: "Farm Chaos" },
  template: "build_guide",
  status: "published",
  generatedAt: "2026-04-24T00:00:00.000Z",
  sections: [
    {
      id: "s1",
      heading: "Introduction",
      content: { "pt-br": "Introdução aqui.", en: "Introduction here." },
      order: 0,
    },
    {
      id: "s2",
      heading: "Method",
      content: { "pt-br": "Método aqui.", en: "Method here." },
      order: 1,
    },
  ],
  meta: {
    title: { "pt-br": "Farmar Caos", en: "Farm Chaos" },
    description: { "pt-br": "Como farmar.", en: "How to farm." },
  },
};

// ─── Request factory ───────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/sanity/draft-from-guide", {
    method: "POST",
    headers: { "content-type": "application/json", "host": "localhost:3000" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/sanity/draft-from-guide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nanoidCounter = 0;
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = makeRequest({ guideSlug: "some-guide" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when body is missing guideSlug", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when body is invalid JSON structure", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });
    // Send an array instead of an object
    const req = makeRequest([1, 2, 3]);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when engine returns 404 for the guide", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });

    // Mock fetch so engine returns 404
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    const req = makeRequest({ guideSlug: "nonexistent-guide" });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nonexistent-guide");
  });

  it("creates 2 drafts (pt-br + en) by default on happy path", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => GUIDE_FIXTURE,
    } as unknown as Response);

    const req = makeRequest({ guideSlug: "chaos-orb-farming" });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.drafts).toHaveLength(2);
    expect(body.drafts.map((d: { language: string }) => d.language)).toEqual(
      expect.arrayContaining(["pt-br", "en"]),
    );
    expect(body.drafts[0].slug).toBe("chaos-orb-farming");
    expect(mockCreateOrReplace).toHaveBeenCalledTimes(2);
  });

  it("creates only 1 draft when languages: ['pt-br'] is specified", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => GUIDE_FIXTURE,
    } as unknown as Response);

    const req = makeRequest({ guideSlug: "chaos-orb-farming", languages: ["pt-br"] });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0].language).toBe("pt-br");
    expect(body.drafts[0].title).toBe("Farmar Caos");
    expect(mockCreateOrReplace).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when engine fetch throws a non-404 error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const req = makeRequest({ guideSlug: "broken-guide" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("draft document has correct _id prefix and language field", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => GUIDE_FIXTURE,
    } as unknown as Response);

    const req = makeRequest({ guideSlug: "chaos-orb-farming", languages: ["en"] });
    await POST(req);

    const callArg = mockCreateOrReplace.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof callArg._id).toBe("string");
    expect((callArg._id as string).startsWith("drafts.")).toBe(true);
    expect(callArg.language).toBe("en");
    expect(callArg._type).toBe("post");
  });
});
