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
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import type { ProfitForecast } from "@/lib/profit-forecast";

interface ProfitProjectionProps {
  forecast: ProfitForecast;
  /** Ligas que formaram a curva; vazio = projeção com preço constante. */
  curveLeagues: string[];
  usedOtherGameVersion: boolean;
}

const chartConfig = {
  profitUsd: { label: "Lucro/dia", color: "hsl(142, 70%, 45%)" },
  costUsd: { label: "Custo/dia", color: "hsl(0, 70%, 55%)" },
  priceUsd: { label: "Preço do Divine", color: "hsl(220, 70%, 60%)" },
} satisfies ChartConfig;

export function ProfitProjection({
  forecast,
  curveLeagues,
  usedOtherGameVersion,
}: ProfitProjectionProps) {
  const data = forecast.days.map((day) => ({
    label: day.dayOffset === 0 ? "hoje" : `+${day.dayOffset}d`,
    dayOfLeague: day.dayOfLeague,
    profitUsd: day.profitUsd,
    costUsd: day.costUsd,
    priceUsd: day.priceUsd,
  }));

  const description =
    curveLeagues.length > 0
      ? `Queda projetada pela curva de ${curveLeagues.length} liga${
          curveLeagues.length === 1 ? "" : "s"
        } passada${curveLeagues.length === 1 ? "" : "s"}: ${curveLeagues.join(", ")}.`
      : "Sem histórico suficiente para projetar a queda — preço mantido constante.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projeção diária</CardTitle>
        <CardDescription>
          {description}
          {usedOtherGameVersion &&
            " Inclui ligas da outra versão do jogo por falta de amostra na mesma."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              yAxisId="usd"
              tickLine={false}
              axisLine={false}
              width={70}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={(v: number) => `$${v.toFixed(3)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    const day = payload?.[0]?.payload?.dayOfLeague;
                    return day ? `${label} — dia ${day} da liga` : String(label);
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Zero explícito: o ponto em que a operação passa a queimar dinheiro. */}
            <ReferenceLine yAxisId="usd" y={0} stroke="hsl(0, 70%, 55%)" strokeDasharray="3 3" />
            <Bar
              yAxisId="usd"
              dataKey="profitUsd"
              fill="var(--color-profitUsd)"
              radius={2}
              isAnimationActive={false}
            />
            <Line
              yAxisId="usd"
              dataKey="costUsd"
              type="monotone"
              stroke="var(--color-costUsd)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              dataKey="priceUsd"
              type="monotone"
              stroke="var(--color-priceUsd)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
