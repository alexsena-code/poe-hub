"use client";

import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import type { AnnualRollup } from "@/lib/annual-plan-calculator";

const chartConfig: ChartConfig = {
  Receita: { label: "Receita", color: "hsl(142, 71%, 45%)" },
  Custo: { label: "Custo", color: "hsl(0, 70%, 55%)" },
  Lucro: { label: "Lucro", color: "hsl(220, 70%, 60%)" },
};

interface LeagueComparisonChartProps {
  rollup: AnnualRollup;
  formatMoney: (v: number, currency: string) => string;
}

export function LeagueComparisonChart({ rollup, formatMoney }: LeagueComparisonChartProps) {
  const fmt = (v: number) => formatMoney(v, "usd");

  const chartData = rollup.leagues.map((l) => ({
    label: l.name,
    Receita: Number(l.revenue.toFixed(2)),
    Custo: Number(l.totalCost.toFixed(2)),
    Lucro: Number(l.profit.toFixed(2)),
  }));

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="font-semibold mb-3">Comparativo por liga</p>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="Receita" fill="hsl(142, 71%, 45%)" />
            <Bar dataKey="Custo" fill="hsl(0, 70%, 55%)" />
            <Bar dataKey="Lucro" fill="hsl(220, 70%, 60%)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
