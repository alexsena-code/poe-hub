/**
 * Shared type definitions for the benchmark history list and detail views.
 *
 * The list row type mirrors the GET /api/benchmark/runs select (no requestBody/response).
 * The detail row type mirrors the GET /api/benchmark/runs/[id] include (full row).
 *
 * Session 01 S01.benchmark-history.
 */

export type BenchmarkType = "qa" | "ideation" | "content_generation";

/** Preset preview shape embedded in list rows and detail rows. */
export interface BenchmarkRunPreset {
  id: string;
  name: string;
}

/**
 * List-row shape from GET /api/benchmark/runs.
 * Excludes requestBody and response (too large for list rendering).
 */
export interface BenchmarkRunListRow {
  id: string;
  type: BenchmarkType;
  presetId: string | null;
  preset: BenchmarkRunPreset | null;
  /** Per-node model overrides, e.g. { write: "moonshotai/kimi-k2" }. Empty obj when none. */
  modelOverrides: Record<string, string>;
  totalCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
  qdrantQueryCount: number;
  httpStatus: number;
  error: string | null;
  createdAt: string;
}

/** Evaluation reference embedded in detail rows (not the full verdict). */
export interface BenchmarkEvalRef {
  id: string;
  runBId?: string;
  runAId?: string;
  judgeModel: string;
}

/**
 * Full detail row from GET /api/benchmark/runs/[id].
 * Includes requestBody, response, and evaluation references.
 */
export interface BenchmarkRunDetail extends BenchmarkRunListRow {
  requestBody: unknown;
  response: unknown;
  evaluationsAsA: BenchmarkEvalRef[];
  evaluationsAsB: BenchmarkEvalRef[];
}

/** API list response envelope. */
export interface BenchmarkRunsListResponse {
  runs: BenchmarkRunListRow[];
  total: number;
}
