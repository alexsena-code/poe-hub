"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const hourLabel = (t: string) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", hour: "2-digit" });

// Preço (linha) + volume (barra) por hora
export function PriceVolumeChart({ data }: { data: { t: string; price: number; volume: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: hourLabel(d.t) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" fontSize={10} tickMargin={6} minTickGap={24} />
        <YAxis yAxisId="p" fontSize={10} width={44} />
        <YAxis yAxisId="v" orientation="right" fontSize={10} width={44} />
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Bar yAxisId="v" dataKey="volume" fill="hsl(var(--muted-foreground))" opacity={0.25} />
        <Line yAxisId="p" type="monotone" dataKey="price" stroke="hsl(142 71% 45%)" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Curva de fill-prob por profundidade (P de encher cai com a distância ao touch)
export function FillCurveChart({ data }: { data: { depthPct: number; pFill: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="depthPct" fontSize={10} tickFormatter={(v) => `${v}%`} />
        <YAxis fontSize={10} width={40} domain={[0, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
        <Tooltip
          formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "P(fill)"]}
          labelFormatter={(l) => `profundidade ${l}%`}
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
        />
        <Area type="monotone" dataKey="pFill" stroke="hsl(217 91% 60%)" fill="hsl(217 91% 60%)" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
