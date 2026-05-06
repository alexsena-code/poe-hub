import type { CustomCostEntry } from "./simulation-calculator";

export interface SimulationSnapshot {
  id: string;
  name: string;
  league: string;
  kind: "operational" | "forecast";
  durationWeeks: number;
  startDayOffset: number;
  proxyCostPerBotMonthly: number | { toNumber(): number } | null;
  levelingCostPerBot: number | { toNumber(): number } | null;
  stashPackCostPerBot: number | { toNumber(): number } | null;
  expluginsKeyCostDaily: number | { toNumber(): number } | null;
  dpbKeyCostDaily: number | { toNumber(): number } | null;
  expluginsDiscountStartDay: number | null;
  expluginsDiscountPercent: number | { toNumber(): number } | null;
  customCosts: CustomCostEntry[] | null;
  weeks: {
    weekNumber: number;
    label: string | null;
    defaultActiveBots: number;
    defaultDivinePerHour: number | { toNumber(): number };
    defaultHoursPerDay: number | { toNumber(): number };
    defaultDivinePriceUsd: number | { toNumber(): number } | null;
    defaultDivinePriceBrl: number | { toNumber(): number } | null;
    buildCostDivines: number | { toNumber(): number } | null;
    days: {
      dayNumber: number;
      activeBots: number | null;
      divinePerHour: number | { toNumber(): number } | null;
      hoursPerDay: number | { toNumber(): number } | null;
      divinePriceUsd: number | { toNumber(): number } | null;
      divinePriceBrl: number | { toNumber(): number } | null;
    }[];
  }[];
}

function toNum(v: number | { toNumber(): number } | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface SimulationLeagueTotals {
  id: string;
  name: string;
  league: string;
  kind: "operational" | "forecast";
  durationWeeks: number;
  // Number of times this league runs in the year. Already applied to
  // revenue/operationalCost/oneTimeCost/totalCost/profit below — UI does
  // not need to multiply again. ROI is invariant under N (numerator and
  // denominator scale together).
  repeatCount: number;
  revenue: number;
  operationalCost: number;
  oneTimeCost: number;
  totalCost: number;
  profit: number;
  roi: number;
}

export interface AnnualLeagueInput {
  snapshot: SimulationSnapshot;
  repeatCount: number;
}

/**
 * Calculate totals for a single simulation snapshot.
 * Mirrors the logic from simulation-comparison.tsx (direct sum of days).
 * Uses priceUsd when available, falls back to priceBrl/exchangeRate if provided.
 */
export function calcSimulationLeagueTotals(
  sim: SimulationSnapshot,
  exchangeRate: number
): SimulationLeagueTotals {
  let revenueUsd = 0;
  let revenueBrl = 0;
  let operationalCost = 0;

  const offset = sim.startDayOffset ?? 0;

  const proxyMonthly = toNum(sim.proxyCostPerBotMonthly);
  const expluginsDaily = toNum(sim.expluginsKeyCostDaily);
  const dpbDaily = toNum(sim.dpbKeyCostDaily);
  const hasCost =
    sim.proxyCostPerBotMonthly != null &&
    sim.expluginsKeyCostDaily != null &&
    sim.dpbKeyCostDaily != null;

  let customPerBotDaily = 0;
  let customGlobalDaily = 0;
  for (const cc of sim.customCosts ?? []) {
    if (cc.cadence === "one_time") continue;
    const d = cc.cadence === "monthly" ? cc.amount / 30 : cc.amount;
    if (cc.perBot) customPerBotDaily += d;
    else customGlobalDaily += d;
  }

  const baseExplugins = hasCost ? expluginsDaily : 0;
  const fixedDailyOther =
    (hasCost ? proxyMonthly / 30 + dpbDaily : 0) + customPerBotDaily;
  const discountStartDay = sim.expluginsDiscountStartDay;
  const discountPercent =
    sim.expluginsDiscountPercent != null
      ? toNum(sim.expluginsDiscountPercent)
      : 50;

  for (const w of sim.weeks) {
    for (const d of w.days) {
      const globalIdx = (w.weekNumber - 1) * 7 + (d.dayNumber - 1);
      if (globalIdx < offset) continue;

      const bots = d.activeBots ?? w.defaultActiveBots;
      const dph = toNum(d.divinePerHour ?? w.defaultDivinePerHour);
      const hrs = toNum(d.hoursPerDay ?? w.defaultHoursPerDay);
      const priceUsd = d.divinePriceUsd ?? w.defaultDivinePriceUsd;
      const priceBrl = d.divinePriceBrl ?? w.defaultDivinePriceBrl;

      const divines = bots * dph * hrs;
      if (priceUsd != null) revenueUsd += divines * toNum(priceUsd);
      else if (priceBrl != null) revenueBrl += divines * toNum(priceBrl);

      const globalDay1 = globalIdx + 1;
      const effExplugins =
        discountStartDay != null && globalDay1 >= discountStartDay
          ? baseExplugins * (1 - discountPercent / 100)
          : baseExplugins;
      operationalCost +=
        bots * (effExplugins + fixedDailyOther) + customGlobalDaily;
    }
  }

  const effectiveRevenue =
    revenueUsd > 0 ? revenueUsd : exchangeRate > 0 ? revenueBrl / exchangeRate : 0;

  const maxBots = Math.max(...sim.weeks.map((w) => w.defaultActiveBots), 0);
  let oneTimeCost = 0;
  if (hasCost) {
    oneTimeCost =
      maxBots *
      (toNum(sim.levelingCostPerBot) + toNum(sim.stashPackCostPerBot));
  }
  for (const cc of sim.customCosts ?? []) {
    if (cc.cadence !== "one_time") continue;
    oneTimeCost += cc.perBot ? cc.amount * maxBots : cc.amount;
  }

  // Build cost canonical in BRL (divine prices are BRL-quoted; in-game divine
  // is dollar-pegged so locking BRL on day-of-build mirrors actual spend).
  // Converted to USD for the league-totals aggregate.
  const sortedWeeks = [...sim.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  let prevBotsBuild = 0;
  for (const w of sortedWeeks) {
    const divines = toNum(w.buildCostDivines);
    const sortedDays = [...w.days].sort((a, b) => a.dayNumber - b.dayNumber);
    for (const d of sortedDays) {
      const dayBots = d.activeBots ?? w.defaultActiveBots;
      const newBots = Math.max(0, dayBots - prevBotsBuild);
      prevBotsBuild = dayBots;
      if (newBots === 0 || divines === 0) continue;

      const priceUsd = toNum(d.divinePriceUsd ?? w.defaultDivinePriceUsd);
      const priceBrl = toNum(d.divinePriceBrl ?? w.defaultDivinePriceBrl);
      let unitBrl = 0;
      if (priceBrl > 0) unitBrl = priceBrl;
      else if (priceUsd > 0 && exchangeRate > 0) unitBrl = priceUsd * exchangeRate;
      if (unitBrl === 0) continue;

      const costBrl = newBots * divines * unitBrl;
      oneTimeCost += exchangeRate > 0 ? costBrl / exchangeRate : 0;
    }
  }

  const totalCost = operationalCost + oneTimeCost;
  const profit = effectiveRevenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    id: sim.id,
    name: sim.name,
    league: sim.league,
    kind: sim.kind,
    durationWeeks: sim.durationWeeks,
    repeatCount: 1,
    revenue: effectiveRevenue,
    operationalCost,
    oneTimeCost,
    totalCost,
    profit,
    roi,
  };
}

export function expandAnnualFixedCost(cc: CustomCostEntry): number {
  // Annual plan fixed costs run across the whole year (365 days, 12 months)
  if (cc.cadence === "daily") return cc.amount * 365;
  if (cc.cadence === "monthly") return cc.amount * 12;
  return cc.amount; // one_time
}

export interface AnnualRollup {
  leagues: SimulationLeagueTotals[];
  leagueRevenue: number;
  leagueOperationalCost: number;
  leagueOneTimeCost: number;
  annualFixedCost: number;
  annualFixedBreakdown: { name: string; amount: number }[];
  totalCost: number;
  profit: number;
  roi: number;
}

export function computeAnnualRollup(
  inputs: AnnualLeagueInput[],
  annualCustomCosts: CustomCostEntry[] | null | undefined,
  exchangeRate: number
): AnnualRollup {
  const leagues = inputs.map(({ snapshot, repeatCount }) => {
    const base = calcSimulationLeagueTotals(snapshot, exchangeRate);
    const n = Math.max(1, repeatCount);
    return {
      ...base,
      repeatCount: n,
      revenue: base.revenue * n,
      operationalCost: base.operationalCost * n,
      oneTimeCost: base.oneTimeCost * n,
      totalCost: base.totalCost * n,
      profit: base.profit * n,
      // roi unchanged — ratio is invariant under uniform scaling
    };
  });
  const leagueRevenue = leagues.reduce((s, l) => s + l.revenue, 0);
  const leagueOperationalCost = leagues.reduce((s, l) => s + l.operationalCost, 0);
  const leagueOneTimeCost = leagues.reduce((s, l) => s + l.oneTimeCost, 0);

  const annualFixedBreakdown =
    (annualCustomCosts ?? []).map((cc) => ({
      name: `${cc.name} (${cc.cadence === "daily" ? "diário" : cc.cadence === "monthly" ? "mensal" : "único"})`,
      amount: expandAnnualFixedCost(cc),
    }));
  const annualFixedCost = annualFixedBreakdown.reduce((s, b) => s + b.amount, 0);

  const totalCost = leagueOperationalCost + leagueOneTimeCost + annualFixedCost;
  const profit = leagueRevenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    leagues,
    leagueRevenue,
    leagueOperationalCost,
    leagueOneTimeCost,
    annualFixedCost,
    annualFixedBreakdown,
    totalCost,
    profit,
    roi,
  };
}
