/**
 * Zod schemas for BenchmarkPreset payloads.
 *
 * Mirrors the request-body interfaces in lib/benchmark-types.ts.
 * Both the CRUD routes (app/api/benchmark/presets/) and future run-trigger
 * routes import payload validation from here, not from benchmark-types.ts
 * (which only holds TypeScript interfaces, not runtime validators).
 *
 * Session 13 S13.a — benchmark presets CRUD.
 */
import { z } from "zod/v4";

// ─── Per-type payload schemas ─────────────────────────────────────────────────

export const qaPayloadSchema = z.object({
  question: z.string().min(1, "question is required"),
  queryType: z.string().optional(),
  language: z.enum(["pt", "en", "auto"]).optional(),
  modelOverride: z.string().optional(),
  modelOverrides: z.record(z.string(), z.string()).optional(),
});

export const ideationPayloadSchema = z.object({
  editorialBriefing: z.string().optional(),
  templateFilter: z.array(z.string()).optional(),
  modelOverride: z.string().optional(),
  modelOverrides: z.record(z.string(), z.string()).optional(),
});

export const contentGenPayloadSchema = z.object({
  briefing: z.object({
    skill: z.string().min(1, "briefing.skill is required"),
    ascendancy: z.string().min(1, "briefing.ascendancy is required"),
    topic: z.string().optional(),
    league: z.string().optional(),
    notes: z.string().optional(),
    templateName: z.string().optional(),
  }),
  modelOverride: z.string().optional(),
  modelOverrides: z.record(z.string(), z.string()).optional(),
});

// ─── Discriminated union for preset input ─────────────────────────────────────

/**
 * Input schema for creating/updating a BenchmarkPreset.
 *
 * The payload is validated against the schema that matches the declared type,
 * enforcing that e.g. a "qa" preset always has a `question` field.
 *
 * Usage:
 *   const parsed = benchmarkPresetInputSchema.safeParse(body);
 */
export const benchmarkPresetInputSchema = z.discriminatedUnion("type", [
  z.object({
    name: z.string().min(1, "name is required"),
    type: z.literal("qa"),
    payload: qaPayloadSchema,
    notes: z.string().optional(),
  }),
  z.object({
    name: z.string().min(1, "name is required"),
    type: z.literal("ideation"),
    payload: ideationPayloadSchema,
    notes: z.string().optional(),
  }),
  z.object({
    name: z.string().min(1, "name is required"),
    type: z.literal("content_generation"),
    payload: contentGenPayloadSchema,
    notes: z.string().optional(),
  }),
]);

export type BenchmarkPresetInput = z.infer<typeof benchmarkPresetInputSchema>;

// ─── Partial update schema (PATCH) ───────────────────────────────────────────

/**
 * Schema for PATCH /api/benchmark/presets/[id].
 *
 * `type` is intentionally omitted — changing a preset's type would break the
 * semantic invariant that payload shape matches type. Reject at the route
 * level with a 400 if the caller includes `type`.
 */
export const benchmarkPresetPatchSchema = z.object({
  name: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

export type BenchmarkPresetPatch = z.infer<typeof benchmarkPresetPatchSchema>;
