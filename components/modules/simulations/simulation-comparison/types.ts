// Types shared across simulation-comparison sub-components.
// SimulationWeek + SimulationDay come from week-editor to avoid duplication.
import type { SimulationWeek } from "../week-editor";

export type { SimulationWeek };

export interface CustomCost {
  id: string;
  name: string;
  amount: number;
  cadence: "daily" | "monthly" | "one_time";
  perBot: boolean;
}

export interface CostConfigOption {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
  customCosts: CustomCost[] | null;
}

export interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  startDayOffset: number;
  costConfigName: string | null;
  costLinks?: { costConfigId: string; costConfig: { id: string; name: string } }[];
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  expluginsDiscountStartDay: number | null;
  expluginsDiscountPercent: number | null;
  customCosts: CustomCost[] | null;
  weeks: SimulationWeek[];
}

export interface SimTotals {
  revenueUsd: number;
  operationalCost: number;
  oneTimeCost: number;
  /** Build cost in BRL — canonical, locked at day-of-build divine BRL price. */
  buildCostBrl: number;
  totalCost: number;
  profit: number;
  roi: number;
}

export interface WeekTotals {
  weekNumber: number;
  label: string | null;
  revenue: number;
  cost: number;
  profit: number;
}
