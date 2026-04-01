import { z } from "zod/v4";

export const linkInstanceBotSchema = z.object({
  botId: z.string().uuid("botId must be a valid UUID").nullable(),
});

export const acknowledgeAlertSchema = z.object({
  acknowledged: z.literal(true),
});

export const alertFiltersSchema = z.object({
  instanceId: z.string().uuid().optional(),
  type: z
    .enum(["error", "loop", "stuck", "inactivity", "hideout", "keyword"])
    .optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  acknowledged: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v || "1"))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v || "20")))),
});

export type LinkInstanceBotInput = z.infer<typeof linkInstanceBotSchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
export type AlertFiltersInput = z.infer<typeof alertFiltersSchema>;
