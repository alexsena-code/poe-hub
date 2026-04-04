"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DailyPricePoint {
  date: string;
  item: string;
  league: string;
  median: number;
  cnlPrice: number | null;
}

interface PriceChartProps {
  item: "divine" | "chaos" | "mirror";
  league?: string;
  channelId?: string;
}

const ITEM_LABELS: Record<string, string> = {
  divine: "Divine Orb",
  chaos: "Chaos Orb",
  mirror: "Mirror of Kalandra",
};

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

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

// CNL channel uses 4 decimal places (poe2 prices are smaller)
const POE2_CHANNEL = "1376913719245799515";

export function PriceChart({ item, league, channelId }: PriceChartProps) {
  const [data, setData] = useState<DailyPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [useLogScale, setUseLogScale] = useState(true);

  const decimals = channelId === POE2_CHANNEL ? 4 : 2;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("item", item);
        params.set("days", String(rangeDays));
        if (league) params.set("league", league);

        const res = await fetch(`/api/prices/daily?${params}`);
        if (!res.ok) throw new Error("Falha ao carregar historico de precos");
        const json: DailyPricePoint[] = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [item, league, rangeDays]);

  const chartData = data.map((d) => ({
    date: new Date(d.date + "T12:00:00Z").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    fullDate: new Date(d.date + "T12:00:00Z").toLocaleDateString("pt-BR"),
    median: d.median,
    cnlPrice: d.cnlPrice,
  }));

  // Determine whether CNL data exists at all in this range
  const hasCnl = data.some((d) => d.cnlPrice !== null);

  // Detect if log scale would help (max/min ratio > 5x)
  const allPrices = data.flatMap((d) => [d.median, d.cnlPrice].filter((v): v is number => v !== null && v > 0));
  const priceMax = Math.max(...allPrices, 1);
  const priceMin = Math.min(...allPrices, 1);
  const shouldSuggestLog = priceMax / priceMin > 5;

  // Custom ticks: 0.10 steps up to 1.00, then 1.00 steps up to max
  const customTicks = (() => {
    const ticks: number[] = [];
    for (let v = 0.1; v < 1; v = Math.round((v + 0.1) * 100) / 100) {
      ticks.push(v);
    }
    for (let v = 1; v <= Math.ceil(priceMax); v++) {
      ticks.push(v);
    }
    return ticks.filter((t) => t >= priceMin * 0.5 && t <= priceMax * 1.1);
  })();

  const itemLabel = ITEM_LABELS[item] ?? item;
  const leagueLabel = league ? ` — ${league}` : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle>{itemLabel} — Evolucao de Preco</CardTitle>
          <CardDescription>
            Mediana de mercado e preco CNL (R$){leagueLabel}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {shouldSuggestLog && (
            <Button
              variant={useLogScale ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setUseLogScale(!useLogScale)}
              title="Escala logaritmica — melhora visualizacao quando ha grande variacao de preco"
            >
              Log
            </Button>
          )}
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              variant={rangeDays === opt.days ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRangeDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Nenhum dado encontrado para o periodo selecionado.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={chartData} accessibilityLayer>
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                scale={useLogScale && shouldSuggestLog ? "log" : "auto"}
                domain={useLogScale && shouldSuggestLog ? [Math.max(priceMin * 0.8, 0.001), "auto"] : undefined}
                allowDataOverflow={useLogScale && shouldSuggestLog}
                ticks={useLogScale && shouldSuggestLog ? customTicks : undefined}
                tickCount={useLogScale ? undefined : 8}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                width={72}
                tickFormatter={(v: number) =>
                  `R$${v.toLocaleString("pt-BR", {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  })}`
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="fullDate"
                    formatter={(value, name) => {
                      const label = name === "median" ? "Mediana" : "CNL";
                      return (
                        <span>
                          {label}: R$
                          {Number(value).toLocaleString("pt-BR", {
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals,
                          })}
                        </span>
                      );
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="median"
                stroke="var(--color-median)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {hasCnl && (
                <Line
                  type="monotone"
                  dataKey="cnlPrice"
                  stroke="var(--color-cnlPrice)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
