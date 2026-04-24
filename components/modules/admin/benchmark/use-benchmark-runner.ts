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
 * Hook that drives a single benchmark run. Manages AbortController for
 * timeout, elapsed-second counter (useful for content-gen loading UX), and
 * typed error reporting.
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
        const res = await fetch(`/api/engine/benchmark/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(
            `Engine retornou ${res.status} para /benchmark/${endpoint}: ${text.slice(0, 300)}`
          );
        }

        const snapshot = (await res.json()) as BenchmarkSnapshot;
        setResult(snapshot);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setError(`Timeout após ${timeoutMs / 1000}s — o engine não respondeu a tempo.`);
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
