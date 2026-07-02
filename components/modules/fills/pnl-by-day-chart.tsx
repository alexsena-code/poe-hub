"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DayPoint {
  day: string;
  pnlChaos: number;
  trades: number;
}

export function PnlByDayChart({ data }: { data: DayPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sem trades fechados no período para plotar.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" fontSize={11} tickMargin={8} />
        <YAxis fontSize={11} width={48} />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} c`, "PnL"]}
          labelClassName="text-foreground"
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
        />
        <Bar dataKey="pnlChaos" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
