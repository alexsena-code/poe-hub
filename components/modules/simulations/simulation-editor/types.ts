// Types shared across simulation-editor sub-components.
// CostConfig mirrors the DB costConfig shape used in simulation snapshots.

import type { SimulationWeek } from "../week-editor";

export interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
}

export interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  startDayOffset: number;
  notes: string | null;
  // Cost snapshot (copied from costConfig at link time)
  costConfigName: string | null;
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  createdAt: string;
  updatedAt: string;
  weeks: SimulationWeek[];
  costLinks: Array<{ costConfigId: string; costConfig: CostConfig }>;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada",
};

export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
};
