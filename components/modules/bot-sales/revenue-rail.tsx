"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BotSalesSimulationDay, BotSalesSimulationInput } from "@/lib/bot-sales-simulator";

interface RevenueRailProps {
  input: BotSalesSimulationInput;
  chartDays: BotSalesSimulationDay[];
}

export function RevenueRail({ input, chartDays }: RevenueRailProps) {
  return (
    <Card className="overflow-hidden border-cyan-950/70 bg-gradient-to-b from-cyan-950/20 to-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Trilho da liga
            </p>
            <CardTitle className="mt-1 text-base">Receita, bots ativos e lucro acumulado</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-sm bg-violet-400" /> Receita diária
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-cyan-400" /> Lucro
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-amber-400" /> Bots
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartDays} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId="money" tickLine={false} axisLine={false} fontSize={11} width={62} />
              <YAxis
                yAxisId="bots"
                orientation="right"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={38}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                formatter={(value, name) => [
                  String(name) === "Bots ativos"
                    ? Number(value).toFixed(0)
                    : `$${Number(value).toFixed(2)}`,
                  String(name),
                ]}
                labelFormatter={(day) => `Dia ${day}`}
              />
              <ReferenceLine
                yAxisId="money"
                x={input.salesEndDay}
                stroke="#fbbf24"
                strokeDasharray="4 4"
              />
              <ReferenceLine
                yAxisId="money"
                x={input.hoursChangeDay}
                stroke="#a78bfa"
                strokeDasharray="2 5"
              />
              <Bar
                yAxisId="money"
                dataKey="grossRevenueUsd"
                name="Receita diária"
                fill="#a78bfa"
                fillOpacity={0.32}
                radius={[2, 2, 0, 0]}
              />
              <Area
                yAxisId="money"
                type="monotone"
                dataKey="cumulativeProfitUsd"
                name="Lucro acumulado"
                stroke="#22d3ee"
                fill="url(#profitFill)"
                strokeWidth={2}
              />
              <Line
                yAxisId="bots"
                type="stepAfter"
                dataKey="activeBots"
                name="Bots ativos"
                stroke="#fbbf24"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Barras mostram a receita de cada dia. As linhas tracejadas marcam o fim da aquisição
          (âmbar) e a mudança de jornada (violeta).
        </p>
      </CardContent>
    </Card>
  );
}
