"use client";

// Left card of the 2-column breakdown: itemised cost per week + one-time costs.

import { Card, CardContent } from "@/components/ui/card";
import type { DisplayCurrency } from "@/components/currency-provider";
import type { CostConfig, Simulation } from "./types";
import type { SimulationTotals } from "./utils";

interface WeekRow {
  name: string;
  bots: number | null;
  activeDays: number;
  weekCost: number;
}

interface SimulationCostBreakdownProps {
  costConfig: CostConfig;
  simulation: Simulation;
  totals: SimulationTotals;
  weekData: WeekRow[];
  formatMoney: (val: number, currency: DisplayCurrency) => string;
}

export function SimulationCostBreakdown({
  costConfig,
  simulation,
  totals,
  weekData,
  formatMoney,
}: SimulationCostBreakdownProps) {
  const explugins = Number(costConfig.expluginsKeyCostDaily);
  const dpb = Number(costConfig.dpbKeyCostDaily);
  const proxyDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
  const costPerBotDaily = explugins + dpb + proxyDaily;
  const maxBots = Math.max(
    ...simulation.weeks.map((w) => Number(w.defaultActiveBots)),
    0
  );
  const hasOneTimeCosts =
    Number(costConfig.levelingCostPerBot) > 0 ||
    Number(costConfig.stashPackCostPerBot) > 0;

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4 text-sm">
        <div>
          <p className="font-semibold">Detalhamento de Custos</p>
          <p className="text-xs text-muted-foreground">{costConfig.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
          <span>
            ExPlugins{" "}
            <span className="font-mono text-foreground">
              {formatMoney(explugins, "usd")}
            </span>
          </span>
          <span>
            + DPB{" "}
            <span className="font-mono text-foreground">
              {formatMoney(dpb, "usd")}
            </span>
          </span>
          <span>
            + Proxy{" "}
            <span className="font-mono text-foreground">
              {formatMoney(proxyDaily, "usd")}
            </span>
            <span className="ml-1">
              ({formatMoney(Number(costConfig.proxyCostPerBotMonthly), "usd")}/mes)
            </span>
          </span>
          <span>
            ={" "}
            <span className="font-mono font-bold text-foreground">
              {formatMoney(costPerBotDaily, "usd")}/bot/dia
            </span>
          </span>
        </div>

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
              <span className="font-mono tabular-nums w-28 text-right">
                {formatMoney(d.weekCost, "usd")}
              </span>
            </div>
          ))}

          {hasOneTimeCosts && (
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>
                Unico (Lv + Stash){" "}
                <span className="text-xs ml-1">{maxBots} bots</span>
              </span>
              <span className="font-mono tabular-nums w-28 text-right">
                {formatMoney(
                  maxBots *
                    (Number(costConfig.levelingCostPerBot) +
                      Number(costConfig.stashPackCostPerBot)),
                  "usd"
                )}
              </span>
            </div>
          )}

          {totals.buildCostBrl > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
              <span>
                Build (divines){" "}
                <span
                  className="text-xs ml-1"
                  title="Custo de divines para montar cada bot novo, travado em BRL pelo preço da divine no dia em que o bot entrou em operação. Conversão para USD usa a cotação atual."
                >
                  fixado por bot
                </span>
              </span>
              <span className="font-mono tabular-nums w-28 text-right">
                {formatMoney(totals.buildCostBrl, "brl")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 font-medium">
            <span>Total</span>
            <span className="font-mono tabular-nums w-28 text-right">
              {formatMoney(totals.totalCost, "usd")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
