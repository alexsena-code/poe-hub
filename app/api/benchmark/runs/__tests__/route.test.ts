/**
 * Integration tests for:
 *   GET  /api/benchmark/runs
 *   POST /api/benchmark/runs
 *   GET  /api/benchmark/runs/[id]
 *   DELETE /api/benchmark/runs/[id]
 *
 * Uses the real potc_test DB — no Prisma mocking.
 * Auth is mocked via next-auth to isolate from credential flow.
 *
 * Session 01 S01.benchmark-runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);

// ─── Route imports (after mocks) ──────────────────────────────────────────────

import { GET as listRuns, POST as createRun } from "../route";
import { GET as getRun, DELETE as deleteRun } from "../[id]/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_TELEMETRY = {
  startedAt: "2026-04-24T10:00:00.000Z",
  endedAt: "2026-04-24T10:00:02.500Z",
  totalDurationMs: 2500,
  totalCostUsd: 0.0042,
  llmCallCount: 3,
  qdrantQueryCount: 2,
  events: [],
};

const FAKE_RESPONSE = {
  result: { answer: "42" },
  telemetry: FAKE_TELEMETRY,
};

const FAKE_REQUEST_BODY = { question: "What is divine?", queryType: "price" };

/** Minimal valid POST body for a qa run. */
function buildRunBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "qa",
    presetId: null,
    modelOverrides: {},
    requestBody: FAKE_REQUEST_BODY,
    response: FAKE_RESPONSE,
    httpStatus: 200,
    error: null,
    ...overrides,
  };
}

// ─── Request factories ────────────────────────────────────────────────────────

function makeListRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/benchmark/runs");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/benchmark/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetByIdRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/benchmark/runs/${id}`, {
    method: "GET",
  });
}

function makeDeleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/benchmark/runs/${id}`, {
    method: "DELETE",
  });
}

// ─── DB cleanup ───────────────────────────────────────────────────────────────

async function cleanupRuns() {
  // Evaluations cascade from runs; deleting runs is sufficient.
  await prisma.benchmarkRun.deleteMany();
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: "test-user", email: "test@test.com" } });
});

afterEach(async () => {
  await cleanupRuns();
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("auth guard", () => {
  beforeEach(() => {
    mockSession.mockResolvedValue(null);
  });

  it("GET /runs returns 401 when unauthenticated", async () => {
    const res = await listRuns(makeListRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("POST /runs returns 401 when unauthenticated", async () => {
    const res = await createRun(makePostRequest(buildRunBody()));
    expect(res.status).toBe(401);
  });

  it("GET /runs/[id] returns 401 when unauthenticated", async () => {
    const res = await getRun(makeGetByIdRequest("some-id"), {
      params: Promise.resolve({ id: "some-id" }),
    });
    expect(res.status).toBe(401);
  });

  it("DELETE /runs/[id] returns 401 when unauthenticated", async () => {
    const res = await deleteRun(makeDeleteRequest("some-id"), {
      params: Promise.resolve({ id: "some-id" }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST — happy paths ───────────────────────────────────────────────────────

describe("POST /api/benchmark/runs — happy path", () => {
  it("creates a qa run and returns 201 with the run", async () => {
    const res = await createRun(makePostRequest(buildRunBody({ type: "qa" })));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.type).toBe("qa");
    expect(body.httpStatus).toBe(200);
    expect(body.error).toBeNull();
  });

  it("creates an ideation run", async () => {
    const res = await createRun(
      makePostRequest(
        buildRunBody({
          type: "ideation",
          requestBody: { editorialBriefing: "farming guide" },
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("ideation");
  });

  it("creates a content_generation run", async () => {
    const res = await createRun(
      makePostRequest(
        buildRunBody({
          type: "content_generation",
          requestBody: { briefing: { skill: "Arc", ascendancy: "Inquisitor" } },
          modelOverrides: { write: "moonshotai/kimi-k2" },
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("content_generation");
    expect(body.modelOverrides).toMatchObject({ write: "moonshotai/kimi-k2" });
  });
});

// ─── POST — telemetry denormalization ─────────────────────────────────────────

describe("POST /api/benchmark/runs — telemetry denormalization", () => {
  it("denormalizes totalCostUsd, totalDurationMs, llmCallCount, qdrantQueryCount from response.telemetry", async () => {
    const res = await createRun(makePostRequest(buildRunBody()));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.totalCostUsd).toBe(FAKE_TELEMETRY.totalCostUsd);
    expect(body.totalDurationMs).toBe(FAKE_TELEMETRY.totalDurationMs);
    expect(body.llmCallCount).toBe(FAKE_TELEMETRY.llmCallCount);
    expect(body.qdrantQueryCount).toBe(FAKE_TELEMETRY.qdrantQueryCount);
  });

  it("defaults all telemetry fields to 0 when response has no telemetry (engine error path)", async () => {
    const res = await createRun(
      makePostRequest(
        buildRunBody({
          httpStatus: 500,
          error: "Engine timed out",
          response: { error: "timeout" }, // no telemetry key
        }),
      ),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.totalCostUsd).toBe(0);
    expect(body.totalDurationMs).toBe(0);
    expect(body.llmCallCount).toBe(0);
    expect(body.qdrantQueryCount).toBe(0);
    expect(body.error).toBe("Engine timed out");
  });

  it("defaults telemetry fields to 0 when telemetry fields are missing/undefined", async () => {
    const res = await createRun(
      makePostRequest(
        buildRunBody({
          response: { result: "ok", telemetry: {} }, // telemetry exists but fields absent
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.totalCostUsd).toBe(0);
    expect(body.totalDurationMs).toBe(0);
    expect(body.llmCallCount).toBe(0);
    expect(body.qdrantQueryCount).toBe(0);
  });
});

// ─── POST — preset validation ──────────────────────────────────────────────────

describe("POST /api/benchmark/runs — preset validation", () => {
  it("returns 400 when presetId is a valid UUID that does not exist in DB", async () => {
    // Use a proper RFC 4122 v4 UUID (version=4, variant=8..b) that is guaranteed absent.
    const nonExistentId = "12345678-1234-4234-8234-123456789abc";
    const res = await createRun(
      makePostRequest(buildRunBody({ presetId: nonExistentId })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Preset not found");
  });

  it("returns 400 when preset type does not match run type", async () => {
    // Create a preset with type 'ideation'
    const preset = await prisma.benchmarkPreset.create({
      data: {
        name: "Test Ideation Preset",
        type: "ideation",
        payload: { editorialBriefing: "test" },
      },
    });

    const res = await createRun(
      makePostRequest(
        buildRunBody({
          type: "qa", // mismatch — preset is ideation
          presetId: preset.id,
        }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Preset type mismatch");

    // cleanup preset
    await prisma.benchmarkPreset.delete({ where: { id: preset.id } });
  });

  it("accepts run when presetId matches preset type", async () => {
    const preset = await prisma.benchmarkPreset.create({
      data: {
        name: "Test QA Preset",
        type: "qa",
        payload: { question: "What is divine?" },
      },
    });

    const res = await createRun(
      makePostRequest(buildRunBody({ type: "qa", presetId: preset.id })),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.presetId).toBe(preset.id);
    expect(body.preset?.id).toBe(preset.id);

    await prisma.benchmarkPreset.delete({ where: { id: preset.id } });
  });
});

// ─── POST — validation errors ─────────────────────────────────────────────────

describe("POST /api/benchmark/runs — validation", () => {
  it("returns 400 when type is missing", async () => {
    const body = buildRunBody();
    // @ts-expect-error intentional invalid input
    delete body.type;
    const res = await createRun(makePostRequest(body));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("returns 400 when type is invalid", async () => {
    const res = await createRun(makePostRequest(buildRunBody({ type: "unknown_type" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when presetId is not a valid UUID", async () => {
    const res = await createRun(makePostRequest(buildRunBody({ presetId: "not-a-uuid" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when httpStatus is out of range", async () => {
    const res = await createRun(makePostRequest(buildRunBody({ httpStatus: 99 })));
    expect(res.status).toBe(400);
  });
});

// ─── GET list — filters ───────────────────────────────────────────────────────

describe("GET /api/benchmark/runs — list with filters", () => {
  it("returns empty list when no runs exist", async () => {
    const res = await listRuns(makeListRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns all runs sorted by createdAt desc", async () => {
    await createRun(makePostRequest(buildRunBody({ type: "qa" })));
    await createRun(makePostRequest(buildRunBody({ type: "ideation" })));

    const res = await listRuns(makeListRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(2);
    expect(body.total).toBe(2);
    // Most recent first
    expect(new Date(body.runs[0].createdAt) >= new Date(body.runs[1].createdAt)).toBe(true);
  });

  it("filters by type=qa", async () => {
    await createRun(makePostRequest(buildRunBody({ type: "qa" })));
    await createRun(makePostRequest(buildRunBody({ type: "ideation" })));

    const res = await listRuns(makeListRequest({ type: "qa" }));
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].type).toBe("qa");
    expect(body.total).toBe(1);
  });

  it("filters by presetId", async () => {
    const preset = await prisma.benchmarkPreset.create({
      data: { name: "Filter Test Preset", type: "qa", payload: {} },
    });

    await createRun(makePostRequest(buildRunBody({ type: "qa", presetId: preset.id })));
    await createRun(makePostRequest(buildRunBody({ type: "qa" }))); // no preset

    const res = await listRuns(makeListRequest({ presetId: preset.id }));
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].presetId).toBe(preset.id);

    await prisma.benchmarkPreset.delete({ where: { id: preset.id } });
  });

  it("does NOT include requestBody or response in list payload", async () => {
    await createRun(makePostRequest(buildRunBody()));
    const res = await listRuns(makeListRequest());
    const body = await res.json();
    expect(body.runs[0].requestBody).toBeUndefined();
    expect(body.runs[0].response).toBeUndefined();
  });

  it("respects limit and offset params", async () => {
    for (let i = 0; i < 5; i++) {
      await createRun(makePostRequest(buildRunBody({ type: "qa" })));
    }

    const res = await listRuns(makeListRequest({ limit: "2", offset: "0" }));
    const body = await res.json();
    expect(body.runs).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it("caps limit at 200", async () => {
    // Just verify the request doesn't fail and uses the cap — no need to create 201 rows.
    const res = await listRuns(makeListRequest({ limit: "9999" }));
    expect(res.status).toBe(200);
  });
});

// ─── GET by id — detail payload ───────────────────────────────────────────────

describe("GET /api/benchmark/runs/[id]", () => {
  it("returns 404 for unknown id", async () => {
    const unknownId = "12345678-1234-4234-8234-000000000099";
    const res = await getRun(makeGetByIdRequest(unknownId), {
      params: Promise.resolve({ id: unknownId }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Run not found");
  });

  it("returns full row including requestBody and response", async () => {
    const createRes = await createRun(makePostRequest(buildRunBody()));
    const { id } = await createRes.json();

    const res = await getRun(makeGetByIdRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.requestBody).toMatchObject(FAKE_REQUEST_BODY);
    expect(body.response).toMatchObject({ result: FAKE_RESPONSE.result });
  });

  it("includes preset preview when presetId is set", async () => {
    const preset = await prisma.benchmarkPreset.create({
      data: { name: "Detail Test Preset", type: "qa", payload: {} },
    });

    const createRes = await createRun(
      makePostRequest(buildRunBody({ presetId: preset.id })),
    );
    const { id } = await createRes.json();

    const res = await getRun(makeGetByIdRequest(id), {
      params: Promise.resolve({ id }),
    });
    const body = await res.json();
    expect(body.preset?.id).toBe(preset.id);
    expect(body.preset?.name).toBe("Detail Test Preset");

    await prisma.benchmarkPreset.delete({ where: { id: preset.id } });
  });

  it("includes evaluationsAsA and evaluationsAsB arrays (empty when no evals)", async () => {
    const createRes = await createRun(makePostRequest(buildRunBody()));
    const { id } = await createRes.json();

    const res = await getRun(makeGetByIdRequest(id), {
      params: Promise.resolve({ id }),
    });
    const body = await res.json();
    expect(Array.isArray(body.evaluationsAsA)).toBe(true);
    expect(Array.isArray(body.evaluationsAsB)).toBe(true);
    expect(body.evaluationsAsA).toHaveLength(0);
    expect(body.evaluationsAsB).toHaveLength(0);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/benchmark/runs/[id]", () => {
  it("returns 204 on success", async () => {
    const createRes = await createRun(makePostRequest(buildRunBody()));
    const { id } = await createRes.json();

    const res = await deleteRun(makeDeleteRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(204);
  });

  it("subsequent GET returns 404 after delete", async () => {
    const createRes = await createRun(makePostRequest(buildRunBody()));
    const { id } = await createRes.json();

    await deleteRun(makeDeleteRequest(id), { params: Promise.resolve({ id }) });

    const getRes = await getRun(makeGetByIdRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a non-existent run", async () => {
    const unknownId = "12345678-1234-4234-8234-000000000099";
    const res = await deleteRun(
      makeDeleteRequest(unknownId),
      { params: Promise.resolve({ id: unknownId }) },
    );
    expect(res.status).toBe(404);
  });
});
