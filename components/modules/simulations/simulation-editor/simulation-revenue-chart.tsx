"use client";

// Right card of the 2-column breakdown: weekly profit (cumulative or stacked view).
// chartMode toggled between "cumulative" and "stacked" inside this component.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DisplayCurrency } from "@/components/currency-provider";

interface WeekRow {
  name: string;
  bots: number | null;
  activeDays: number;
  receita: number;
  custo: number;
  lucro: number;
  lucroAcumulado: number;
}

interface SimulationRevenueChartProps {
  weekData: WeekRow[];
  formatMoney: (val: number, currency: DisplayCurrency) => string;
}

export function SimulationRevenueChart({
  weekData,
  formatMoney,
}: SimulationRevenueChartProps) {
  const [chartMode, setChartMode] = useState<"cumulative" | "stacked">("cumulative");

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4 text-sm">
        <div>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Receita & Lucro</p>
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button
                variant={chartMode === "cumulative" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setChartMode("cumulative")}
              >
                Lucro Acumulado
              </Button>
              <Button
                variant={chartMode === "stacked" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setChartMode("stacked")}
              >
                Receita / Custo
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {chartMode === "cumulative"
              ? "Lucro da semana e acumulado"
              : "Breakdown semanal"}
          </p>
        </div>

        {/* Spacer to align with left card formula row */}
        <div className="text-xs invisible">spacer</div>

        {chartMode === "cumulative" ? (
          <CumulativeView weekData={weekData} formatMoney={formatMoney} />
        ) : (
          <StackedView weekData={weekData} formatMoney={formatMoney} />
        )}
      </CardContent>
    </Card>
  );
}

function CumulativeView({
  weekData,
  formatMoney,
}: {
  weekData: WeekRow[];
  formatMoney: (val: number, currency: DisplayCurrency) => string;
}) {
  return (
    <div className="grid gap-1">
      {weekData.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"
        >
          <span className="text-muted-foreground">
            {d.name}
            <span className="ml-2 text-xs">
              {d.bots} bots × {d.activeDays}d
            </span>
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              sem:{" "}
              <span
                className={`font-mono ${
                  d.lucro >= 0 ? "text-green-500" : "text-destructive"
                }`}
              >
                {d.lucro >= 0 ? "+" : ""}
                {formatMoney(d.lucro, "usd")}
              </span>
            </span>
            <span
              className={`font-mono tabular-nums w-28 text-right font-medium ${
                d.lucroAcumulado >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {d.lucroAcumulado >= 0 ? "+" : ""}
              {formatMoney(d.lucroAcumulado, "usd")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StackedView({
  weekData,
  formatMoney,
}: {
  weekData: WeekRow[];
  formatMoney: (val: number, currency: DisplayCurrency) => string;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground pb-1 border-b border-border/50">
        <span className="w-24 text-right">Receita</span>
        <span className="w-24 text-right">Custo</span>
        <span className="w-24 text-right">Lucro</span>
      </div>
      {weekData.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"
        >
          <span className="text-muted-foreground">
            {d.name}
            <span className="ml-2 text-xs">
              {d.bots} bots × {d.activeDays}d
            </span>
          </span>
          <div className="flex items-center gap-3 font-mono tabular-nums text-right">
            <span className="text-green-500 w-24">
              {formatMoney(d.receita, "usd")}
            </span>
            <span className="text-destructive w-24">
              {formatMoney(d.custo, "usd")}
            </span>
            <span
              className={`w-24 font-medium ${
                d.lucro >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {d.lucro >= 0 ? "+" : ""}
              {formatMoney(d.lucro, "usd")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
