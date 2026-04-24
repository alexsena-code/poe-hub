"use client";

// Cumulative-profit-per-day AreaChart shown when the user expands the chart
// toggle inside the financial summary card.

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { customPerBotDaily, customGlobalDaily, customOneTime, resolveField } from "./helpers";
import type { Simulation, SimTotals } from "./types";

// Four distinguishable colors for up to 4 simulations
const SCENARIO_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(220, 70%, 60%)",
  "hsl(45, 90%, 55%)",
  "hsl(340, 70%, 55%)",
];

interface ScenarioChartProps {
  simulations: Simulation[];
  simNames: string[];
  totals: SimTotals[];
  exchangeRate: number;
  formatMoney: (v: number, currency: "usd" | "brl") => string;
}

/** Builds the cumulative-profit chart data points. One entry per global day. */
function buildChartData(
  simulations: Simulation[],
  simNames: string[],
  exchangeRate: number
): Record<string, number | string>[] {
  const totalDays = Math.max(...simulations.map((s) => s.durationWeeks * 7));
  const chartData: Record<string, number | string>[] = [];

  for (let d = 0; d < totalDays; d++) {
    const point: Record<string, number | string> = { name: `D${d + 1}` };

    simulations.forEach((sim, si) => {
      const offset = sim.startDayOffset ?? 0;
      const hasCost =
        sim.proxyCostPerBotMonthly != null &&
        sim.expluginsKeyCostDaily != null &&
        sim.dpbKeyCostDaily != null;
      const customPerBot = customPerBotDaily(sim.customCosts);
      const customGlobal = customGlobalDaily(sim.customCosts);
      const costPerBotDailyVal = hasCost
        ? Number(sim.expluginsKeyCostDaily) +
          Number(sim.dpbKeyCostDaily) +
          Number(sim.proxyCostPerBotMonthly) / 30 +
          customPerBot
        : customPerBot;

      // Start with one-time costs as negative (investment)
      const maxBots = Math.max(...sim.weeks.map((w) => Number(w.defaultActiveBots)), 0);
      const oneTime =
        (hasCost
          ? maxBots * (Number(sim.levelingCostPerBot ?? 0) + Number(sim.stashPackCostPerBot ?? 0))
          : 0) + customOneTime(sim.customCosts, maxBots);
      let cumProfit = -oneTime;

      for (let di = 0; di <= d; di++) {
        if (di < offset) continue;
        const wn = Math.floor(di / 7);
        const dn = di % 7;
        const week = sim.weeks.find((w) => w.weekNumber === wn + 1);
        if (!week) continue;
        const day = week.days.find((dd) => dd.dayNumber === dn + 1);
        if (!day) continue;

        const bots = resolveField(day, "activeBots", week) ?? 0;
        const dph = resolveField(day, "divinePerHour", week);
        const hours = resolveField(day, "hoursPerDay", week);
        const priceUsd = resolveField(day, "divinePriceUsd", week);
        const priceBrl = resolveField(day, "divinePriceBrl", week);

        let dayRev = 0;
        if (bots && dph && hours) {
          const divines = bots * Number(dph) * Number(hours);
          if (priceUsd) dayRev = divines * Number(priceUsd);
          else if (priceBrl) dayRev = (divines * Number(priceBrl)) / exchangeRate;
        }
        const dayCost = (hasCost ? bots * costPerBotDailyVal : bots * customPerBot) + customGlobal;
        cumProfit += dayRev - dayCost;
      }

      point[simNames[si]] = Number(cumProfit.toFixed(2));
    });

    chartData.push(point);
  }
  return chartData;
}

export function ScenarioChart({
  simulations,
  simNames,
  totals,
  exchangeRate,
  formatMoney,
}: ScenarioChartProps) {
  const colors = SCENARIO_COLORS;
  const fmt = (v: number) => formatMoney(v, "usd");
  const totalDays = Math.max(...simulations.map((s) => s.durationWeeks * 7));
  const chartData = buildChartData(simulations, simNames, exchangeRate);

  const chartConfig: ChartConfig = {};
  simulations.forEach((_sim, i) => {
    chartConfig[simNames[i]] = { label: simNames[i], color: colors[i] };
  });

  // Compute KPIs per sim
  const kpis = simulations.map((sim, si) => {
    const tots = totals[si];
    const activeDays = totalDays - (sim.startDayOffset ?? 0);
    const profitPerDay = activeDays > 0 ? tots.profit / activeDays : 0;

    // Find break-even day (first day cumProfit crosses zero)
    let breakEvenDay: number | null = null;
    for (let d = 0; d < chartData.length; d++) {
      const val = chartData[d][simNames[si]] as number;
      if (val > 0 && breakEvenDay === null) {
        breakEvenDay = d + 1;
        break;
      }
    }

    return { profitPerDay, breakEvenDay, totalProfit: tots.profit };
  });

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <p className="text-xs text-muted-foreground mb-2">Lucro Acumulado por Dia</p>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {simulations.map((_sim, i) => (
                <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i]} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} tickCount={8} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            {simulations.map((_sim, i) => (
              <Area
                key={i}
                type="linear"
                dataKey={simNames[i]}
                stroke={colors[i]}
                strokeWidth={2}
                fill={`url(#grad-${i})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="space-y-3 text-sm">
        {simulations.map((sim, si) => (
          <div key={sim.id} className="space-y-2">
            <p className="font-medium" style={{ color: colors[si] }}>{simNames[si]}</p>
            <div className="grid gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro/dia</span>
                <span className="font-mono tabular-nums">{fmt(kpis[si].profitPerDay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Break-even</span>
                <span className="font-mono tabular-nums">
                  {kpis[si].breakEvenDay ? `Dia ${kpis[si].breakEvenDay}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span
                  className={cn(
                    "font-mono tabular-nums font-medium",
                    kpis[si].totalProfit >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {fmt(kpis[si].totalProfit)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
