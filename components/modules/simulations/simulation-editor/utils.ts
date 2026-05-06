// Pure calculation helpers for the simulation editor.
// resolveField mirrors the same logic in week-editor — both must stay in sync
// if the inheritance chain changes.

import type { SimulationDay, SimulationWeek } from "../week-editor";
import type { CostConfig, Simulation } from "./types";

export function fmtUsd(val: number): string {
  return `$${Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtBrl(val: number): string {
  return `R$ ${Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtNum(val: number, decimals = 2): string {
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Returns the resolved (day-level or inherited from week default) numeric value. */
export function resolveField(
  day: SimulationDay,
  field: keyof Pick<
    SimulationDay,
    "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl"
  >,
  week: SimulationWeek
): number | null {
  const dayVal = day[field];
  if (dayVal !== null && dayVal !== undefined) return Number(dayVal);

  const defaultMap: Record<string, keyof SimulationWeek> = {
    activeBots: "defaultActiveBots",
    divinePerHour: "defaultDivinePerHour",
    hoursPerDay: "defaultHoursPerDay",
    divinePriceUsd: "defaultDivinePriceUsd",
    divinePriceBrl: "defaultDivinePriceBrl",
  };

  const weekVal = week[defaultMap[field]];
  return weekVal !== null && weekVal !== undefined ? Number(weekVal) : null;
}

export interface SimulationTotals {
  revenueUsd: number;
  revenueBrl: number;
  operationalCost: number;
  oneTimeCost: number;
  /** Build cost in BRL — canonical (divine prices are BRL-quoted in this op). */
  buildCostBrl: number;
  totalCost: number;
  profit: number;
  roi: number;
}

/**
 * Walks every week/day chronologically and accumulates BRL build cost,
 * locked at the divine BRL price of the day each bot first comes online.
 * Falls back to USD × exchangeRate when only USD price is set on that day.
 */
export function calcBuildCostBrl(
  simulation: Simulation,
  exchangeRate: number
): number {
  const sortedWeeks = [...simulation.weeks].sort(
    (a, b) => a.weekNumber - b.weekNumber
  );
  let prevBots = 0;
  let total = 0;

  for (const week of sortedWeeks) {
    const divines =
      week.buildCostDivines != null ? Number(week.buildCostDivines) : 0;
    const sortedDays = [...week.days].sort((a, b) => a.dayNumber - b.dayNumber);
    for (const day of sortedDays) {
      const bots = resolveField(day, "activeBots", week) ?? 0;
      const newBots = Math.max(0, bots - prevBots);
      prevBots = bots;
      if (newBots === 0 || divines === 0) continue;

      const priceUsd = resolveField(day, "divinePriceUsd", week);
      const priceBrl = resolveField(day, "divinePriceBrl", week);
      let unitBrl = 0;
      if (priceBrl != null && priceBrl > 0) unitBrl = priceBrl;
      else if (priceUsd != null && priceUsd > 0 && exchangeRate > 0)
        unitBrl = priceUsd * exchangeRate;
      if (unitBrl === 0) continue;

      total += newBots * divines * unitBrl;
    }
  }
  return total;
}

/** Returns the effective explugins daily rate for a given 1-based global day. */
export function effectiveExpluginsRate(
  baseRate: number,
  globalDay: number,
  simulation: Simulation
): number {
  const startDay = simulation.expluginsDiscountStartDay;
  if (startDay == null || globalDay < startDay) return baseRate;
  const percent = simulation.expluginsDiscountPercent ?? 50;
  return baseRate * (1 - percent / 100);
}

/** Computes aggregate revenue, cost, profit and ROI from the full simulation. */
export function calcTotals(
  simulation: Simulation,
  costConfig: CostConfig | null,
  exchangeRate: number
): SimulationTotals {
  let totalRevenueUsd = 0;
  let totalRevenueBrl = 0;
  let totalCost = 0;
  const offset = simulation.startDayOffset ?? 0;

  for (const week of simulation.weeks) {
    for (const day of week.days) {
      // Skip locked days (before startDayOffset)
      const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
      if (globalDayIndex < offset) continue;

      const bots = resolveField(day, "activeBots", week);
      const dph = resolveField(day, "divinePerHour", week);
      const hours = resolveField(day, "hoursPerDay", week);
      const priceUsd = resolveField(day, "divinePriceUsd", week);
      const priceBrl = resolveField(day, "divinePriceBrl", week);

      if (bots !== null && dph !== null && hours !== null) {
        const divines = bots * dph * hours;
        if (priceUsd !== null) totalRevenueUsd += divines * priceUsd;
        if (priceBrl !== null) totalRevenueBrl += divines * priceBrl;
      }

      if (costConfig) {
        const globalDay1Based = globalDayIndex + 1;
        const effExplugins = effectiveExpluginsRate(
          Number(costConfig.expluginsKeyCostDaily),
          globalDay1Based,
          simulation
        );
        const proxyPerBotDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
        const costPerBotDaily =
          effExplugins + Number(costConfig.dpbKeyCostDaily) + proxyPerBotDaily;
        totalCost += (bots ?? 0) * costPerBotDaily;
      }
    }
  }

  // If no USD revenue, convert BRL→USD directly (divide by rate)
  const effectiveRevenueUsd =
    totalRevenueUsd > 0 ? totalRevenueUsd : totalRevenueBrl / exchangeRate;

  // One-time costs based on max bots across all weeks
  let oneTimeCost = 0;
  if (costConfig) {
    const maxBots = Math.max(
      ...simulation.weeks.map((w) => Number(w.defaultActiveBots)),
      0
    );
    oneTimeCost =
      maxBots *
      (Number(costConfig.levelingCostPerBot) + Number(costConfig.stashPackCostPerBot));
  }

  const buildCostBrl = calcBuildCostBrl(simulation, exchangeRate);
  const buildCostUsd = exchangeRate > 0 ? buildCostBrl / exchangeRate : 0;

  const totalCostWithOneTime = totalCost + oneTimeCost + buildCostUsd;
  const profit = effectiveRevenueUsd - totalCostWithOneTime;
  const roi = totalCostWithOneTime > 0 ? (profit / totalCostWithOneTime) * 100 : 0;

  return {
    revenueUsd: effectiveRevenueUsd,
    revenueBrl: totalRevenueBrl,
    operationalCost: totalCost,
    oneTimeCost,
    buildCostBrl,
    totalCost: totalCostWithOneTime,
    profit,
    roi,
  };
}

/** Builds per-week chart data rows used by both breakdown cards. */
export function buildWeekData(
  simulation: Simulation,
  costConfig: CostConfig,
  exchangeRate: number
) {
  const offset = simulation.startDayOffset ?? 0;
  const baseExplugins = Number(costConfig.expluginsKeyCostDaily);
  const dpb = Number(costConfig.dpbKeyCostDaily);
  const proxyDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;

  const sortedWeeks = [...simulation.weeks].sort(
    (a, b) => a.weekNumber - b.weekNumber
  );

  let cumProfit = 0;
  return sortedWeeks.map((week) => {
    const activeDays = week.days.filter((d) => {
      const gi = (week.weekNumber - 1) * 7 + (d.dayNumber - 1);
      return gi >= offset;
    });

    let weekCost = 0;
    let weekRevUsd = 0;
    let weekRevBrl = 0;

    for (const day of activeDays) {
      const bots = resolveField(day, "activeBots", week) ?? 0;
      const globalDay = (week.weekNumber - 1) * 7 + day.dayNumber;
      const effExplugins = effectiveExpluginsRate(
        baseExplugins,
        globalDay,
        simulation
      );
      const costPerBotDaily = effExplugins + dpb + proxyDaily;
      weekCost += bots * costPerBotDaily;
      const dph = resolveField(day, "divinePerHour", week);
      const hours = resolveField(day, "hoursPerDay", week);
      const priceUsd = resolveField(day, "divinePriceUsd", week);
      const priceBrl = resolveField(day, "divinePriceBrl", week);
      if (bots && dph && hours) {
        const divines = bots * dph * hours;
        if (priceUsd) weekRevUsd += divines * priceUsd;
        if (priceBrl) weekRevBrl += divines * priceBrl;
      }
    }

    const effectiveRev = weekRevUsd > 0 ? weekRevUsd : weekRevBrl / exchangeRate;
    cumProfit += effectiveRev - weekCost;

    return {
      name: `S${week.weekNumber}`,
      receita: Number(effectiveRev.toFixed(2)),
      custo: Number(weekCost.toFixed(2)),
      lucro: Number((effectiveRev - weekCost).toFixed(2)),
      lucroAcumulado: Number(cumProfit.toFixed(2)),
      weekCost,
      activeDays: activeDays.length,
      bots: week.defaultActiveBots,
    };
  });
}
