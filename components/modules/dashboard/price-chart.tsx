"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface PricePoint {
  date: string;
  median: number;
  cnlPrice: number | null;
  league: string;
}

const chartConfig = {
  median: {
    label: "Mediana Mercado",
    color: "hsl(220, 70%, 60%)",
  },
  cnlPrice: {
    label: "CNL",
    color: "hsl(45, 90%, 55%)",
  },
} satisfies ChartConfig;

export function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Divine - Historico de Preco</CardTitle>
          <CardDescription>Ultimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem dados de preco disponiveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by date, pick the league with highest volume (most data points)
  const leagueCounts: Record<string, number> = {};
  for (const d of data) {
    leagueCounts[d.league] = (leagueCounts[d.league] ?? 0) + 1;
  }
  const primaryLeague = Object.entries(leagueCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const filtered = primaryLeague ? data.filter((d) => d.league === primaryLeague) : data;

  const chartData = filtered.map((d) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    median: d.median,
    cnlPrice: d.cnlPrice,
    fullDate: new Date(d.date).toLocaleDateString("pt-BR"),
    league: d.league,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Divine - Historico de Preco</CardTitle>
        <CardDescription>
          Ultimos 7 dias &mdash; {primaryLeague ?? "Todas as ligas"} (R$)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: number) =>
                `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const label =
                      name === "median" ? "Mediana" : "CNL";
                    return (
                      <span>
                        {label}: R$
                        {Number(value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 4,
                        })}
                      </span>
                    );
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="linear"
              dataKey="median"
              stroke="var(--color-median)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="linear"
              dataKey="cnlPrice"
              stroke="var(--color-cnlPrice)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
