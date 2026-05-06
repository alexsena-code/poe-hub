"use client";

// Left card of the 2-column breakdown: itemised cost per week + one-time costs.

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { DisplayCurrency } from "@/components/currency-provider";
import type { CostConfig, Simulation } from "./types";
import type { SimulationTotals } from "./utils";

interface WeekRow {
  name: string;
  bots: number | null;
  activeDays: number;
  weekCost: number;
}

interface DiscountPatch {
  expluginsDiscountStartDay?: number | null;
  expluginsDiscountPercent?: number | null;
}

interface SimulationCostBreakdownProps {
  costConfig: CostConfig;
  simulation: Simulation;
  totals: SimulationTotals;
  weekData: WeekRow[];
  formatMoney: (val: number, currency: DisplayCurrency) => string;
  onDiscountChange: (patch: DiscountPatch) => void;
}

export function SimulationCostBreakdown({
  costConfig,
  simulation,
  totals,
  weekData,
  formatMoney,
  onDiscountChange,
}: SimulationCostBreakdownProps) {
  const explugins = Number(costConfig.expluginsKeyCostDaily);
  const dpb = Number(costConfig.dpbKeyCostDaily);
  const proxyDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
  const costPerBotDaily = explugins + dpb + proxyDaily;
  const totalDays = simulation.durationWeeks * 7;
  const discountActive = simulation.expluginsDiscountStartDay != null;
  const discountStartDay = simulation.expluginsDiscountStartDay ?? "";
  const discountPercent = simulation.expluginsDiscountPercent ?? 50;
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

        <div className="flex flex-wrap items-center gap-2 text-xs rounded-md border bg-muted/30 px-3 py-2">
          <Switch
            id="explugins-discount-toggle"
            checked={discountActive}
            onCheckedChange={(checked) =>
              onDiscountChange(
                checked
                  ? {
                      expluginsDiscountStartDay: Math.min(
                        21,
                        Math.max(1, totalDays)
                      ),
                      expluginsDiscountPercent: 50,
                    }
                  : { expluginsDiscountStartDay: null }
              )
            }
          />
          <Label
            htmlFor="explugins-discount-toggle"
            className="cursor-pointer"
          >
            Desconto Explugins
          </Label>
          {discountActive && (
            <>
              <span className="text-muted-foreground">a partir do dia</span>
              <Input
                type="number"
                min={1}
                max={totalDays}
                value={discountStartDay}
                onChange={(e) =>
                  onDiscountChange({
                    expluginsDiscountStartDay: Number(e.target.value) || 1,
                  })
                }
                className="h-7 w-20 text-xs font-mono"
              />
              <span className="text-muted-foreground">de</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={Number(discountPercent)}
                onChange={(e) =>
                  onDiscountChange({
                    expluginsDiscountPercent: Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0)
                    ),
                  })
                }
                className="h-7 w-16 text-xs font-mono"
              />
              <span className="text-muted-foreground">% off</span>
              <span
                className="ml-auto text-[11px] text-muted-foreground"
                title="Os devs do Explugins dão 50% de desconto quando a divine cai pra valer a pena continuar farmando."
              >
                custo cai pra{" "}
                <span className="font-mono text-foreground">
                  {formatMoney(
                    explugins * (1 - Number(discountPercent) / 100),
                    "usd"
                  )}
                </span>
              </span>
            </>
          )}
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
