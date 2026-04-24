/**
 * Tests for POST /api/benchmark/runs/[a]/evaluate
 *
 * Route: app/api/benchmark/runs/[a]/evaluate/route.ts
 *
 * Uses real DB (potc_test) for persistence assertions.
 * Mocks global.fetch to control OpenRouter responses.
 *
 * Session 13 — benchmark judge endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createBenchmarkRun,
  cleanupBenchmarkRuns,
} from "@/tests/factories/benchmark.factory";

// ─── Auth mock ───────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// ─── Import route after mocks ────────────────────────────────────────────────

import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

const VALID_VERDICT = {
  winner: "A",
  dimensions: {
    factualAccuracy: { winner: "A", rationale: "A had accurate gem names" },
    proseQuality: { winner: "B", rationale: "B flowed better" },
    structure: { winner: "tie", rationale: "Both well structured" },
    poeDomainKnowledge: { winner: "A", rationale: "A cited correct mechanics" },
    antiHallucination: { winner: "A", rationale: "A made no up items" },
  },
  overallRationale: "A wins on factual accuracy and domain knowledge",
  confidence: "high",
};

function mockOpenRouterSuccess(verdict = VALID_VERDICT, cost = 0.0012) {
  return {
    choices: [{ message: { content: JSON.stringify(verdict) } }],
    usage: { total_cost: cost },
  };
}

function makeRequest(runAId: string, runBId: string, body: object = {}) {
  return new NextRequest(
    `http://localhost:3000/api/benchmark/runs/${runAId}/evaluate?b=${runBId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeParams(runAId: string) {
  return { params: Promise.resolve({ a: runAId }) };
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanupBenchmarkRuns();
  vi.restoreAllMocks();
  // Ensure OPENROUTER_API_KEY is present for happy-path tests
  process.env.OPENROUTER_API_KEY = "test-key-123";
});

afterAll(async () => {
  await cleanupBenchmarkRuns();
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/benchmark/runs/[a]/evaluate", () => {
  describe("auth", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const runA = await createBenchmarkRun();
      const runB = await createBenchmarkRun();

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(401);
    });
  });

  describe("input validation", () => {
    it("returns 404 when run A does not exist", async () => {
      const runB = await createBenchmarkRun();
      const res = await POST(makeRequest("nonexistent-id", runB.id), makeParams("nonexistent-id"));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Run A not found/);
    });

    it("returns 404 when run B does not exist", async () => {
      const runA = await createBenchmarkRun();
      const res = await POST(makeRequest(runA.id, "nonexistent-b"), makeParams(runA.id));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/Run B not found/);
    });

    it("returns 400 when types mismatch", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "ideation" });

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockOpenRouterSuccess(),
      } as Response);

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Type mismatch/);
    });

    it("returns 400 when ?b param is missing", async () => {
      const runA = await createBenchmarkRun();
      const req = new NextRequest(
        `http://localhost:3000/api/benchmark/runs/${runA.id}/evaluate`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const res = await POST(req, makeParams(runA.id));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/\?b=/);
    });
  });

  describe("missing API key", () => {
    it("returns 500 when OPENROUTER_API_KEY is not set", async () => {
      delete process.env.OPENROUTER_API_KEY;

      const runA = await createBenchmarkRun();
      const runB = await createBenchmarkRun();

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/OPENROUTER_API_KEY/);

      // Restore for subsequent tests
      process.env.OPENROUTER_API_KEY = "test-key-123";
    });
  });

  describe("happy path", () => {
    it("persists evaluation with correct winner and costUsd", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });
      const expectedCost = 0.0025;

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockOpenRouterSuccess(VALID_VERDICT, expectedCost),
      } as Response);

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.winner).toBe("A");
      expect(body.costUsd).toBeCloseTo(expectedCost, 6);
      expect(body.runAId).toBe(runA.id);
      expect(body.runBId).toBe(runB.id);
      expect(body.judgeModel).toBe(JUDGE_MODEL);

      // Verify row in DB
      const dbRow = await prisma.benchmarkEvaluation.findUnique({
        where: { runAId_runBId_judgeModel: { runAId: runA.id, runBId: runB.id, judgeModel: JUDGE_MODEL } },
      });
      expect(dbRow).not.toBeNull();
      expect(dbRow!.winner).toBe("A");
      expect(dbRow!.costUsd).toBeCloseTo(expectedCost, 6);
    });
  });

  describe("malformed JSON retry", () => {
    it("retries once and persists successfully on second valid response", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });

      const fetchSpy = vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "not valid json{{{" } }], usage: { total_cost: 0.001 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterSuccess(VALID_VERDICT, 0.0015),
        } as Response);

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(200);
      // fetch called twice (initial + retry)
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const body = await res.json();
      expect(body.winner).toBe("A");
      // costUsd should be sum of both calls
      expect(body.costUsd).toBeCloseTo(0.001 + 0.0015, 5);
    });

    it("persists error record with winner=null when both attempts return garbage", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "garbage1" } }], usage: { total_cost: 0.001 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "garbage2" } }], usage: { total_cost: 0.001 } }),
        } as Response);

      const res = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.winner).toBeNull();

      const verdict = body.verdict as { error?: string; raw?: string };
      expect(verdict.error).toBe("judge returned invalid JSON");
      expect(verdict.raw).toContain("garbage2");

      // Verify row exists in DB with null winner
      const dbRow = await prisma.benchmarkEvaluation.findUnique({
        where: { runAId_runBId_judgeModel: { runAId: runA.id, runBId: runB.id, judgeModel: JUDGE_MODEL } },
      });
      expect(dbRow).not.toBeNull();
      expect(dbRow!.winner).toBeNull();
    });
  });

  describe("idempotency", () => {
    it("returns cached row on second POST with same pair (force=false default)", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockOpenRouterSuccess(),
      } as Response);

      // First call — hits OpenRouter
      const res1 = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res1.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call — should return cached row, no fetch
      const res2 = await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(res2.status).toBe(200);
      // fetch still called only once total
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.id).toBe(body2.id);
    });

    it("re-runs judge when force=true, overwriting the cached row", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockOpenRouterSuccess(),
      } as Response);

      // First call
      await POST(makeRequest(runA.id, runB.id), makeParams(runA.id));
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Force re-run
      const res2 = await POST(makeRequest(runA.id, runB.id, { force: true }), makeParams(runA.id));
      expect(res2.status).toBe(200);
      // fetch called again for force run
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Still only one row in DB (upserted)
      const rows = await prisma.benchmarkEvaluation.findMany({
        where: { runAId: runA.id, runBId: runB.id, judgeModel: JUDGE_MODEL },
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe("custom judgeModel", () => {
    it("uses the provided judgeModel and stores it on the row", async () => {
      const runA = await createBenchmarkRun({ type: "qa" });
      const runB = await createBenchmarkRun({ type: "qa" });

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockOpenRouterSuccess(),
      } as Response);

      const customModel = "openai/gpt-4o";
      const res = await POST(
        makeRequest(runA.id, runB.id, { judgeModel: customModel }),
        makeParams(runA.id),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.judgeModel).toBe(customModel);

      const dbRow = await prisma.benchmarkEvaluation.findUnique({
        where: { runAId_runBId_judgeModel: { runAId: runA.id, runBId: runB.id, judgeModel: customModel } },
      });
      expect(dbRow?.judgeModel).toBe(customModel);
    });
  });
});
