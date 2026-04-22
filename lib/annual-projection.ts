import type { CustomCostEntry } from "./simulation-calculator";

export interface CostConfigLite {
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
  customCosts?: CustomCostEntry[] | null;
}

export interface AnnualAssumptions {
  bots: number;
  divPerHour: number;
  hoursPerDay: number;
  priceUsd: number;
  growthPct: number; // monthly compound growth on bots, e.g. 0.05 = 5%
  decayPct: number; // monthly compound decay on price, e.g. 0.03 = 3%
  startMonth: number; // 0..11
  startYear: number;
}

export interface MonthRow {
  monthIndex: number;
  label: string;
  days: number;
  bots: number | null;
  divPerHour: number | null;
  hoursPerDay: number | null;
  priceUsd: number | null;
  revenueOverride: number | null;
  operationalCostOverride: number | null;
}

export interface ComputedRow {
  monthIndex: number;
  label: string;
  days: number;
  // Effective values (after resolving overrides / compound math)
  bots: number;
  divPerHour: number;
  hoursPerDay: number;
  priceUsd: number;
  // Flags for UI styling
  botsOverridden: boolean;
  divPerHourOverridden: boolean;
  hoursPerDayOverridden: boolean;
  priceOverridden: boolean;
  revenueOverridden: boolean;
  operationalCostOverridden: boolean;
  // Derived
  divines: number;
  revenue: number;
  operationalCost: number;
  operationalBreakdown: { label: string; amount: number }[];
  oneTimeCost: number;
  oneTimeBreakdown: { label: string; amount: number }[];
  profit: number;
  cumulativeProfit: number;
}

export interface AnnualTotals {
  revenue: number;
  operationalCost: number;
  oneTimeCost: number;
  totalCost: number;
  profit: number;
  roi: number;
}

const MONTH_NAMES_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function defaultRows(
  startMonth: number,
  startYear: number
): MonthRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = (startMonth + i) % 12;
    const y = startYear + Math.floor((startMonth + i) / 12);
    return {
      monthIndex: i,
      label: `${MONTH_NAMES_PT[m]}/${String(y).slice(2)}`,
      days: daysInMonth(y, m),
      bots: null,
      divPerHour: null,
      hoursPerDay: null,
      priceUsd: null,
      revenueOverride: null,
      operationalCostOverride: null,
    };
  });
}

export function computeAnnualRows(
  rows: MonthRow[],
  assumptions: AnnualAssumptions,
  costConfig: CostConfigLite | null
): { rows: ComputedRow[]; totals: AnnualTotals } {
  const computed: ComputedRow[] = [];
  let cumulativeProfit = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const growthFactor = Math.pow(1 + assumptions.growthPct, i);
    const decayFactor = Math.pow(1 - assumptions.decayPct, i);

    const botsCalc = assumptions.bots * growthFactor;
    const priceCalc = assumptions.priceUsd * decayFactor;

    const bots = r.bots ?? botsCalc;
    const divPerHour = r.divPerHour ?? assumptions.divPerHour;
    const hoursPerDay = r.hoursPerDay ?? assumptions.hoursPerDay;
    const priceUsd = r.priceUsd ?? priceCalc;
    const days = r.days;

    const divines = bots * divPerHour * hoursPerDay * days;
    const revenueCalc = divines * priceUsd;
    const revenue = r.revenueOverride ?? revenueCalc;

    // Operational cost breakdown
    const opBreakdown: { label: string; amount: number }[] = [];
    let opCost = 0;
    if (costConfig) {
      const proxy = bots * costConfig.proxyCostPerBotMonthly;
      const explugins = bots * costConfig.expluginsKeyCostDaily * days;
      const dpb = bots * costConfig.dpbKeyCostDaily * days;
      opCost += proxy + explugins + dpb;
      opBreakdown.push({ label: "Proxy (mensal)", amount: proxy });
      opBreakdown.push({ label: "Explugins (diário)", amount: explugins });
      opBreakdown.push({ label: "DPB (diário)", amount: dpb });

      for (const cc of costConfig.customCosts ?? []) {
        if (cc.cadence === "one_time") continue;
        let amt = 0;
        if (cc.cadence === "daily") amt = cc.amount * days * (cc.perBot ? bots : 1);
        else if (cc.cadence === "monthly")
          amt = cc.amount * (cc.perBot ? bots : 1);
        opCost += amt;
        opBreakdown.push({
          label: `${cc.name} (${cc.cadence === "monthly" ? "mensal" : "diário"}${cc.perBot ? ", por bot" : ""})`,
          amount: amt,
        });
      }
    }
    const operationalCost = r.operationalCostOverride ?? opCost;

    // One-time (month 0 only)
    const oneTimeBreakdown: { label: string; amount: number }[] = [];
    let oneTimeCost = 0;
    if (i === 0 && costConfig) {
      const leveling = bots * costConfig.levelingCostPerBot;
      const stash = bots * costConfig.stashPackCostPerBot;
      oneTimeCost += leveling + stash;
      oneTimeBreakdown.push({ label: "Leveling (único)", amount: leveling });
      oneTimeBreakdown.push({ label: "Stash pack (único)", amount: stash });
      for (const cc of costConfig.customCosts ?? []) {
        if (cc.cadence !== "one_time") continue;
        const amt = cc.amount * (cc.perBot ? bots : 1);
        oneTimeCost += amt;
        oneTimeBreakdown.push({
          label: `${cc.name} (único${cc.perBot ? ", por bot" : ""})`,
          amount: amt,
        });
      }
    }

    const profit = revenue - operationalCost - oneTimeCost;
    cumulativeProfit += profit;

    computed.push({
      monthIndex: r.monthIndex,
      label: r.label,
      days,
      bots,
      divPerHour,
      hoursPerDay,
      priceUsd,
      botsOverridden: r.bots != null,
      divPerHourOverridden: r.divPerHour != null,
      hoursPerDayOverridden: r.hoursPerDay != null,
      priceOverridden: r.priceUsd != null,
      revenueOverridden: r.revenueOverride != null,
      operationalCostOverridden: r.operationalCostOverride != null,
      divines,
      revenue,
      operationalCost,
      operationalBreakdown: opBreakdown,
      oneTimeCost,
      oneTimeBreakdown,
      profit,
      cumulativeProfit,
    });
  }

  const revenue = computed.reduce((s, r) => s + r.revenue, 0);
  const operationalCost = computed.reduce((s, r) => s + r.operationalCost, 0);
  const oneTimeCost = computed.reduce((s, r) => s + r.oneTimeCost, 0);
  const totalCost = operationalCost + oneTimeCost;
  const profit = revenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    rows: computed,
    totals: { revenue, operationalCost, oneTimeCost, totalCost, profit, roi },
  };
}

export { MONTH_NAMES_PT };
