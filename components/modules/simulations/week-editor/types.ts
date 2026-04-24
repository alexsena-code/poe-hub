// Types shared across week-editor sub-components and consumed by simulation-comparison/
// and simulation-editor. Exported from this file; re-exported from index.tsx so the
// import path "@/components/modules/simulations/week-editor" continues to resolve.

export interface SimulationDay {
  id: string;
  dayNumber: number;
  date: string | null;
  activeBots: number | null;
  divinePerHour: number | null;
  hoursPerDay: number | null;
  divinePriceUsd: number | null;
  divinePriceBrl: number | null;
  overrideNotes: string | null;
}

export interface SimulationWeek {
  id: string;
  weekNumber: number;
  label: string | null;
  defaultActiveBots: number;
  defaultDivinePerHour: number;
  defaultHoursPerDay: number;
  defaultDivinePriceUsd: number | null;
  defaultDivinePriceBrl: number | null;
  buildCostDivines: number | null;
  days: SimulationDay[];
}

export interface CostConfig {
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
}

export interface WeekEditorProps {
  simulationId: string;
  week: SimulationWeek;
  costConfig: CostConfig | null;
  startDayOffset?: number;
  onWeekUpdated: (week: SimulationWeek) => void;
}

/** Fields on SimulationDay that can be overridden per-day vs inherited from week defaults. */
export type InheritableField = keyof Pick<
  SimulationDay,
  "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl"
>;
