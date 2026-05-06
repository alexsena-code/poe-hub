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

/**
 * Walks the simulation day-by-day chronologically and accumulates BRL build
 * cost locked at the divine BRL price on the day each bot first appears.
 *
 *   onDay D: newBots = max(0, resolvedBots(D) - resolvedBots(D-1))
 *           cost += newBots × week.buildCostDivines × resolvedPriceBrl(D)
 *
 * Falls back to USD × exchangeRate when only USD price is available.
 */
export function calcBuildCostBrl(sim: Simulation, exchangeRate: number): number {
  const sortedWeeks = [...sim.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
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

  const baseExplugins = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const customPerBot = customPerBotDaily(sim.customCosts);
  const customGlobal = customGlobalDaily(sim.customCosts);
  const discountStartDay = sim.expluginsDiscountStartDay;
  const discountPercent = sim.expluginsDiscountPercent ?? 50;

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
        const globalDay1 = globalDayIndex + 1;
        const effExplugins =
          discountStartDay != null && globalDay1 >= discountStartDay
            ? baseExplugins * (1 - discountPercent / 100)
            : baseExplugins;
        const cpb = effExplugins + dpbDaily + proxyDaily + customPerBot;
        totalOperationalCost += activeBots * cpb;
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

  // Build cost in BRL, locked at day each bot first comes online.
  // Convert to USD for inclusion in the USD-canonical totalCost aggregate.
  const buildCostBrl = calcBuildCostBrl(sim, exchangeRate);
  const buildCostUsd = exchangeRate > 0 ? buildCostBrl / exchangeRate : 0;
  oneTimeCost += buildCostUsd;

  const totalCost = totalOperationalCost + oneTimeCost;
  const profit = effectiveRevenueUsd - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    revenueUsd: effectiveRevenueUsd,
    operationalCost: totalOperationalCost,
    oneTimeCost,
    buildCostBrl,
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

  const baseExplugins = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const customPerBot = customPerBotDaily(sim.customCosts);
  const customGlobal = customGlobalDaily(sim.customCosts);
  const discountStartDay = sim.expluginsDiscountStartDay;
  const discountPercent = sim.expluginsDiscountPercent ?? 50;

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
          const globalDay1 = globalDayIndex + 1;
          const effExplugins =
            discountStartDay != null && globalDay1 >= discountStartDay
              ? baseExplugins * (1 - discountPercent / 100)
              : baseExplugins;
          const cpb = effExplugins + dpbDaily + proxyDaily + customPerBot;
          weekCost += activeBots * cpb;
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
