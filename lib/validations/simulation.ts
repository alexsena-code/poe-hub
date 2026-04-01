import { z } from "zod/v4";

// ============================================================
// Simulation
// ============================================================

export const createSimulationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  league: z.string().min(1, "League é obrigatória"),
  durationWeeks: z.number().int().min(1, "Mínimo 1 semana").max(52, "Máximo 52 semanas"),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  notes: z.string().nullable().optional(),
  costConfigIds: z.array(z.string().uuid()).optional(),
});

export const updateSimulationSchema = z.object({
  name: z.string().min(1).optional(),
  league: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  notes: z.string().nullable().optional(),
  costConfigIds: z.array(z.string().uuid()).optional(),
});

// ============================================================
// SimulationWeek
// ============================================================

export const updateWeekSchema = z.object({
  label: z.string().nullable().optional(),
  defaultActiveBots: z.number().int().min(0).optional(),
  defaultDivinePerHour: z.number().min(0).optional(),
  defaultHoursPerDay: z.number().min(0).max(24).optional(),
  defaultDivinePriceUsd: z.number().min(0).nullable().optional(),
  defaultDivinePriceBrl: z.number().min(0).nullable().optional(),
});

// ============================================================
// SimulationDay
// ============================================================

export const updateDaySchema = z.object({
  date: z.string().nullable().optional(),
  activeBots: z.number().int().min(0).nullable().optional(),
  divinePerHour: z.number().min(0).nullable().optional(),
  hoursPerDay: z.number().min(0).max(24).nullable().optional(),
  divinePriceUsd: z.number().min(0).nullable().optional(),
  divinePriceBrl: z.number().min(0).nullable().optional(),
  overrideNotes: z.string().nullable().optional(),
});

// ============================================================
// GlobalCostConfig
// ============================================================

export const createCostConfigSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  isDefault: z.boolean().optional().default(false),
  proxyCostPerBotMonthly: z.number().min(0),
  levelingCostPerBot: z.number().min(0),
  stashPackCostPerBot: z.number().min(0).optional().default(0),
  expluginsKeyCostDaily: z.number().min(0),
  dpbKeyCostDaily: z.number().min(0).optional().default(0),
  notes: z.string().nullable().optional(),
});

export const updateCostConfigSchema = createCostConfigSchema.partial();

// ============================================================
// Type exports
// ============================================================

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type UpdateWeekInput = z.infer<typeof updateWeekSchema>;
export type UpdateDayInput = z.infer<typeof updateDaySchema>;
export type CreateCostConfigInput = z.infer<typeof createCostConfigSchema>;
export type UpdateCostConfigInput = z.infer<typeof updateCostConfigSchema>;
