import { z } from "zod/v4";

export const createSaleSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  buyerId: z.string().uuid("Buyer ID inválido"),
  quantity: z.number().positive("Quantidade deve ser positiva"),
  unit: z.enum(["divine", "chaos", "exalted", "other"]).default("divine"),
  divinePriceUsd: z.number().positive().nullable().optional(),
  divinePriceBrl: z.number().positive().nullable().optional(),
  totalUsd: z.number().positive().nullable().optional(),
  totalBrl: z.number().positive().nullable().optional(),
  league: z.string().min(1, "League é obrigatória"),
  notes: z.string().nullable().optional(),
});

export const updateSaleSchema = createSaleSchema.partial();

export const createBuyerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  isCnl: z.boolean().default(false),
  contact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateBuyerSchema = createBuyerSchema.partial();

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;
