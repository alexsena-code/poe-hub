// Types for the cost-configs module.
// Kept separate so schema.ts and use-costs-state.ts can import without circulars.

export interface CustomCost {
  id: string;
  name: string;
  amount: number;
  cadence: "daily" | "monthly" | "one_time";
  perBot: boolean;
}

export interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
  customCosts: CustomCost[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Cost field names that hold monetary values — used for per-field currency toggle.
export const COST_FIELDS = [
  "proxyCostPerBotMonthly",
  "levelingCostPerBot",
  "stashPackCostPerBot",
  "expluginsKeyCostDaily",
  "dpbKeyCostDaily",
] as const;

export type CostFieldName = (typeof COST_FIELDS)[number];

export type FieldCurrencies = Record<CostFieldName, "usd" | "brl">;

export const DEFAULT_FIELD_CURRENCIES: FieldCurrencies = {
  proxyCostPerBotMonthly: "usd",
  levelingCostPerBot: "usd",
  stashPackCostPerBot: "usd",
  expluginsKeyCostDaily: "usd",
  dpbKeyCostDaily: "usd",
};
