"use client";

// Five KPI cards at the top: Receita, Custo Operacional, Custo Unico, Lucro Liquido, ROI.

import { Card, CardContent } from "@/components/ui/card";
import type { DisplayCurrency } from "@/components/currency-provider";
import { fmtNum, type SimulationTotals } from "./utils";

interface SimulationSummaryCardsProps {
  totals: SimulationTotals;
  formatMoney: (val: number, currency: DisplayCurrency) => string;
}

export function SimulationSummaryCards({
  totals,
  formatMoney,
}: SimulationSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Receita</p>
          <p className="text-xl font-bold font-mono">
            {formatMoney(totals.revenueUsd, "usd")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Custo Operacional</p>
          <p className="text-xl font-bold font-mono">
            {formatMoney(totals.operationalCost, "usd")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Custo Unico (Lv+Stash)</p>
          <p className="text-xl font-bold font-mono">
            {formatMoney(totals.oneTimeCost, "usd")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Lucro Liquido</p>
          <p
            className={`text-xl font-bold font-mono ${
              totals.profit >= 0 ? "text-green-500" : "text-destructive"
            }`}
          >
            {formatMoney(totals.profit, "usd")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">ROI</p>
          <p
            className={`text-xl font-bold font-mono ${
              totals.roi >= 0 ? "text-green-500" : "text-destructive"
            }`}
          >
            {fmtNum(totals.roi, 1)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
