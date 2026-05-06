"use client";

// Per-bot cohort breakdown table. Reveals how each "wave" of bots performs
// over its lifetime — answers "qual a diferença por bot conforme entram".

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { calcCohorts } from "./cohorts";
import { fmtNum } from "./utils";
import type { CostConfig, Simulation } from "./types";

interface CohortBreakdownProps {
  simulation: Simulation;
  costConfig: CostConfig | null;
}

export function CohortBreakdown({
  simulation,
  costConfig,
}: CohortBreakdownProps) {
  const { formatMoney, exchangeRate } = useCurrency();

  const cohorts = useMemo(
    () => calcCohorts(simulation, costConfig, exchangeRate),
    [simulation, costConfig, exchangeRate]
  );

  if (cohorts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 pb-4 text-sm text-muted-foreground">
          Nenhum bot foi adicionado em nenhum dia. Use a Progressão Auto ou
          edite os bots por semana/dia para gerar cohorts.
        </CardContent>
      </Card>
    );
  }

  const totalBots = cohorts.reduce((sum, c) => sum + c.size, 0);
  const avgBreakEven =
    cohorts
      .filter((c) => c.breakEvenDays !== null)
      .reduce((sum, c) => sum + (c.breakEvenDays ?? 0), 0) /
    Math.max(1, cohorts.filter((c) => c.breakEvenDays !== null).length);

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-semibold">Cohorts (por dia de criação)</p>
            <p className="text-xs text-muted-foreground">
              Cada cohort contabiliza só seus próprios bots — receita / custo /
              break-even isolados.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Total: <span className="font-mono text-foreground">{totalBots}</span> bots em{" "}
              <span className="font-mono text-foreground">{cohorts.length}</span> cohorts
            </span>
            {Number.isFinite(avgBreakEven) && avgBreakEven > 0 && (
              <span>
                Break-even médio:{" "}
                <span className="font-mono text-foreground">
                  {fmtNum(avgBreakEven, 1)}d
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Dia</TableHead>
                <TableHead className="w-16">Bots</TableHead>
                <TableHead className="text-right">Build</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Break-even</TableHead>
                <TableHead className="text-right">Lucro/bot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((c) => {
                const profitPerBot = c.size > 0 ? c.profitUsd / c.size : 0;
                const profitPositive = c.profitUsd >= 0;
                return (
                  <TableRow key={`${c.weekNumber}-${c.dayNumber}`}>
                    <TableCell className="font-mono text-xs">
                      D{c.startDay}
                      <span className="text-muted-foreground ml-1">
                        (S{c.weekNumber}/d{c.dayNumber})
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {c.size}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {c.buildCostBrl > 0
                        ? formatMoney(c.buildCostBrl, "brl")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(c.revenueUsd, "usd")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(c.totalCostUsd, "usd")}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs font-semibold",
                        profitPositive ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {formatMoney(c.profitUsd, "usd")}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs",
                        c.roi >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {fmtNum(c.roi, 1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {c.breakEvenDays !== null ? (
                        <>
                          {c.breakEvenDays}d
                          <span className="text-muted-foreground ml-1">
                            (D{c.breakEvenGlobalDay})
                          </span>
                        </>
                      ) : (
                        <span className="text-destructive">não atinge</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs",
                        profitPerBot >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {formatMoney(profitPerBot, "usd")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
