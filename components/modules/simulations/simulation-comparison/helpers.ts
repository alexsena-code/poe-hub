// Pure calculation helpers for simulation-comparison.
// No React imports — all functions are side-effect-free.
import type { SimulationDay } from "../week-editor";
import type { CustomCost, Simulation, SimTotals, WeekTotals } from "./types";

/** Returns the effective value for a day field, falling back to the week default. */
export function resolveField(
  day: SimulationDay,
  field: keyof Pick<
    SimulationDay,
    "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl"
  >,
  week: import("../week-editor").SimulationWeek
): number | null {
  const dayVal = day[field];
  if (dayVal !== null && dayVal !== undefined) return Number(dayVal);

  const defaultMap: Record<string, keyof import("../week-editor").SimulationWeek> = {
    activeBots: "defaultActiveBots",
    divinePerHour: "defaultDivinePerHour",
    hoursPerDay: "defaultHoursPerDay",
    divinePriceUsd: "defaultDivinePriceUsd",
    divinePriceBrl: "defaultDivinePriceBrl",
  };

  const weekVal = week[defaultMap[field]];
  return weekVal !== null && weekVal !== undefined ? Number(weekVal) : null;
}

/** Sum of per-bot recurring (non-one-time) custom costs, normalized to daily USD. */
export function customPerBotDaily(customs: CustomCost[] | null | undefined): number {
  let sum = 0;
  for (const cc of customs ?? []) {
    if (!cc.perBot || cc.cadence === "one_time") continue;
    sum += cc.cadence === "monthly" ? cc.amount / 30 : cc.amount;
  }
  return sum;
}

/** Sum of global (non-per-bot, non-one-time) custom costs, normalized to daily USD. */
export function customGlobalDaily(customs: CustomCost[] | null | undefined): number {
  let sum = 0;
  for (const cc of customs ?? []) {
    if (cc.perBot || cc.cadence === "one_time") continue;
    sum += cc.cadence === "monthly" ? cc.amount / 30 : cc.amount;
  }
  return sum;
}

/** Total one-time custom costs, scaling per-bot items by maxBots. */
export function customOneTime(
  customs: CustomCost[] | null | undefined,
  maxBots: number
): number {
  let sum = 0;
  for (const cc of customs ?? []) {
    if (cc.cadence !== "one_time") continue;
    sum += cc.perBot ? cc.amount * maxBots : cc.amount;
  }
  return sum;
}

/** Aggregates all weeks/days of a simulation into a single SimTotals object. */
export function calcSimTotals(sim: Simulation, exchangeRate: number): SimTotals {
  let totalRevenueUsd = 0;
  let totalRevenueBrl = 0;
  let totalOperationalCost = 0;

  const offset = sim.startDayOffset ?? 0;

  const hasCost =
    sim.proxyCostPerBotMonthly != null &&
    sim.expluginsKeyCostDaily != null &&
    sim.dpbKeyCostDaily != null;

  const expluginsDaily = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const customPerBot = customPerBotDaily(sim.customCosts);
  const customGlobal = customGlobalDaily(sim.customCosts);
  const costPerBotDaily = expluginsDaily + dpbDaily + proxyDaily + customPerBot;

  for (const week of sim.weeks) {
    for (const day of week.days) {
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

      const activeBots = resolveField(day, "activeBots", week) ?? 0;
      if (hasCost) {
        totalOperationalCost += activeBots * costPerBotDaily;
      }
      // Global daily customs run every day that's not offset-locked
      totalOperationalCost += customGlobal;
    }
  }

  const effectiveRevenueUsd =
    totalRevenueUsd > 0 ? totalRevenueUsd : totalRevenueBrl / exchangeRate;

  const maxBots = Math.max(
    ...sim.weeks.map((w) => Number(w.defaultActiveBots)),
    0
  );
  let oneTimeCost = 0;
  if (hasCost) {
    oneTimeCost =
      maxBots *
      (Number(sim.levelingCostPerBot ?? 0) +
        Number(sim.stashPackCostPerBot ?? 0));
  }
  oneTimeCost += customOneTime(sim.customCosts, maxBots);

  // Build cost: newBotsW × buildDivinesW × priceW (USD, falls back to BRL÷exch)
  const sortedWeeks = [...sim.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  let prevBotsBuild = 0;
  for (const w of sortedWeeks) {
    const currentBots = Number(w.defaultActiveBots);
    const newBots = Math.max(0, currentBots - prevBotsBuild);
    prevBotsBuild = currentBots;
    const divines = w.buildCostDivines != null ? Number(w.buildCostDivines) : 0;
    if (newBots === 0 || divines === 0) continue;
    const priceUsd = w.defaultDivinePriceUsd != null ? Number(w.defaultDivinePriceUsd) : null;
    const priceBrl = w.defaultDivinePriceBrl != null ? Number(w.defaultDivinePriceBrl) : null;
    let unitUsd = 0;
    if (priceUsd != null) unitUsd = priceUsd;
    else if (priceBrl != null && exchangeRate > 0) unitUsd = priceBrl / exchangeRate;
    oneTimeCost += newBots * divines * unitUsd;
  }

  const totalCost = totalOperationalCost + oneTimeCost;
  const profit = effectiveRevenueUsd - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    revenueUsd: effectiveRevenueUsd,
    operationalCost: totalOperationalCost,
    oneTimeCost,
    totalCost,
    profit,
    roi,
  };
}

/** Breaks a simulation's revenue/cost/profit down into per-week slices. */
export function calcWeekTotals(sim: Simulation, exchangeRate: number): WeekTotals[] {
  const offset = sim.startDayOffset ?? 0;

  const hasCost =
    sim.proxyCostPerBotMonthly != null &&
    sim.expluginsKeyCostDaily != null &&
    sim.dpbKeyCostDaily != null;

  const expluginsDaily = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const customPerBot = customPerBotDaily(sim.customCosts);
  const customGlobal = customGlobalDaily(sim.customCosts);
  const costPerBotDaily = expluginsDaily + dpbDaily + proxyDaily + customPerBot;

  return [...sim.weeks]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => {
      let weekRevUsd = 0;
      let weekRevBrl = 0;
      let weekCost = 0;

      for (const day of week.days) {
        const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
        if (globalDayIndex < offset) continue;

        const bots = resolveField(day, "activeBots", week);
        const dph = resolveField(day, "divinePerHour", week);
        const hours = resolveField(day, "hoursPerDay", week);
        const priceUsd = resolveField(day, "divinePriceUsd", week);
        const priceBrl = resolveField(day, "divinePriceBrl", week);

        if (bots !== null && dph !== null && hours !== null) {
          const divines = bots * dph * hours;
          if (priceUsd !== null) weekRevUsd += divines * priceUsd;
          if (priceBrl !== null) weekRevBrl += divines * priceBrl;
        }

        const activeBots = resolveField(day, "activeBots", week) ?? 0;
        if (hasCost) {
          weekCost += activeBots * costPerBotDaily;
        }
        weekCost += customGlobal;
      }

      const effectiveRev =
        weekRevUsd > 0 ? weekRevUsd : weekRevBrl / exchangeRate;

      return {
        weekNumber: week.weekNumber,
        label: week.label,
        revenue: effectiveRev,
        cost: weekCost,
        profit: effectiveRev - weekCost,
      };
    });
}
