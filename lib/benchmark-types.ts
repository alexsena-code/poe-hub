/**
 * Benchmark response shapes — mirrors engine's benchmark-types.ts
 * (packages/api/src/modules/benchmark/benchmark-types.ts).
 *
 * Kept as a hub-owned copy so we don't couple to engine internals.
 * If the engine contract changes, update here + the adapter in use-benchmark-runner.ts.
 *
 * Session 06 S06.d — benchmark page.
 */

export interface BenchmarkLlmEvent {
  /** Pipeline node label ('write', 'critique', 'qa', etc.). */
  node: string;
  /** Model ID actually used (may differ from YAML config when override is active). */
  model: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Round-trip latency in ms (OpenRouter call only). */
  latencyMs: number;
  /** Wall-clock offset from collector start (ms). */
  tOffsetMs: number;
}

export interface BenchmarkQdrantChunk {
  score: number;
  payload: Record<string, unknown>;
}

export interface BenchmarkQdrantEvent {
  collection: string;
  /** null when searchByVector is called without a text query. */
  queryText: string | null;
  limit: number;
  filters?: Record<string, unknown>;
  resultCount: number;
  chunks: BenchmarkQdrantChunk[];
  durationMs: number;
  tOffsetMs: number;
}

export type BenchmarkCollectorEvent =
  | ({ kind: "llm" } & BenchmarkLlmEvent)
  | ({ kind: "qdrant" } & BenchmarkQdrantEvent);

/**
 * Top-level response for all POST /api/benchmark/* endpoints.
 * The shape is stable and additive per engine session 21 contract.
 */
export interface BenchmarkSnapshot {
  /** ISO timestamp when the collector was created. */
  startedAt: string;
  /** ISO timestamp when toJson() was called. */
  endedAt: string;
  totalDurationMs: number;
  totalCostUsd: number;
  llmCallCount: number;
  qdrantQueryCount: number;
  events: BenchmarkCollectorEvent[];
  /**
   * Pipeline's final output (answer for QA, ideas list for ideation,
   * generated guide for content-generation). Hub-populated: engine returns
   * it alongside telemetry in the job result wrapper, and the runner hook
   * stuffs it here so the panel can render the actual LLM response instead
   * of forcing the operator to expand the last LLM event manually.
   */
  finalOutput?: unknown;
}

// ---------------------------------------------------------------------------
// Request body types per endpoint
// ---------------------------------------------------------------------------

export interface QaBenchmarkRequest {
  question: string;
  queryType?: string;
  language?: "pt" | "en" | "auto";
  modelOverride?: string;
}

export interface IdeationBenchmarkRequest {
  editorialBriefing?: string;
  templateFilter?: string[];
  modelOverride?: string;
}

export interface ContentGenBenchmarkRequest {
  briefing: {
    skill: string;
    ascendancy: string;
    topic?: string;
    league?: string;
    notes?: string;
    templateName?: string;
    /** pobb.in link. When present, engine's enrichment pulls gear/skills from it. */
    pobUrl?: string;
    /** Output language. 'auto' lets engine detect. */
    language?: "pt" | "en" | "auto";
    /** Generation mode. 'auto' runs the full pipeline. */
    mode?: "auto" | "manual";
    /** Insert H2 headings between auto-detected sections. */
    injectSectionHeadings?: boolean;
  };
  modelOverride?: string;
}
