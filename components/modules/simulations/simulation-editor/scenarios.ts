// Pure helpers for the what-if scenario tester. Forks the simulation tree
// in-memory by overriding activeBots according to a progression formula and
// runs the existing calcTotals — never persists anything to the DB.

import type { SimulationWeek } from "../week-editor";
import type { CostConfig, Simulation } from "./types";
import { calcTotals, type SimulationTotals } from "./utils";

export interface BotProgressionParams {
  maxBots: number;
  incrementPerDay: number;
  startBots: number;
  /** 1-based global day index where ramping starts. */
  startDay: number;
}

export interface Scenario extends BotProgressionParams {
  id: string;
  label: string;
}

export interface ScenarioResult {
  scenario: Scenario;
  totals: SimulationTotals;
  /** Highest activeBots reached anywhere in the forked sim. */
  peakBots: number;
  /** Day at which the ramp first hits maxBots. null if it never does. */
  dayReachingMax: number | null;
}

/**
 * Returns a new Simulation tree where every day's activeBots override is set
 * according to bot progression. Days before startDay are left untouched.
 */
export function applyProgression(
  simulation: Simulation,
  params: BotProgressionParams
): Simulation {
  const newWeeks: SimulationWeek[] = simulation.weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      const globalDay = (week.weekNumber - 1) * 7 + day.dayNumber;
      if (globalDay < params.startDay) return day;
      const i = globalDay - params.startDay;
      const bots = Math.min(
        params.startBots + i * params.incrementPerDay,
        params.maxBots
      );
      return { ...day, activeBots: bots };
    }),
  }));
  return { ...simulation, weeks: newWeeks };
}

export function calcScenario(
  simulation: Simulation,
  costConfig: CostConfig | null,
  exchangeRate: number,
  scenario: Scenario
): ScenarioResult {
  const forked = applyProgression(simulation, scenario);
  const totals = calcTotals(forked, costConfig, exchangeRate);

  const totalDays = simulation.durationWeeks * 7;
  const daysToMax = Math.ceil(
    Math.max(0, scenario.maxBots - scenario.startBots) / scenario.incrementPerDay
  );
  const dayReachingMax =
    scenario.startDay + daysToMax <= totalDays
      ? scenario.startDay + daysToMax
      : null;

  return { scenario, totals, peakBots: scenario.maxBots, dayReachingMax };
}

/** Diff between two SimulationTotals objects on the metrics worth comparing. */
export interface ScenarioDelta {
  revenueUsd: number;
  totalCost: number;
  profit: number;
  roi: number;
}

export function calcDelta(
  baseline: SimulationTotals,
  variant: SimulationTotals
): ScenarioDelta {
  return {
    revenueUsd: variant.revenueUsd - baseline.revenueUsd,
    totalCost: variant.totalCost - baseline.totalCost,
    profit: variant.profit - baseline.profit,
    roi: variant.roi - baseline.roi,
  };
}

export function makeScenarioId(): string {
  return `scn-${Math.random().toString(36).slice(2, 9)}`;
}
