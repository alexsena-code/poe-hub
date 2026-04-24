/**
 * Zod validation schema for BenchmarkRun creation.
 *
 * Kept separate from lib/benchmark-schemas.ts (preset schemas — handled by
 * the presets agent). Import only this file for run-related validation.
 *
 * Session 01 S01.benchmark-runs.
 */

import { z } from "zod/v4";

export const benchmarkRunCreateSchema = z.object({
  type: z.enum(["qa", "ideation", "content_generation"]),
  presetId: z.string().uuid().nullable().optional(),
  // {} is a valid value — no model override was used.
  modelOverrides: z.record(z.string(), z.string()),
  // Stored verbatim for reproducibility; shape is per-type (validated by engine).
  requestBody: z.unknown(),
  // Full engine response including result + telemetry snapshot.
  response: z.unknown(),
  httpStatus: z.number().int().min(100).max(599),
  error: z.string().nullable().optional(),
});

export type BenchmarkRunCreate = z.infer<typeof benchmarkRunCreateSchema>;
