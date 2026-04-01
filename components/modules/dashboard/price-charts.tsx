"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    label: "Mediana",
    color: "hsl(220, 70%, 60%)",
  },
  cnlPrice: {
    label: "CNL",
    color: "hsl(45, 90%, 55%)",
  },
} satisfies ChartConfig;

const RANGE_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
];

function LeagueChart({ league, days }: { league: string; days: string }) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      item: "divine",
      league,
      days,
    });
    fetch(`/api/prices/daily?${params}`)
      .then((res) => res.json())
      .then((result) => {
        const items = Array.isArray(result) ? result : result.data ?? [];
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [league, days]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{league}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{league}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados de preco
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    median: Number(d.median),
    cnlPrice: d.cnlPrice != null ? Number(d.cnlPrice) : null,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{league}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={11}
              tickFormatter={(v: number) => `R$${v.toFixed(2)}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="median"
              stroke="var(--color-median)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cnlPrice"
              stroke="var(--color-cnlPrice)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface PriceChartsProps {
  currentLeagues: { name: string; poeVersion: string }[];
}

export function PriceCharts({ currentLeagues }: PriceChartsProps) {
  const [days, setDays] = useState("7");

  const poe1League = currentLeagues.find((l) => l.poeVersion === "poe1");
  const poe2League = currentLeagues.find((l) => l.poeVersion === "poe2");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Divine - Historico de Preco</h2>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {poe1League && <LeagueChart league={poe1League.name} days={days} />}
        {poe2League && <LeagueChart league={poe2League.name} days={days} />}
        {!poe1League && !poe2League && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma liga ativa encontrada
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
