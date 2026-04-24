// Zod schemas for cost-config create/edit form.
// Co-located per CLAUDE.md: "Schema co-located with the form component."

import { z } from "zod/v4";

export const customCostFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome obrigatório"),
  amount: z.number().min(0, "Valor mínimo 0"),
  cadence: z.enum(["daily", "monthly", "one_time"]),
  perBot: z.boolean(),
});

export const costConfigSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  isDefault: z.boolean().optional(),
  proxyCostPerBotMonthly: z.number().min(0, "Valor minimo 0"),
  levelingCostPerBot: z.number().min(0, "Valor minimo 0"),
  stashPackCostPerBot: z.number().min(0, "Valor minimo 0"),
  expluginsKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  dpbKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  customCosts: z.array(customCostFormSchema).optional(),
  notes: z.string().optional(),
});

export type CostConfigForm = z.infer<typeof costConfigSchema>;

export const COST_CONFIG_DEFAULTS: CostConfigForm = {
  name: "",
  isDefault: false,
  proxyCostPerBotMonthly: 0,
  levelingCostPerBot: 0,
  stashPackCostPerBot: 0,
  expluginsKeyCostDaily: 0,
  dpbKeyCostDaily: 0,
  customCosts: [],
  notes: "",
};
