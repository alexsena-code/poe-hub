/**
 * Integration tests for:
 *   GET  /api/benchmark/presets
 *   POST /api/benchmark/presets
 *
 * Uses the real `potc_test` DB (per CLAUDE.md — no Prisma mocks).
 * Auth is mocked via vi.mock("next-auth") so we don't need a live NextAuth
 * session, but DB calls go to the real test database.
 *
 * Session 13 S13.a — benchmark presets CRUD.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);

// ─── Route imports (after mock) ───────────────────────────────────────────────

import { GET, POST } from "../route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

const BASE_URL = "http://localhost/api/benchmark/presets";

async function cleanupPresets(): Promise<void> {
  await prisma.benchmarkPreset.deleteMany();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: "test-user", name: "admin" } });
  await cleanupPresets();
});

afterAll(async () => {
  await cleanupPresets();
  await prisma.$disconnect();
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("GET /api/benchmark/presets — auth", () => {
  it("returns 401 when no session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(buildReq(BASE_URL, "GET"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });
});

describe("POST /api/benchmark/presets — auth", () => {
  it("returns 401 when no session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      buildReq(BASE_URL, "POST", { name: "x", type: "qa", payload: { question: "q?" } }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST happy paths (one per type) ─────────────────────────────────────────

describe("POST /api/benchmark/presets — create", () => {
  it("creates a qa preset and returns 201", async () => {
    const body = {
      name: "QA smoke",
      type: "qa",
      payload: { question: "What build?", language: "pt" },
      notes: "smoke test",
    };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe("QA smoke");
    expect(data.type).toBe("qa");
    expect(data.payload).toMatchObject({ question: "What build?", language: "pt" });
    expect(data.notes).toBe("smoke test");
    expect(data.createdAt).toBeDefined();
  });

  it("creates an ideation preset and returns 201", async () => {
    const body = {
      name: "Ideation smoke",
      type: "ideation",
      payload: {
        editorialBriefing: "Focus on Necromancer builds",
        templateFilter: ["guide", "tier-list"],
        modelOverride: "openai/gpt-4o",
      },
    };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.type).toBe("ideation");
    expect(data.payload).toMatchObject({ editorialBriefing: "Focus on Necromancer builds" });
  });

  it("creates a content_generation preset and returns 201", async () => {
    const body = {
      name: "ContentGen smoke",
      type: "content_generation",
      payload: {
        briefing: {
          skill: "Tornado Shot",
          ascendancy: "Deadeye",
          league: "Settlers",
        },
      },
    };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.type).toBe("content_generation");
    expect(data.payload).toMatchObject({ briefing: { skill: "Tornado Shot" } });
  });
});

// ─── POST validation failures ─────────────────────────────────────────────────

describe("POST /api/benchmark/presets — validation", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when qa payload is missing required question field", async () => {
    const body = {
      name: "Bad QA",
      type: "qa",
      payload: { language: "pt" }, // missing question
    };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.details).toBeDefined();
  });

  it("returns 400 when content_generation payload is missing required briefing.skill", async () => {
    const body = {
      name: "Bad ContentGen",
      type: "content_generation",
      payload: {
        briefing: { ascendancy: "Deadeye" }, // missing skill
      },
    };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("returns 400 when type is unknown", async () => {
    const body = { name: "Bad", type: "unknown_type", payload: {} };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    const body = { name: "", type: "qa", payload: { question: "test?" } };
    const res = await POST(buildReq(BASE_URL, "POST", body));
    expect(res.status).toBe(400);
  });
});

// ─── POST duplicate (name, type) → 409 ───────────────────────────────────────

describe("POST /api/benchmark/presets — duplicate", () => {
  it("returns 409 when (name, type) already exists", async () => {
    const body = {
      name: "Dupe Preset",
      type: "qa",
      payload: { question: "First?" },
    };
    // First create succeeds
    const first = await POST(buildReq(BASE_URL, "POST", body));
    expect(first.status).toBe(201);

    // Second with same (name, type) → 409
    const second = await POST(buildReq(BASE_URL, "POST", {
      ...body,
      payload: { question: "Second?" },
    }));
    expect(second.status).toBe(409);
    const data = await second.json();
    expect(data.error).toMatch(/already exists/i);
    expect(data.error).toContain("Dupe Preset");
  });

  it("allows same name with different type", async () => {
    const name = "SharedName";
    const qa = await POST(buildReq(BASE_URL, "POST", {
      name,
      type: "qa",
      payload: { question: "What?" },
    }));
    expect(qa.status).toBe(201);

    const ideation = await POST(buildReq(BASE_URL, "POST", {
      name,
      type: "ideation",
      payload: {},
    }));
    expect(ideation.status).toBe(201);
  });
});

// ─── GET list + ?type filter ──────────────────────────────────────────────────

describe("GET /api/benchmark/presets — list", () => {
  it("returns empty list when no presets exist", async () => {
    const res = await GET(buildReq(BASE_URL, "GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.presets).toEqual([]);
  });

  it("returns all presets sorted by updatedAt desc", async () => {
    await POST(buildReq(BASE_URL, "POST", { name: "First", type: "qa", payload: { question: "a?" } }));
    await POST(buildReq(BASE_URL, "POST", { name: "Second", type: "qa", payload: { question: "b?" } }));

    const res = await GET(buildReq(BASE_URL, "GET"));
    const data = await res.json();

    expect(data.presets).toHaveLength(2);
    // Most recently created comes first (updatedAt desc)
    expect(data.presets[0].name).toBe("Second");
    expect(data.presets[1].name).toBe("First");
  });

  it("filters by ?type=qa", async () => {
    await POST(buildReq(BASE_URL, "POST", { name: "QA one", type: "qa", payload: { question: "q?" } }));
    await POST(buildReq(BASE_URL, "POST", { name: "Idea one", type: "ideation", payload: {} }));

    const res = await GET(buildReq(`${BASE_URL}?type=qa`, "GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.presets).toHaveLength(1);
    expect(data.presets[0].name).toBe("QA one");
  });

  it("filters by ?type=ideation", async () => {
    await POST(buildReq(BASE_URL, "POST", { name: "QA one", type: "qa", payload: { question: "q?" } }));
    await POST(buildReq(BASE_URL, "POST", { name: "Idea one", type: "ideation", payload: {} }));
    await POST(buildReq(BASE_URL, "POST", {
      name: "CG one",
      type: "content_generation",
      payload: { briefing: { skill: "Spark", ascendancy: "Hierophant" } },
    }));

    const res = await GET(buildReq(`${BASE_URL}?type=ideation`, "GET"));
    const data = await res.json();
    expect(data.presets).toHaveLength(1);
    expect(data.presets[0].type).toBe("ideation");
  });

  it("returns 400 for invalid ?type value", async () => {
    const res = await GET(buildReq(`${BASE_URL}?type=invalid`, "GET"));
    expect(res.status).toBe(400);
  });
});
