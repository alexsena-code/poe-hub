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
  kind: "operational" | "forecast";
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
  /** 1-based global day from which explugins cost is discounted. null = off. */
  expluginsDiscountStartDay: number | null;
  /** Percent off (0-100). Defaults to 50 server-side when startDay is set. */
  expluginsDiscountPercent: number | null;
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

export const KIND_LABELS: Record<string, string> = {
  operational: "Operacional",
  forecast: "Forecast",
};

export const KIND_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  operational: "secondary",
  forecast: "outline",
};
