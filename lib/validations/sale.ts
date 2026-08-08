import { z } from "zod/v4";

export const createSaleSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  // Não valide como UUID: o buyer "CNL" é semeado com id fixo ("cnl-buyer",
  // ver prisma/seed.ts) e existe em produção. A rota já confere a existência
  // contra o banco antes de gravar, então o formato aqui não agregava — só
  // rejeitaria uma venda legítima para o CNL.
  buyerId: z.string().min(1, "Buyer ID é obrigatório"),
  quantity: z.number().positive("Quantidade deve ser positiva"),
  unit: z.enum(["divine", "mirror", "exalted", "other"]).default("divine"),
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
