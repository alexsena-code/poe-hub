"use client";

import { useState, useRef, useCallback } from "react";
import type { BenchmarkSnapshot } from "@/lib/benchmark-types";

// Endpoint-specific timeouts: content-gen is 60-180s in the engine, so we
// give 200s to avoid aborting a legitimate slow run.
const TIMEOUT_MS: Record<string, number> = {
  qa: 60_000,
  ideation: 60_000,
  "content-generation": 200_000,
};

// Polling intervals mirror the CLI (run-benchmark.ts:366-390):
// 2s for the first 15 attempts (~30s), then 5s for everything after.
const POLL_FAST_MS = 2_000;
const POLL_SLOW_MS = 5_000;
const POLL_FAST_ATTEMPTS = 15;

interface AsyncJobResponse {
  jobId: string;
  status: "queued";
  pollUrl: string;
}

interface JobStatusResponse {
  jobId: string;
  status: "queued" | "active" | "completed" | "failed" | "delayed" | "waiting" | "paused" | "unknown";
  progress: number | object | string | boolean;
  result?: BenchmarkJobResult;
  error?: string;
}

// Engine wraps the pipeline output + telemetry in { result, telemetry }.
// We stuff `result` into snapshot.finalOutput so the UI can render it directly.
interface BenchmarkJobResult {
  result?: unknown;
  telemetry: BenchmarkSnapshot;
}

interface BenchmarkRunnerState {
  loading: boolean;
  error: string | null;
  result: BenchmarkSnapshot | null;
  /** Elapsed seconds since the run started — updated every second. */
  elapsedSeconds: number;
}

interface BenchmarkRunnerActions {
  run: (endpoint: string, body: unknown) => Promise<void>;
  reset: () => void;
}

/**
 * Hook that drives a single benchmark run. Enqueues via POST (202 async),
 * then polls GET /api/engine/benchmark/jobs/:jobId until completed/failed.
 * Manages AbortController for timeout + reset, elapsed-second counter
 * (useful for content-gen loading UX), and typed error reporting.
 *
 * Polling mirrors CLI pattern (run-benchmark.ts:366-390):
 *   - 2s interval for first 15 attempts
 *   - 5s interval afterwards
 *   - Overall deadline: TIMEOUT_MS[endpoint]
 *
 * Usage:
 *   const { loading, error, result, elapsedSeconds, run } = useBenchmarkRunner();
 *   await run("qa", { question: "..." });
 */
export function useBenchmarkRunner(): BenchmarkRunnerState & BenchmarkRunnerActions {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BenchmarkSnapshot | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Keep refs to abort + interval so we can clean up on unmount or new run.
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
    setElapsedSeconds(0);
    clearTimer();
    abortRef.current?.abort();
  }, [clearTimer]);

  const run = useCallback(
    async (endpoint: string, body: unknown) => {
      // Cancel any in-flight run before starting a new one.
      abortRef.current?.abort();
      clearTimer();

      const controller = new AbortController();
      abortRef.current = controller;

      const timeoutMs = TIMEOUT_MS[endpoint] ?? 60_000;
      const deadline = Date.now() + timeoutMs;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      setLoading(true);
      setError(null);
      setResult(null);
      setElapsedSeconds(0);

      // Tick elapsed seconds while loading — gives feedback during long runs.
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setElapsedSeconds(elapsed);
      }, 1000);

      try {
        const jobId = await enqueueJob(endpoint, body, controller.signal);
        await pollUntilDone(jobId, deadline, timeoutMs, controller.signal, setResult, setError);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Only set timeout error if the controller timed out (not a manual reset).
          // We check by seeing if the deadline has passed — if it hasn't, the abort
          // was triggered by reset() and we leave error null so UI clears cleanly.
          if (Date.now() >= deadline - 100) {
            setError(`Timeout após ${timeoutMs / 1000}s — o engine não respondeu a tempo.`);
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      } finally {
        clearTimeout(timeoutId);
        clearTimer();
        setLoading(false);
      }
    },
    [clearTimer]
  );

  return { loading, error, result, elapsedSeconds, run, reset };
}

/**
 * POSTs to enqueue the benchmark job. Expects 202 + jobId.
 * Throws if the response is not 202.
 */
async function enqueueJob(
  endpoint: string,
  body: unknown,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch(`/api/engine/benchmark/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (res.status !== 202) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(
      `Engine retornou ${res.status} para /benchmark/${endpoint}: ${text.slice(0, 300)}`
    );
  }

  const queued = (await res.json()) as AsyncJobResponse;
  return queued.jobId;
}

/**
 * Polls GET /api/engine/benchmark/jobs/:jobId until the job completes or
 * fails, the deadline passes, or the AbortController fires.
 *
 * On completion: extracts body.result.telemetry and calls setResult.
 * On failure: calls setError with the engine's message.
 * On timeout: throws AbortError (the outer catch handles it).
 */
async function pollUntilDone(
  jobId: string,
  deadline: number,
  timeoutMs: number,
  signal: AbortSignal,
  setResult: (s: BenchmarkSnapshot) => void,
  setError: (e: string) => void
): Promise<void> {
  const pollUrl = `/api/engine/benchmark/jobs/${jobId}`;
  let attempt = 0;

  while (Date.now() < deadline) {
    const waitMs = attempt < POLL_FAST_ATTEMPTS ? POLL_FAST_MS : POLL_SLOW_MS;
    await sleep(waitMs, signal);
    attempt++;

    const res = await fetch(pollUrl, { signal });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Poll retornou ${res.status} para job ${jobId}: ${text.slice(0, 200)}`);
    }

    const status = (await res.json()) as JobStatusResponse;
    if (status.status === "completed") {
      const snapshot = status.result?.telemetry;
      if (!snapshot) {
        throw new Error(`Job ${jobId} completou mas result.telemetry está ausente.`);
      }
      setResult({ ...snapshot, finalOutput: status.result?.result });
      return;
    }
    if (status.status === "failed") {
      setError(status.error ?? `Job ${jobId} falhou sem mensagem de erro.`);
      return;
    }
    // Still queued/active — continue polling.
  }

  // Deadline reached without completion — abort so the outer catch handles it.
  throw new DOMException(`Poll timeout após ${timeoutMs}ms`, "AbortError");
}

/** Awaitable sleep that rejects immediately if the signal fires. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
