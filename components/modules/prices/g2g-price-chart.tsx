"use client";

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
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { G2gSnapshot } from "@/hooks/use-g2g-snapshots";

interface G2gPriceChartProps {
  snapshots: G2gSnapshot[];
  loading: boolean;
  error: string | null;
  rangeDays: number;
  onRangeChange: (days: number) => void;
}

const RANGE_OPTIONS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const chartConfig = {
  median: { label: "Mediana", color: "hsl(220, 70%, 60%)" },
  band: { label: "Faixa p25–p75", color: "hsl(220, 70%, 60%)" },
} satisfies ChartConfig;

/** Em janelas curtas a hora importa; em longas ela vira ruído no eixo. */
function formatTick(iso: string, rangeDays: number): string {
  const date = new Date(iso);
  if (rangeDays <= 1) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function G2gPriceChart({
  snapshots,
  loading,
  error,
  rangeDays,
  onRangeChange,
}: G2gPriceChartProps) {
  // A banda vira um par [min, max]; recharts desenha Area de range a partir disso.
  const data = snapshots.map((s) => ({
    collectedAt: s.collectedAt,
    median: s.median,
    band: [s.p25, s.p75] as [number, number],
    offerCount: s.offerCount,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Preço na G2G</CardTitle>
          <CardDescription>
            Mediana das ofertas da concorrência, com a faixa entre o primeiro e o
            terceiro quartil.
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.days}
              variant={rangeDays === option.days ? "default" : "outline"}
              size="sm"
              onClick={() => onRangeChange(option.days)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        )}

        {!loading && error && (
          <div className="flex h-64 items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>Nenhuma coleta nessa janela.</span>
            <span className="text-xs">
              A G2G não expõe histórico — a série começa na primeira coleta.
            </span>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <ComposedChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="collectedAt"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => formatTick(value, rangeDays)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={64}
                domain={["auto", "auto"]}
                tickFormatter={(value: number) => `$${value.toFixed(3)}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const iso = payload?.[0]?.payload?.collectedAt;
                      return iso ? new Date(iso).toLocaleString("pt-BR") : "";
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="band"
                stroke="none"
                fill="var(--color-band)"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Line
                dataKey="median"
                type="monotone"
                stroke="var(--color-median)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
