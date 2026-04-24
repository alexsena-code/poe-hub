// @vitest-environment jsdom
/**
 * Unit tests for useBenchmarkRunner.
 *
 * The hook enqueues a job via POST (202 async), then polls GET
 * /api/engine/benchmark/jobs/:jobId until completed/failed/timeout.
 *
 * Tests:
 *   - Happy path: 202 enqueue, active → completed → result is telemetry snapshot
 *   - Engine returns failed → error set, result null
 *   - Timeout: polling exceeds deadline → error mentions timeout
 *   - reset() during polling: AbortController aborts, state clears
 *   - Non-202 enqueue: error set immediately, no polling starts
 *
 * Fake timers drive poll waits so the suite runs in milliseconds.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBenchmarkRunner } from "../use-benchmark-runner";
import type { BenchmarkSnapshot } from "@/lib/benchmark-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_JOB_ID = "job-abc-123";

const FAKE_TELEMETRY: BenchmarkSnapshot = {
  startedAt: "2026-04-24T10:00:00.000Z",
  endedAt: "2026-04-24T10:00:05.000Z",
  totalDurationMs: 5000,
  totalCostUsd: 0.003,
  llmCallCount: 2,
  qdrantQueryCount: 1,
  events: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a mock Response factory for global fetch.
 * Each call to `mockResponses` replaces `globalThis.fetch` with a mock that
 * returns the supplied responses in order, cycling on the last one.
 */
function mockFetchSequence(responses: Response[]): void {
  let index = 0;
  vi.mocked(globalThis.fetch).mockImplementation(() => {
    const res = responses[Math.min(index, responses.length - 1)];
    index++;
    return Promise.resolve(res);
  });
}

function make202(jobId: string): Response {
  return new Response(
    JSON.stringify({ jobId, status: "queued", pollUrl: `/api/benchmark/jobs/${jobId}` }),
    { status: 202 }
  );
}

function makePollActive(jobId: string): Response {
  return new Response(
    JSON.stringify({ jobId, status: "active", progress: 50 }),
    { status: 200 }
  );
}

function makePollCompleted(jobId: string, telemetry: BenchmarkSnapshot): Response {
  return new Response(
    JSON.stringify({ jobId, status: "completed", progress: 100, result: { telemetry } }),
    { status: 200 }
  );
}

function makePollFailed(jobId: string, error: string): Response {
  return new Response(
    JSON.stringify({ jobId, status: "failed", progress: 0, error }),
    { status: 200 }
  );
}

function makeNon202(status: number, message: string): Response {
  return new Response(message, { status });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useBenchmarkRunner", () => {
  it("happy path: 202 enqueue → active → completed → result is telemetry snapshot", async () => {
    mockFetchSequence([
      make202(FAKE_JOB_ID),
      makePollActive(FAKE_JOB_ID),
      makePollCompleted(FAKE_JOB_ID, FAKE_TELEMETRY),
    ]);

    const { result } = renderHook(() => useBenchmarkRunner());

    // Start the run (qa timeout = 60s)
    let runPromise: Promise<void>;
    act(() => {
      runPromise = result.current.run("qa", { question: "test?" });
    });

    // POST fires immediately — enqueue resolves
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(true);

    // First poll fires after 2s (POLL_FAST_MS) — returns active
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });
    expect(result.current.result).toBeNull();

    // Second poll fires after another 2s — returns completed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });

    await act(async () => {
      await runPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toEqual(FAKE_TELEMETRY);
    expect(result.current.elapsedSeconds).toBeGreaterThan(0);
  });

  it("engine returns failed → error set, result stays null", async () => {
    const ENGINE_ERROR = "LLM rate limit exceeded";
    mockFetchSequence([
      make202(FAKE_JOB_ID),
      makePollFailed(FAKE_JOB_ID, ENGINE_ERROR),
    ]);

    const { result } = renderHook(() => useBenchmarkRunner());

    let runPromise: Promise<void>;
    act(() => {
      runPromise = result.current.run("qa", { question: "fail?" });
    });

    await act(async () => {
      await Promise.resolve();
    });

    // First poll fires — returns failed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_001);
    });

    await act(async () => {
      await runPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe(ENGINE_ERROR);
  });

  it("timeout: polling exceeds deadline → error mentions timeout", async () => {
    // qa timeout = 60s; keep returning "active" forever
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(makePollActive(FAKE_JOB_ID))
    );
    // First call must be 202
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(make202(FAKE_JOB_ID));
    // All subsequent: still active
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(makePollActive(FAKE_JOB_ID))
    );

    const { result } = renderHook(() => useBenchmarkRunner());

    let runPromise: Promise<void>;
    act(() => {
      runPromise = result.current.run("qa", { question: "slow?" });
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Advance past the entire 60s qa timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    await act(async () => {
      await runPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toMatch(/timeout/i);
    expect(result.current.error).toMatch(/60s/);
  });

  it("reset() during polling aborts and clears all state", async () => {
    // Slow poll — returns active indefinitely
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(make202(FAKE_JOB_ID));
    vi.mocked(globalThis.fetch).mockImplementation(
      (_url: RequestInfo | URL, opts?: RequestInit) => {
        // The abort signal should fire when reset() is called
        return new Promise<Response>((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        });
      }
    );

    const { result } = renderHook(() => useBenchmarkRunner());

    act(() => {
      void result.current.run("qa", { question: "reset me?" });
    });

    // Let enqueue complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(true);

    // Advance into the first poll sleep (but not enough to resolve)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    // Reset mid-flight
    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it("non-202 enqueue sets error immediately and starts no polling", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeNon202(500, "Internal Server Error")
    );

    const { result } = renderHook(() => useBenchmarkRunner());

    let runPromise: Promise<void>;
    act(() => {
      runPromise = result.current.run("qa", { question: "bad?" });
    });

    await act(async () => {
      await runPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toMatch(/500/);
    // Only the one POST was called — no poll GET
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });
});
