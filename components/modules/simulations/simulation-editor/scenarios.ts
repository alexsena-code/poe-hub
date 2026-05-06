// Pure helpers for the what-if scenario tester. Forks the simulation tree
// in-memory along two orthogonal axes (bot progression + price overlay) and
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

export interface PriceOverlayParams {
  /** League name to pull DailyPrice from. null = no overlay (use sim prices as-is). */
  league: string | null;
  source: "median" | "cnl";
  /** 1-based day of the chosen league that maps to sim day 1. */
  startDay: number;
}

/** Daily-price row from /api/prices/daily — narrow shape used by the overlay. */
export interface DailyPriceRow {
  /** "yyyy-mm-dd" date string. */
  date: string;
  median: number;
  cnlPrice: number | null;
}

export interface PriceLeagueData {
  /** "yyyy-mm-dd" of the league's official start date. */
  leagueStartDate: string;
  rows: DailyPriceRow[];
}

export interface Scenario extends BotProgressionParams {
  id: string;
  label: string;
  price: PriceOverlayParams;
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

/**
 * Overlays historical daily prices onto the simulation. Each sim day is
 * mapped to a real date = leagueStartDate + (priceStartDay-1) + globalDayIdx,
 * then divinePriceBrl/Usd are set from the priceMap. Days without a match
 * AND week defaults are cleared, so calcTotals computes revenue exclusively
 * from overlay-matched days.
 *
 * USD per day is derived as BRL/exchangeRate using the *current* rate (we
 * don't have historical FX). This is fine because calcTotals also uses the
 * BRL→USD path with the same rate when USD is missing.
 */
export function applyPriceOverlay(
  simulation: Simulation,
  data: PriceLeagueData,
  overlay: PriceOverlayParams,
  exchangeRate: number
): Simulation {
  if (overlay.league === null) return simulation;

  const priceMap = new Map<string, number>();
  for (const row of data.rows) {
    const price =
      overlay.source === "cnl" && row.cnlPrice != null && row.cnlPrice > 0
        ? row.cnlPrice
        : row.median;
    if (price > 0) priceMap.set(row.date, price);
  }

  const day1 = new Date(data.leagueStartDate);
  day1.setUTCDate(day1.getUTCDate() + (overlay.startDay - 1));

  const newWeeks: SimulationWeek[] = simulation.weeks.map((week) => ({
    ...week,
    defaultDivinePriceBrl: null,
    defaultDivinePriceUsd: null,
    days: week.days.map((day) => {
      const globalIdx = (week.weekNumber - 1) * 7 + (day.dayNumber - 1); // 0-based
      const realDate = new Date(day1);
      realDate.setUTCDate(realDate.getUTCDate() + globalIdx);
      const dateKey = realDate.toISOString().split("T")[0];
      const matched = priceMap.get(dateKey);

      if (matched != null) {
        return {
          ...day,
          divinePriceBrl: matched,
          divinePriceUsd: exchangeRate > 0 ? matched / exchangeRate : null,
        };
      }
      return { ...day, divinePriceBrl: null, divinePriceUsd: null };
    }),
  }));

  return { ...simulation, weeks: newWeeks };
}

export function calcScenario(
  simulation: Simulation,
  costConfig: CostConfig | null,
  exchangeRate: number,
  scenario: Scenario,
  priceData: PriceLeagueData | null
): ScenarioResult {
  // Order matters: price overlay first (resets per-day prices), then bot
  // progression (only touches activeBots, leaving prices alone).
  let forked = simulation;
  if (scenario.price.league !== null && priceData) {
    forked = applyPriceOverlay(forked, priceData, scenario.price, exchangeRate);
  }
  forked = applyProgression(forked, scenario);

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
