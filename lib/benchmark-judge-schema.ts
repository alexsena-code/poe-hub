/**
 * Zod schema for the LLM-as-judge verdict returned by the benchmark evaluation endpoint.
 *
 * The judge is asked to return strict JSON matching this shape. If parsing fails,
 * the route retries once; on second failure it persists an error record so the row
 * still exists for audit (winner=null, verdict.error set).
 *
 * Session 13 — benchmark judge endpoint (see docs/progress/session-13.md).
 */

import { z } from "zod";

const winnerEnum = z.enum(["A", "B", "tie"]);

const dimensionSchema = z.object({
  winner: winnerEnum,
  rationale: z.string().min(1, "rationale must be non-empty"),
});

export const judgeVerdictSchema = z.object({
  winner: winnerEnum,
  dimensions: z.object({
    factualAccuracy: dimensionSchema,
    proseQuality: dimensionSchema,
    structure: dimensionSchema,
    poeDomainKnowledge: dimensionSchema,
    antiHallucination: dimensionSchema,
  }),
  overallRationale: z.string().min(1, "overallRationale must be non-empty"),
  confidence: z.enum(["low", "medium", "high"]),
});

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

/** Shape stored when the judge returns invalid JSON on both attempts. */
export interface JudgeErrorVerdict {
  error: string;
  raw: string;
}
