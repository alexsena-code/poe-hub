import { z } from "zod/v4";

// Log de fills do Currency Exchange (flips in-game chaos<->item<->divine).
// Só league+item são obrigatórios; o resto vai sendo preenchido ao longo do
// ciclo (clica "vou fazer" -> perna compra; plugin/você fecha -> perna venda).
export const createFillSchema = z.object({
  league: z.string().min(1, "League é obrigatória"),
  item: z.string().min(1, "Item é obrigatório"),
  base: z.string().default("Chaos Orb"),
  mode: z.enum(["manual", "semi", "full"]).default("manual"),
  source: z.enum(["ui", "plugin", "auto"]).default("ui"),
  status: z.enum(["open", "holding", "closed", "cancelled"]).optional(),

  // perna COMPRA
  buyRatio: z.number().positive().nullable().optional(),
  buyQty: z.number().positive().nullable().optional(),
  buyPostedAt: z.string().nullable().optional(),
  buyFilledAt: z.string().nullable().optional(),
  buyQAhead: z.number().nonnegative().nullable().optional(),

  // perna VENDA
  sellRatio: z.number().positive().nullable().optional(),
  sellQty: z.number().positive().nullable().optional(),
  sellPostedAt: z.string().nullable().optional(),
  sellFilledAt: z.string().nullable().optional(),
  sellQAhead: z.number().nonnegative().nullable().optional(),

  fairAtEntry: z.number().positive().nullable().optional(),
  pnlChaos: z.number().nullable().optional(),
  pnlDiv: z.number().nullable().optional(),
  botInstanceId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateFillSchema = createFillSchema.partial();

export type CreateFillInput = z.infer<typeof createFillSchema>;
export type UpdateFillInput = z.infer<typeof updateFillSchema>;
