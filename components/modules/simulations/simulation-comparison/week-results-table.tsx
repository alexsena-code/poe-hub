"use client";

// Section D: week-by-week revenue / cost / profit results with a delta column
// comparing the first vs last simulation.

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Delta } from "./delta";
import type { Simulation, WeekTotals } from "./types";

interface WeekResultsTableProps {
  simulations: Simulation[];
  simNames: string[];
  allWeekNumbers: number[];
  allWeekTotalsList: WeekTotals[][];
  formatMoney: (v: number, currency: "usd" | "brl") => string;
}

export function WeekResultsTable({
  simulations,
  simNames,
  allWeekNumbers,
  allWeekTotalsList,
  formatMoney,
}: WeekResultsTableProps) {
  const fmt = (v: number) => formatMoney(v, "usd");

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="font-semibold mb-3">Resultados por Semana</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Semana</TableHead>
                {simNames.map((name) => (
                  <TableHead
                    key={name}
                    colSpan={3}
                    className="text-center border-l border-border/50 text-foreground"
                  >
                    {name}
                  </TableHead>
                ))}
                {simulations.length >= 2 && (
                  <TableHead className="text-right border-l border-border/50">Delta</TableHead>
                )}
              </TableRow>
              <TableRow>
                <TableHead />
                {simulations.map((sim) => (
                  <React.Fragment key={sim.id}>
                    <TableHead className="text-right border-l border-border/50 text-xs font-normal text-muted-foreground">
                      Receita
                    </TableHead>
                    <TableHead className="text-right text-xs font-normal text-muted-foreground">
                      Custo
                    </TableHead>
                    <TableHead className="text-right text-xs font-normal text-muted-foreground">
                      Lucro
                    </TableHead>
                  </React.Fragment>
                ))}
                {simulations.length >= 2 && <TableHead className="border-l border-border/50" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allWeekNumbers.map((wn) => {
                const weekData = allWeekTotalsList.map((wts) =>
                  wts.find((w) => w.weekNumber === wn)
                );
                const anyLabel = weekData.find((w) => w?.label)?.label;

                return (
                  <TableRow key={wn}>
                    <TableCell className="text-sm font-medium">
                      S{wn}
                      {anyLabel && (
                        <span className="ml-1 text-xs text-muted-foreground">({anyLabel})</span>
                      )}
                    </TableCell>
                    {weekData.map((w, si) => (
                      <React.Fragment key={si}>
                        <TableCell className="text-right font-mono tabular-nums text-sm border-l border-border/50">
                          {w ? fmt(w.revenue) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {w ? fmt(w.cost) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono tabular-nums text-sm font-medium",
                            w
                              ? w.profit >= 0
                                ? "text-green-500"
                                : "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {w ? `${w.profit >= 0 ? "+" : ""}${fmt(w.profit)}` : "—"}
                        </TableCell>
                      </React.Fragment>
                    ))}
                    {simulations.length >= 2 && (
                      <TableCell className="text-right border-l border-border/50">
                        {weekData[0] && weekData[weekData.length - 1] ? (
                          <Delta
                            a={weekData[0]!.profit}
                            b={weekData[weekData.length - 1]!.profit}
                            formatFn={fmt}
                            positiveIsGood
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
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
