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
}

/** Cost config data */
export interface CostConfigData {
  proxyCostPerBotMonthly: number | { toNumber(): number };
  levelingCostPerBot: number | { toNumber(): number };
  expluginsKeyCostDaily: number | { toNumber(): number };
  dpbKeyCostDaily: number | { toNumber(): number };
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
 * Cost per day = expluginsKeyCostDaily + dpbKeyCostDaily + (activeBots * proxyCostPerBotMonthly)
 * Week cost = sum of per-day costs across all days in the week.
 * Leveling cost is a one-time charge at simulation level, not included here.
 */
export function calculateWeek(
  week: RawWeek,
  days: RawDay[],
  costConfig?: CostConfigData | null
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
    const expluginsPerBotDaily = toNumRequired(costConfig.expluginsKeyCostDaily);
    const dpbPerBotDaily = toNumRequired(costConfig.dpbKeyCostDaily);
    const proxyPerBotDaily = toNumRequired(costConfig.proxyCostPerBotMonthly) / 30;
    const costPerBotDaily = expluginsPerBotDaily + dpbPerBotDaily + proxyPerBotDaily;

    costUsd = resolvedDays.reduce((sum, rd) => {
      return sum + rd.activeBots * costPerBotDaily;
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
 * Calculates totals for the full simulation across all weeks.
 * Leveling cost is a one-time charge: maxBotsAcrossAllWeeks * levelingCostPerBot.
 */
export function calculateSimulation(
  weeks: { week: RawWeek; days: RawDay[] }[],
  costConfig?: CostConfigData | null
): SimulationCalculation {
  const weekCalcs = weeks.map(({ week, days }) =>
    calculateWeek(week, days, costConfig)
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
          return maxBotsEver * toNumRequired(costConfig.levelingCostPerBot);
        })()
      : 0;

  const totalCostUsd = operationalCostUsd + levelingCostUsd;

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
    totalProfitUsd,
    roi,
    breakEvenWeek,
  };
}
