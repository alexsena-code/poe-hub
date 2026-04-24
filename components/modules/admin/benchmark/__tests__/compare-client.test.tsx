// @vitest-environment jsdom
/**
 * Tests for BenchmarkCompareClient.
 *
 * The component receives all run data via props (SSR-fed from the RSC shell).
 * The only network interaction is the POST to the evaluate endpoint when the
 * operator clicks "Run judge" or "Re-run (force)".
 *
 * Cases:
 *   1. Metrics cards render correct A → B values
 *   2. Per-node breakdown table sums events correctly
 *   3. Judge section shows "Run judge" when no evaluation exists
 *   4. Judge section shows verdict when existingEvaluation is supplied
 *   5. Clicking "Run judge" triggers POST and renders verdict on success
 *   6. Error verdict renders the error card
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

/// <reference types="@testing-library/jest-dom" />
import "@testing-library/jest-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Mock sonner (toast) — prevents missing context errors in jsdom
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { BenchmarkCompareClient } from "../compare-client";
import type { RunForCompare, EvaluationForCompare } from "../compare-client";
import type { BenchmarkCollectorEvent } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLlmEvent(
  node: string,
  tOffsetMs: number,
  costUsd = 0.01,
  latencyMs = 200,
): BenchmarkCollectorEvent & { kind: "llm" } {
  return {
    kind: "llm",
    node,
    model: "test/model",
    systemPrompt: "sys",
    userMessage: "usr",
    response: "resp",
    inputTokens: 100,
    outputTokens: 50,
    costUsd,
    latencyMs,
    tOffsetMs,
  };
}

const BASE_TELEMETRY = {
  startedAt: "2026-04-24T10:00:00.000Z",
  endedAt: "2026-04-24T10:00:05.000Z",
};

function makeRun(overrides: Partial<RunForCompare> = {}): RunForCompare {
  return {
    id: "run-a-uuid-0001",
    type: "qa",
    modelOverrides: {},
    requestBody: { question: "What is PoE?" },
    response: {
      result: { answer: "Path of Exile is an ARPG." },
      telemetry: {
        ...BASE_TELEMETRY,
        totalDurationMs: 3000,
        totalCostUsd: 0.02,
        llmCallCount: 2,
        qdrantQueryCount: 1,
        events: [makeLlmEvent("write", 0, 0.01, 200), makeLlmEvent("critique", 500, 0.01, 300)],
      },
    },
    totalCostUsd: 0.02,
    totalDurationMs: 3000,
    llmCallCount: 2,
    qdrantQueryCount: 1,
    httpStatus: 200,
    error: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    preset: null,
    evaluationsAsA: [],
    evaluationsAsB: [],
    ...overrides,
  };
}

function makeRunB(overrides: Partial<RunForCompare> = {}): RunForCompare {
  return {
    id: "run-b-uuid-0002",
    type: "qa",
    modelOverrides: { write: "openai/gpt-4o" },
    requestBody: { question: "What is PoE?" },
    response: {
      result: { answer: "Path of Exile is a dark ARPG." },
      telemetry: {
        ...BASE_TELEMETRY,
        totalDurationMs: 2000,
        totalCostUsd: 0.015,
        llmCallCount: 1,
        qdrantQueryCount: 1,
        events: [makeLlmEvent("write", 0, 0.015, 180)],
      },
    },
    totalCostUsd: 0.015,
    totalDurationMs: 2000,
    llmCallCount: 1,
    qdrantQueryCount: 1,
    httpStatus: 200,
    error: null,
    createdAt: "2026-04-24T10:05:00.000Z",
    preset: null,
    evaluationsAsA: [],
    evaluationsAsB: [],
    ...overrides,
  };
}

function makeEvaluation(
  winner: "A" | "B" | "tie" | null = "B",
  verdictOverride?: Record<string, unknown>,
): EvaluationForCompare {
  const defaultVerdict = {
    winner,
    dimensions: {
      factualAccuracy: { winner: "B", rationale: "B has more accurate facts." },
      proseQuality: { winner: "B", rationale: "B is clearer." },
      structure: { winner: "tie", rationale: "Both structured well." },
      poeDomainKnowledge: { winner: "B", rationale: "B knows PoE better." },
      antiHallucination: { winner: "A", rationale: "A hallucinates less." },
    },
    overallRationale: "Run B is marginally better overall.",
    confidence: "high",
  };

  return {
    id: "eval-uuid-0001",
    runAId: "run-a-uuid-0001",
    runBId: "run-b-uuid-0002",
    judgeModel: "anthropic/claude-sonnet-4.6",
    verdict: verdictOverride ?? defaultVerdict,
    winner,
    costUsd: 0.005,
    createdAt: "2026-04-24T10:10:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BenchmarkCompareClient", () => {
  // ── Case 1: Metrics cards render correct A → B values ──────────────────

  it("renders stat cards with A and B metric values", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    // Cost values appear in stat cards and possibly the per-node table — use AllBy
    // $0.020000 appears in the Total Cost card (run A side)
    const costAElements = screen.getAllByText("$0.020000");
    expect(costAElements.length).toBeGreaterThan(0);

    // $0.015000 appears in the Total Cost card (run B side)
    const costBElements = screen.getAllByText("$0.015000");
    expect(costBElements.length).toBeGreaterThan(0);

    // LLM calls stat card shows "2" for A
    const twoEls = screen.getAllByText("2");
    expect(twoEls.length).toBeGreaterThan(0);
  });

  it("shows negative delta (green) for cost when B is cheaper", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    // computeDelta(0.02, 0.015) → -25%
    // May appear in stat card and per-node table
    const matches = screen.getAllByText("-25.0%");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows N/A percent when run A cost is zero (div-by-zero guard)", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun({ totalCostUsd: 0 })}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    const naEls = screen.getAllByText("N/A");
    expect(naEls.length).toBeGreaterThan(0);
  });

  it("shows 0.0% delta when A and B values are equal", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun({ totalDurationMs: 2000 })}
        runB={makeRunB({ totalDurationMs: 2000 })}
        existingEvaluation={null}
      />,
    );

    // formatPercent(0) renders "0.0%" (no sign for zero).
    // Multiple instances may appear across stat cards and table.
    const zeroPcts = screen.getAllByText("0.0%");
    expect(zeroPcts.length).toBeGreaterThan(0);
  });

  // ── Case 2: Per-node table sums events correctly ────────────────────────

  it("renders per-node breakdown table with node names from events", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    // "write" is present in both; "critique" only in A
    expect(screen.getByText("write")).toBeInTheDocument();
    expect(screen.getByText("critique")).toBeInTheDocument();
  });

  // ── Case 3: Judge section shows "Run judge" when no evaluation ──────────

  it("shows Run judge button when existingEvaluation is null", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    expect(screen.getByRole("button", { name: /Run judge/i })).toBeInTheDocument();
  });

  it("shows judge model select when no evaluation exists", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    // The SelectTrigger renders the current model label
    expect(screen.getByText(/Claude Sonnet 4.6/i)).toBeInTheDocument();
  });

  // ── Case 4: Shows verdict when existingEvaluation supplied ─────────────

  it("renders verdict winner badge and dimensions when evaluation exists", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={makeEvaluation("B")}
      />,
    );

    // "Run B wins" appears in the top badge and possibly per-dimension badges
    const winnerBadges = screen.getAllByText("Run B wins");
    expect(winnerBadges.length).toBeGreaterThan(0);
    expect(screen.getByText("Confidence: high")).toBeInTheDocument();
    expect(screen.getByText("B has more accurate facts.")).toBeInTheDocument();
  });

  it("renders Re-run (force) button when evaluation exists", () => {
    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={makeEvaluation()}
      />,
    );

    expect(screen.getByRole("button", { name: /Re-run \(force\)/i })).toBeInTheDocument();
  });

  // ── Case 5: Clicking Run judge triggers POST and renders result ─────────

  it("clicking Run judge sends POST and renders verdict on success", async () => {
    const user = userEvent.setup();

    const fakeEval = makeEvaluation("A");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(fakeEval), { status: 200 }),
    );

    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Run judge/i }));

    // POST should have been called
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/evaluate"),
      expect.objectContaining({ method: "POST" }),
    );

    // Wait for verdict to render — "Run A wins" may appear in multiple badges
    await waitFor(() => {
      const badges = screen.getAllByText("Run A wins");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("shows error toast when POST fails", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set" }), { status: 500 }),
    );

    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Run judge/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("OPENROUTER_API_KEY not set"),
      );
    });
  });

  // ── Case 6: Error verdict renders error card ────────────────────────────

  it("renders error card when verdict has error field", () => {
    const errorVerdict: Record<string, unknown> = {
      error: "judge returned invalid JSON",
      raw: '{"incomplete":',
    };

    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={makeEvaluation(null, errorVerdict)}
      />,
    );

    expect(screen.getByText("Judge failed")).toBeInTheDocument();
    expect(screen.getByText("judge returned invalid JSON")).toBeInTheDocument();
  });

  it("expands raw output in error card when button is clicked", async () => {
    const user = userEvent.setup();
    const errorVerdict: Record<string, unknown> = {
      error: "malformed response",
      raw: "UNPARSEABLE_OUTPUT",
    };

    render(
      <BenchmarkCompareClient
        runA={makeRun()}
        runB={makeRunB()}
        existingEvaluation={makeEvaluation(null, errorVerdict)}
      />,
    );

    await user.click(screen.getByText("Raw judge output"));
    expect(screen.getByText("UNPARSEABLE_OUTPUT")).toBeInTheDocument();
  });
});
