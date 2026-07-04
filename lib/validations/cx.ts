import { z } from "zod/v4";

// Tipos de comando aceitos na fila cx_job (espelha o cx_executor.py / bridge).
export const CX_JOB_TYPES = [
  "run_job",
  "place_order",
  "cancel",
  "collect",
  "pause",
  "resume",
  "param_update",
  "read_state",
] as const;

export const CX_JOB_STATUSES = [
  "pending",
  "sent",
  "acked",
  "done",
  "failed",
  "expired",
] as const;

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ])
);

export const createCommandSchema = z.object({
  executorId: z.string().min(1),
  type: z.enum(CX_JOB_TYPES),
  payload: z.record(z.string(), jsonValue).default({}),
  priority: z.number().int().min(-100).max(100).optional(),
});

export const commandFiltersSchema = z.object({
  executorId: z.string().optional(),
  status: z.enum(CX_JOB_STATUSES).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v || "1"))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v || "20")))),
});

export const upsertParamSchema = z.object({
  scope: z.enum(["global", "executor", "item"]),
  scopeKey: z.string().min(1).default("*"),
  key: z.string().min(1),
  value: jsonValue,
  // se presente, cria um cx_job param_update pro executor indicado
  pushTo: z.string().min(1).optional(),
});

export const paramFiltersSchema = z.object({
  scope: z.enum(["global", "executor", "item"]).optional(),
  scopeKey: z.string().optional(),
});

export const logFiltersSchema = z.object({
  executorId: z.string().optional(),
  level: z.string().optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v || "1"))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(200, Math.max(1, parseInt(v || "50")))),
});

export const createScheduleSchema = z.object({
  name: z.string().min(1),
  cron: z.string().min(1),
  jobType: z.enum(CX_JOB_TYPES),
  payload: z.record(z.string(), jsonValue).default({}),
  executorId: z.string().min(1).nullable().optional(),
  enabled: z.boolean().default(true),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export type CreateCommandInput = z.infer<typeof createCommandSchema>;
export type UpsertParamInput = z.infer<typeof upsertParamSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
