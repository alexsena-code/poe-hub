// Pure helpers for per-bot cohort breakdown.
//
// A "cohort" is the group of bots that came online on the same day. The
// breakdown answers "qual a diferença por bot dependendo de quando entrou",
// attributing each cohort's lifetime divines / revenue / cost / break-even
// independently from other cohorts (each cohort owns only its own bots).

import type { CostConfig, Simulation } from "./types";
import { effectiveExpluginsRate, resolveField } from "./utils";

export interface Cohort {
  /** 1-based global day index when bots came online. */
  startDay: number;
  weekNumber: number;
  dayNumber: number;
  /** Number of new bots added on this day. */
  size: number;

  /** Build cost in BRL, locked at startDay's divine BRL price. */
  buildCostBrl: number;
  /** Same value converted to USD via current exchangeRate (informational). */
  buildCostUsd: number;
  /** Leveling + stash one-time cost in USD for this cohort's bots. */
  levelingCostUsd: number;

  /** Days from startDay through the end of the simulation. */
  daysActive: number;
  divinesProduced: number;

  revenueUsd: number;
  operationalCostUsd: number;
  totalCostUsd: number;
  profitUsd: number;
  roi: number;

  /** Days from startDay until cumulative profit ≥ 0. null if never breaks even. */
  breakEvenDays: number | null;
  /** Global day index where break-even happens. */
  breakEvenGlobalDay: number | null;
}

interface FlatDay {
  globalDay: number;
  weekNumber: number;
  dayNumber: number;
  bots: number;
  dph: number;
  hours: number;
  priceUsd: number | null;
  priceBrl: number | null;
  buildCostDivines: number;
}

function flattenDays(simulation: Simulation): FlatDay[] {
  const flat: FlatDay[] = [];
  for (const week of simulation.weeks) {
    const buildCostDivines =
      week.buildCostDivines != null ? Number(week.buildCostDivines) : 0;
    for (const day of week.days) {
      flat.push({
        globalDay: (week.weekNumber - 1) * 7 + day.dayNumber,
        weekNumber: week.weekNumber,
        dayNumber: day.dayNumber,
        bots: resolveField(day, "activeBots", week) ?? 0,
        dph: resolveField(day, "divinePerHour", week) ?? 0,
        hours: resolveField(day, "hoursPerDay", week) ?? 0,
        priceUsd: resolveField(day, "divinePriceUsd", week),
        priceBrl: resolveField(day, "divinePriceBrl", week),
        buildCostDivines,
      });
    }
  }
  return flat.sort((a, b) => a.globalDay - b.globalDay);
}

/** Resolves a day's USD price, falling back to BRL/exchangeRate. */
function dayPriceUsd(day: FlatDay, exchangeRate: number): number | null {
  if (day.priceUsd != null && day.priceUsd > 0) return day.priceUsd;
  if (day.priceBrl != null && day.priceBrl > 0 && exchangeRate > 0)
    return day.priceBrl / exchangeRate;
  return null;
}

/** Resolves a day's BRL price, falling back to USD × exchangeRate. */
function dayPriceBrl(day: FlatDay, exchangeRate: number): number | null {
  if (day.priceBrl != null && day.priceBrl > 0) return day.priceBrl;
  if (day.priceUsd != null && day.priceUsd > 0 && exchangeRate > 0)
    return day.priceUsd * exchangeRate;
  return null;
}

/** Per-day cost-per-bot in USD, accounting for the explugins discount. */
function costPerBotDailyUsd(
  costConfig: CostConfig | null,
  simulation: Simulation,
  globalDay: number
): number {
  if (!costConfig) return 0;
  const effExplugins = effectiveExpluginsRate(
    Number(costConfig.expluginsKeyCostDaily),
    globalDay,
    simulation
  );
  return (
    effExplugins +
    Number(costConfig.dpbKeyCostDaily) +
    Number(costConfig.proxyCostPerBotMonthly) / 30
  );
}

function levelingPerBotUsd(costConfig: CostConfig | null): number {
  if (!costConfig) return 0;
  return (
    Number(costConfig.levelingCostPerBot) + Number(costConfig.stashPackCostPerBot)
  );
}

/**
 * Walks the simulation chronologically and emits a Cohort object for every
 * day where bot count went up. Days before `startDayOffset` are skipped from
 * both detection and economics (they can't add bots and produce nothing).
 */
export function calcCohorts(
  simulation: Simulation,
  costConfig: CostConfig | null,
  exchangeRate: number
): Cohort[] {
  const offset = simulation.startDayOffset ?? 0;
  const flat = flattenDays(simulation);
  const activeDays = flat.filter((d) => d.globalDay > offset);
  if (activeDays.length === 0) return [];

  const levelingPerBot = levelingPerBotUsd(costConfig);

  const cohorts: Cohort[] = [];
  let prevBots = 0;

  for (let i = 0; i < activeDays.length; i++) {
    const day = activeDays[i];
    const newBots = Math.max(0, day.bots - prevBots);
    prevBots = day.bots;
    if (newBots === 0) continue;

    const priceBrl = dayPriceBrl(day, exchangeRate) ?? 0;
    const buildCostBrl = newBots * day.buildCostDivines * priceBrl;
    const buildCostUsd =
      exchangeRate > 0 ? buildCostBrl / exchangeRate : 0;
    const levelingCostUsd = newBots * levelingPerBot;

    cohorts.push(
      computeCohortLifetime({
        cohortStart: day,
        size: newBots,
        activeDays,
        startIndex: i,
        costConfig,
        simulation,
        buildCostBrl,
        buildCostUsd,
        levelingCostUsd,
        exchangeRate,
      })
    );
  }

  return cohorts;
}

interface LifetimeArgs {
  cohortStart: FlatDay;
  size: number;
  activeDays: FlatDay[];
  startIndex: number;
  costConfig: CostConfig | null;
  simulation: Simulation;
  buildCostBrl: number;
  buildCostUsd: number;
  levelingCostUsd: number;
  exchangeRate: number;
}

function computeCohortLifetime(args: LifetimeArgs): Cohort {
  const { cohortStart, size, activeDays, startIndex, costConfig, simulation } =
    args;
  const oneTimeUsd = args.buildCostUsd + args.levelingCostUsd;

  let divinesProduced = 0;
  let revenueUsd = 0;
  let operationalCostUsd = 0;
  let cumulative = -oneTimeUsd;
  let breakEvenGlobalDay: number | null =
    cumulative >= 0 ? cohortStart.globalDay : null;

  for (let j = startIndex; j < activeDays.length; j++) {
    const d = activeDays[j];
    const dayDivines = size * d.dph * d.hours;
    divinesProduced += dayDivines;

    const priceUsd = dayPriceUsd(d, args.exchangeRate);
    const dayRevUsd = priceUsd != null ? dayDivines * priceUsd : 0;
    revenueUsd += dayRevUsd;

    const cpbDaily = costPerBotDailyUsd(costConfig, simulation, d.globalDay);
    const dayCostUsd = size * cpbDaily;
    operationalCostUsd += dayCostUsd;

    cumulative += dayRevUsd - dayCostUsd;
    if (cumulative >= 0 && breakEvenGlobalDay === null) {
      breakEvenGlobalDay = d.globalDay;
    }
  }

  const totalCostUsd = operationalCostUsd + oneTimeUsd;
  const profitUsd = revenueUsd - totalCostUsd;
  const roi = totalCostUsd > 0 ? (profitUsd / totalCostUsd) * 100 : 0;
  const breakEvenDays =
    breakEvenGlobalDay !== null
      ? breakEvenGlobalDay - cohortStart.globalDay
      : null;

  return {
    startDay: cohortStart.globalDay,
    weekNumber: cohortStart.weekNumber,
    dayNumber: cohortStart.dayNumber,
    size,
    buildCostBrl: args.buildCostBrl,
    buildCostUsd: args.buildCostUsd,
    levelingCostUsd: args.levelingCostUsd,
    daysActive: activeDays.length - startIndex,
    divinesProduced,
    revenueUsd,
    operationalCostUsd,
    totalCostUsd,
    profitUsd,
    roi,
    breakEvenDays,
    breakEvenGlobalDay,
  };
}
