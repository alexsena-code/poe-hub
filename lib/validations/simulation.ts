import { z } from "zod/v4";

// ============================================================
// Custom costs (extensible, user-defined)
// ============================================================

export const customCostSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nome do custo é obrigatório"),
  amount: z.number().min(0, "Valor mínimo 0"),
  cadence: z.enum(["daily", "monthly", "one_time"]),
  perBot: z.boolean(),
});

export type CustomCost = z.infer<typeof customCostSchema>;

// ============================================================
// Simulation
// ============================================================

export const simulationKindSchema = z.enum(["operational", "forecast"]);

export const createSimulationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  league: z.string().min(1, "League é obrigatória"),
  durationWeeks: z.number().int().min(1, "Mínimo 1 semana").max(52, "Máximo 52 semanas"),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  kind: simulationKindSchema.optional().default("operational"),
  notes: z.string().nullable().optional(),
  costConfigIds: z.array(z.string().uuid()).optional(),
});

export const updateSimulationSchema = z.object({
  name: z.string().min(1).optional(),
  league: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  kind: simulationKindSchema.optional(),
  notes: z.string().nullable().optional(),
  costConfigIds: z.array(z.string().uuid()).optional(),
  // Cost overrides (editable directly on the simulation snapshot)
  proxyCostPerBotMonthly: z.number().min(0).nullable().optional(),
  levelingCostPerBot: z.number().min(0).nullable().optional(),
  stashPackCostPerBot: z.number().min(0).nullable().optional(),
  expluginsKeyCostDaily: z.number().min(0).nullable().optional(),
  dpbKeyCostDaily: z.number().min(0).nullable().optional(),
  customCosts: z.array(customCostSchema).nullable().optional(),
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
  buildCostDivines: z.number().min(0).nullable().optional(),
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
  customCosts: z.array(customCostSchema).optional().default([]),
  notes: z.string().nullable().optional(),
});

export const updateCostConfigSchema = createCostConfigSchema.partial();

// ============================================================
// AnnualPlan
// ============================================================

export const createAnnualPlanSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  year: z.number().int().min(2000).max(2100),
  annualCustomCosts: z.array(customCostSchema).optional(),
  notes: z.string().nullable().optional(),
  simulationIds: z.array(z.string().uuid()).optional(),
});

export const updateAnnualPlanSchema = z.object({
  name: z.string().min(1).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  annualCustomCosts: z.array(customCostSchema).nullable().optional(),
  notes: z.string().nullable().optional(),
  simulationIds: z.array(z.string().uuid()).optional(),
});

export type CreateAnnualPlanInput = z.infer<typeof createAnnualPlanSchema>;
export type UpdateAnnualPlanInput = z.infer<typeof updateAnnualPlanSchema>;

// ============================================================
// Type exports
// ============================================================

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type UpdateWeekInput = z.infer<typeof updateWeekSchema>;
export type UpdateDayInput = z.infer<typeof updateDaySchema>;
export type CreateCostConfigInput = z.infer<typeof createCostConfigSchema>;
export type UpdateCostConfigInput = z.infer<typeof updateCostConfigSchema>;
