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
  totalCost: number;
  profit: number;
  roi: number;
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
        const proxyPerBotDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
        const costPerBotDaily =
          Number(costConfig.expluginsKeyCostDaily) +
          Number(costConfig.dpbKeyCostDaily) +
          proxyPerBotDaily;
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

  const totalCostWithOneTime = totalCost + oneTimeCost;
  const profit = effectiveRevenueUsd - totalCostWithOneTime;
  const roi = totalCostWithOneTime > 0 ? (profit / totalCostWithOneTime) * 100 : 0;

  return {
    revenueUsd: effectiveRevenueUsd,
    revenueBrl: totalRevenueBrl,
    operationalCost: totalCost,
    oneTimeCost,
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
  const explugins = Number(costConfig.expluginsKeyCostDaily);
  const dpb = Number(costConfig.dpbKeyCostDaily);
  const proxyDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
  const costPerBotDaily = explugins + dpb + proxyDaily;

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
