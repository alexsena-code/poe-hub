import {
  decomposeDailyCost,
  dailyCostFor,
  type CostConfigData,
  type CustomCostEntry,
} from "./daily-cost";

// A decomposição do custo diário mora em `daily-cost.ts` porque a calculadora
// rápida de profit usa a mesma conta. Os tipos seguem re-exportados daqui:
// vários módulos já os importavam deste caminho.
export type { CostConfigData, CustomCostEntry };

// ============================================================
// Types
// ============================================================

type NumericValue = number | { toNumber(): number } | null;

/** Raw day data from DB (nullable override fields) */
export interface RawDay {
  dayNumber: number;
  date?: Date | string | null;
  activeBots: number | null;
  divinePerHour: NumericValue;
  hoursPerDay: NumericValue;
  divinePriceUsd: NumericValue;
  divinePriceBrl: NumericValue;
  overrideNotes?: string | null;
}

/** Raw week data from DB */
export interface RawWeek {
  weekNumber: number;
  label?: string | null;
  defaultActiveBots: number;
  defaultDivinePerHour: number | { toNumber(): number };
  defaultHoursPerDay: number | { toNumber(): number };
  defaultDivinePriceUsd: number | { toNumber(): number } | null;
  defaultDivinePriceBrl: number | { toNumber(): number } | null;
  buildCostDivines?: number | { toNumber(): number } | null;
}

/** Simulation-level options that can shift per-day costs (e.g. explugins discount). */
export interface SimulationCostOptions {
  /** 1-based global day from which the discount applies. null disables. */
  expluginsDiscountStartDay?: number | null;
  /** Percent off (0-100). Defaults to 50 when startDay is set but this isn't. */
  expluginsDiscountPercent?: number | null;
}

/** Returns the effective explugins daily rate for a given 1-based global day. */
export function effectiveExpluginsRate(
  baseRate: number,
  globalDay: number,
  opts?: SimulationCostOptions | null
): number {
  if (!opts || opts.expluginsDiscountStartDay == null) return baseRate;
  if (globalDay < opts.expluginsDiscountStartDay) return baseRate;
  const percent = opts.expluginsDiscountPercent ?? 50;
  return baseRate * (1 - percent / 100);
}

/** Day with all values resolved (no nulls for core fields) */
export interface ResolvedDay {
  dayNumber: number;
  activeBots: number;
  divinePerHour: number;
  hoursPerDay: number;
  divinePriceUsd: number | null;
  divinePriceBrl: number | null;
}

/** Calculated results for a single day */
export interface DayCalculation {
  divinesProduced: number;
  revenueUsd: number | null;
  revenueBrl: number | null;
}

/** Calculated results for a week */
export interface WeekCalculation {
  totalDivines: number;
  revenueUsd: number | null;
  revenueBrl: number | null;
  costUsd: number;
  profitUsd: number | null;
  maxActiveBots: number;
  days: DayCalculation[];
}

/** Calculated results for the full simulation */
export interface SimulationCalculation {
  totalDivines: number;
  totalRevenueUsd: number | null;
  totalRevenueBrl: number | null;
  totalCostUsd: number;
  /** Build cost in BRL — canonical because divine prices are typically BRL-quoted. */
  buildCostBrl: number;
  totalProfitUsd: number | null;
  roi: number | null;
  breakEvenWeek: number | null;
}

// ============================================================
// Helpers
// ============================================================

function toNum(val: number | { toNumber(): number } | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return typeof val === "number" ? val : Number(val);
}

function toNumRequired(val: number | { toNumber(): number }): number {
  return typeof val === "number" ? val : Number(val);
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Resolves a day's effective values by inheriting from the week defaults
 * when the day has null (no override) for a field.
 */
export function resolveDay(day: RawDay, week: RawWeek): ResolvedDay {
  return {
    dayNumber: day.dayNumber,
    activeBots: day.activeBots ?? week.defaultActiveBots,
    divinePerHour: toNum(day.divinePerHour) ?? toNumRequired(week.defaultDivinePerHour),
    hoursPerDay: toNum(day.hoursPerDay) ?? toNumRequired(week.defaultHoursPerDay),
    divinePriceUsd: toNum(day.divinePriceUsd) ?? toNum(week.defaultDivinePriceUsd),
    divinePriceBrl: toNum(day.divinePriceBrl) ?? toNum(week.defaultDivinePriceBrl),
  };
}

/**
 * Calculates production and revenue for a single resolved day.
 */
export function calculateDay(resolved: ResolvedDay): DayCalculation {
  const divinesProduced = resolved.activeBots * resolved.divinePerHour * resolved.hoursPerDay;

  return {
    divinesProduced,
    revenueUsd:
      resolved.divinePriceUsd !== null ? divinesProduced * resolved.divinePriceUsd : null,
    revenueBrl:
      resolved.divinePriceBrl !== null ? divinesProduced * resolved.divinePriceBrl : null,
  };
}

/**
 * Calculates totals for a week including costs.
 * Cost per day = effectiveExpluginsRate(day) + dpbKeyCostDaily + proxyDaily +
 *                customPerBotDaily, all multiplied by activeBots.
 * Plus customGlobalDaily added once per day.
 * Leveling cost is a one-time charge at simulation level, not included here.
 *
 * `simOpts` carries per-day adjustments — currently the explugins discount,
 * which scales the explugins component from a configured global day onwards.
 */
export function calculateWeek(
  week: RawWeek,
  days: RawDay[],
  costConfig?: CostConfigData | null,
  simOpts?: SimulationCostOptions | null
): WeekCalculation {
  const resolvedDays = days.map((d) => resolveDay(d, week));
  const dayCalcs = resolvedDays.map((rd) => calculateDay(rd));

  const totalDivines = dayCalcs.reduce((sum, dc) => sum + dc.divinesProduced, 0);

  const hasAnyUsd = dayCalcs.some((dc) => dc.revenueUsd !== null);
  const hasAnyBrl = dayCalcs.some((dc) => dc.revenueBrl !== null);

  const revenueUsd = hasAnyUsd
    ? dayCalcs.reduce((sum, dc) => sum + (dc.revenueUsd ?? 0), 0)
    : null;
  const revenueBrl = hasAnyBrl
    ? dayCalcs.reduce((sum, dc) => sum + (dc.revenueBrl ?? 0), 0)
    : null;

  const maxActiveBots = resolvedDays.reduce(
    (max, rd) => Math.max(max, rd.activeBots),
    0
  );

  let costUsd = 0;
  if (costConfig) {
    const parts = decomposeDailyCost(costConfig);

    costUsd = resolvedDays.reduce((sum, rd) => {
      const globalDay = (week.weekNumber - 1) * 7 + rd.dayNumber;
      const effExplugins = effectiveExpluginsRate(
        parts.expluginsPerBotDaily,
        globalDay,
        simOpts
      );
      return sum + dailyCostFor(parts, rd.activeBots, effExplugins);
    }, 0);
  }

  const profitUsd = revenueUsd !== null ? revenueUsd - costUsd : null;

  return {
    totalDivines,
    revenueUsd,
    revenueBrl,
    costUsd,
    profitUsd,
    maxActiveBots,
    days: dayCalcs,
  };
}

/**
 * Computes the build cost (in BRL), locked in at the moment each bot first
 * comes online: cost = newBotsOnDay × week.buildCostDivines × dayPriceBrl.
 *
 * BRL is canonical — divine prices in this operation are quoted in BRL and
 * the divine is dollar-pegged in-game, so locking BRL on the day of build
 * mirrors the operator's actual spend. Falls back to USD × exchangeRate
 * when only the USD price is set on that day. Once paid, the per-bot R$
 * cost is fixed — subsequent FX swings don't retroactively change it.
 *
 * A "new bot" is detected when resolved active-bots on day D > day D-1.
 */
export function calculateBuildCostBrl(
  weeks: { week: RawWeek; days: RawDay[] }[],
  exchangeRate?: number
): number {
  const sorted = [...weeks].sort((a, b) => a.week.weekNumber - b.week.weekNumber);
  let total = 0;
  let prevBots = 0;

  for (const { week, days } of sorted) {
    const divines = toNum(week.buildCostDivines) ?? 0;
    const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    for (const day of sortedDays) {
      const resolved = resolveDay(day, week);
      const newBots = Math.max(0, resolved.activeBots - prevBots);
      prevBots = resolved.activeBots;

      if (newBots === 0 || divines === 0) continue;

      let unitBrl = 0;
      if (resolved.divinePriceBrl != null) unitBrl = resolved.divinePriceBrl;
      else if (
        resolved.divinePriceUsd != null &&
        exchangeRate &&
        exchangeRate > 0
      )
        unitBrl = resolved.divinePriceUsd * exchangeRate;

      if (unitBrl === 0) continue;
      total += newBots * divines * unitBrl;
    }
  }
  return total;
}

/**
 * Calculates totals for the full simulation across all weeks.
 * Leveling cost is a one-time charge: maxBotsAcrossAllWeeks * levelingCostPerBot.
 */
export function calculateSimulation(
  weeks: { week: RawWeek; days: RawDay[] }[],
  costConfig?: CostConfigData | null,
  exchangeRate?: number,
  simOpts?: SimulationCostOptions | null
): SimulationCalculation {
  const weekCalcs = weeks.map(({ week, days }) =>
    calculateWeek(week, days, costConfig, simOpts)
  );

  const totalDivines = weekCalcs.reduce((sum, wc) => sum + wc.totalDivines, 0);

  const hasAnyUsd = weekCalcs.some((wc) => wc.revenueUsd !== null);
  const hasAnyBrl = weekCalcs.some((wc) => wc.revenueBrl !== null);

  const totalRevenueUsd = hasAnyUsd
    ? weekCalcs.reduce((sum, wc) => sum + (wc.revenueUsd ?? 0), 0)
    : null;
  const totalRevenueBrl = hasAnyBrl
    ? weekCalcs.reduce((sum, wc) => sum + (wc.revenueBrl ?? 0), 0)
    : null;

  const operationalCostUsd = weekCalcs.reduce((sum, wc) => sum + wc.costUsd, 0);

  const levelingCostUsd =
    costConfig && weekCalcs.length > 0
      ? (() => {
          const maxBotsEver = weekCalcs.reduce(
            (max, wc) => Math.max(max, wc.maxActiveBots),
            0
          );
          const leveling = toNumRequired(costConfig.levelingCostPerBot);
          const stash =
            costConfig.stashPackCostPerBot !== undefined
              ? toNumRequired(costConfig.stashPackCostPerBot)
              : 0;
          let customOneTimePerBot = 0;
          let customOneTimeGlobal = 0;
          for (const cc of costConfig.customCosts ?? []) {
            if (cc.cadence !== "one_time") continue;
            if (cc.perBot) customOneTimePerBot += cc.amount;
            else customOneTimeGlobal += cc.amount;
          }
          return (
            maxBotsEver * (leveling + stash + customOneTimePerBot) + customOneTimeGlobal
          );
        })()
      : 0;

  const buildCostBrl = calculateBuildCostBrl(weeks, exchangeRate);
  const buildCostUsd =
    exchangeRate && exchangeRate > 0 ? buildCostBrl / exchangeRate : 0;

  const totalCostUsd = operationalCostUsd + levelingCostUsd + buildCostUsd;

  const totalProfitUsd =
    totalRevenueUsd !== null ? totalRevenueUsd - totalCostUsd : null;

  const roi =
    totalRevenueUsd !== null && totalCostUsd > 0
      ? ((totalRevenueUsd - totalCostUsd) / totalCostUsd) * 100
      : null;

  // Break-even: first week where cumulative profit >= 0
  let breakEvenWeek: number | null = null;
  if (hasAnyUsd) {
    let cumulativeProfit = 0;
    for (let i = 0; i < weekCalcs.length; i++) {
      const wc = weekCalcs[i];
      cumulativeProfit += (wc.revenueUsd ?? 0) - wc.costUsd;
      if (cumulativeProfit >= 0) {
        breakEvenWeek = weeks[i].week.weekNumber;
        break;
      }
    }
  }

  return {
    totalDivines,
    totalRevenueUsd,
    totalRevenueBrl,
    totalCostUsd,
    buildCostBrl,
    totalProfitUsd,
    roi,
    breakEvenWeek,
  };
}
