"use client";

// Section A: financial totals table + chart toggle for the scenario chart.
// Kept as a separate card so the orchestrator can render it cleanly.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { ScenarioChart } from "./scenario-chart";
import type { Simulation, SimTotals } from "./types";

interface FinancialSummaryProps {
  simulations: Simulation[];
  simNames: string[];
  allTotals: SimTotals[];
  exchangeRate: number;
  formatMoney: (v: number, currency: "usd" | "brl") => string;
}

const METRICS: {
  label: string;
  key: keyof SimTotals;
  positiveIsGood: boolean;
  isRoi?: boolean;
}[] = [
  { label: "Receita", key: "revenueUsd", positiveIsGood: true },
  { label: "Custo Op.", key: "operationalCost", positiveIsGood: false },
  { label: "Custo Unico", key: "oneTimeCost", positiveIsGood: false },
  { label: "Lucro", key: "profit", positiveIsGood: true },
  { label: "ROI", key: "roi", positiveIsGood: true, isRoi: true },
];

export function FinancialSummary({
  simulations,
  simNames,
  allTotals,
  exchangeRate,
  formatMoney,
}: FinancialSummaryProps) {
  const [showChart, setShowChart] = useState(false);
  const fmt = (v: number) => formatMoney(v, "usd");
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="font-semibold mb-3">Resumo Financeiro</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Metrica</TableHead>
                {simNames.map((name) => (
                  <TableHead key={name} className="text-right font-medium text-foreground">
                    {name}
                  </TableHead>
                ))}
                {simulations.length >= 2 && (
                  <TableHead className="text-right">Delta</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRICS.map((m) => (
                <TableRow key={m.key}>
                  <TableCell
                    className={cn(
                      "text-muted-foreground text-sm",
                      (m.key === "profit" || m.isRoi) && "font-medium"
                    )}
                  >
                    {m.label}
                  </TableCell>
                  {allTotals.map((t, i) => {
                    const val = t[m.key];
                    const isHighlight = m.key === "profit" || m.isRoi;
                    return (
                      <TableCell
                        key={i}
                        className={cn(
                          "text-right font-mono tabular-nums",
                          isHighlight && "font-medium",
                          isHighlight && (val >= 0 ? "text-green-500" : "text-destructive")
                        )}
                      >
                        {m.isRoi ? fmtPct(val) : fmt(val)}
                      </TableCell>
                    );
                  })}
                  {simulations.length >= 2 && (
                    <TableCell className="text-right">
                      <Delta
                        a={allTotals[0][m.key]}
                        b={allTotals[allTotals.length - 1][m.key]}
                        formatFn={
                          m.isRoi
                            ? (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`
                            : fmt
                        }
                        positiveIsGood={m.positiveIsGood}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Chart toggle */}
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
          onClick={() => setShowChart(!showChart)}
        >
          {showChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showChart ? "Ocultar grafico" : "Ver impacto por semana"}
        </button>

        {showChart && (
          <ScenarioChart
            simulations={simulations}
            simNames={simNames}
            totals={allTotals}
            exchangeRate={exchangeRate}
            formatMoney={formatMoney}
          />
        )}
      </CardContent>
    </Card>
  );
}
