"use client";

// What-if scenario tester. Lets the operator define N variations of bot
// progression params and see deltas vs the current simulation baseline,
// purely client-side — nothing is persisted until they hit "Aplicar".

import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FlaskConical, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  calcDelta,
  calcScenario,
  makeScenarioId,
  type Scenario,
} from "./scenarios";
import { calcTotals, fmtNum } from "./utils";
import type { CostConfig, Simulation } from "./types";

interface ScenarioTesterProps {
  simulation: Simulation;
  simulationId: string;
  costConfig: CostConfig | null;
  onApplied: () => void;
}

function defaultScenarios(simulation: Simulation): Scenario[] {
  const startDay = (simulation.startDayOffset ?? 0) + 1;
  const totalDays = simulation.durationWeeks * 7;
  const peak = Math.max(
    ...simulation.weeks.map((w) => Number(w.defaultActiveBots)),
    10
  );
  return [
    {
      id: makeScenarioId(),
      label: "Rampa lenta",
      maxBots: peak,
      incrementPerDay: 1,
      startBots: 1,
      startDay,
    },
    {
      id: makeScenarioId(),
      label: "Rampa rápida",
      maxBots: peak,
      incrementPerDay: Math.max(2, Math.ceil(peak / Math.max(1, totalDays / 4))),
      startBots: 1,
      startDay,
    },
  ];
}

export function ScenarioTester({
  simulation,
  simulationId,
  costConfig,
  onApplied,
}: ScenarioTesterProps) {
  const { formatMoney, exchangeRate } = useCurrency();
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    defaultScenarios(simulation)
  );
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const baseline = useMemo(
    () => calcTotals(simulation, costConfig, exchangeRate),
    [simulation, costConfig, exchangeRate]
  );

  const results = useMemo(
    () =>
      scenarios.map((s) =>
        calcScenario(simulation, costConfig, exchangeRate, s)
      ),
    [scenarios, simulation, costConfig, exchangeRate]
  );

  const totalDays = simulation.durationWeeks * 7;

  const updateScenario = useCallback(
    (id: string, patch: Partial<Scenario>) => {
      setScenarios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
    },
    []
  );

  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addScenario = useCallback(() => {
    const startDay = (simulation.startDayOffset ?? 0) + 1;
    const peak = Math.max(
      ...simulation.weeks.map((w) => Number(w.defaultActiveBots)),
      10
    );
    setScenarios((prev) => [
      ...prev,
      {
        id: makeScenarioId(),
        label: `Cenário ${prev.length + 1}`,
        maxBots: peak,
        incrementPerDay: 1,
        startBots: 1,
        startDay,
      },
    ]);
  }, [simulation]);

  const applyScenario = useCallback(
    async (s: Scenario) => {
      setApplyingId(s.id);
      try {
        const res = await fetch(
          `/api/simulations/${simulationId}/bot-progression`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              maxBots: s.maxBots,
              incrementPerDay: s.incrementPerDay,
              startBots: s.startBots,
              startDay: s.startDay,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `status ${res.status}`);
        }
        toast.success(`"${s.label}" aplicado à simulação.`);
        onApplied();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erro ao aplicar cenário"
        );
      } finally {
        setApplyingId(null);
      }
    },
    [simulationId, onApplied]
  );

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold">Testador de cenários</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Edite os parâmetros — recálculo é instantâneo. "Aplicar" sobrescreve
            os bots da simulação atual.
          </p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Cenário</TableHead>
                <TableHead className="w-20">Max</TableHead>
                <TableHead className="w-20">Incr/dia</TableHead>
                <TableHead className="w-20">Inicial</TableHead>
                <TableHead className="w-20">Dia início</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Δ Lucro</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30">
                <TableCell className="font-medium">
                  <Badge variant="secondary" className="text-xs">
                    Baseline (atual)
                  </Badge>
                </TableCell>
                <TableCell colSpan={4} className="text-xs text-muted-foreground">
                  Bots como estão na simulação hoje
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatMoney(baseline.revenueUsd, "usd")}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatMoney(baseline.totalCost, "usd")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs font-semibold",
                    baseline.profit >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {formatMoney(baseline.profit, "usd")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs",
                    baseline.roi >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {fmtNum(baseline.roi, 1)}%
                </TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell />
              </TableRow>

              {results.map(({ scenario: s, totals, dayReachingMax }) => {
                const delta = calcDelta(baseline, totals);
                const dPositive = delta.profit >= 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Input
                        value={s.label}
                        onChange={(e) =>
                          updateScenario(s.id, { label: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                      {dayReachingMax && (
                        <span className="block text-[10px] text-muted-foreground mt-1">
                          atinge max em D{dayReachingMax}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={s.maxBots}
                        onChange={(e) =>
                          updateScenario(s.id, {
                            maxBots: Number(e.target.value) || 1,
                          })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={s.incrementPerDay}
                        onChange={(e) =>
                          updateScenario(s.id, {
                            incrementPerDay: Number(e.target.value) || 1,
                          })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={s.startBots}
                        onChange={(e) =>
                          updateScenario(s.id, {
                            startBots: Number(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={totalDays}
                        value={s.startDay}
                        onChange={(e) =>
                          updateScenario(s.id, {
                            startDay: Number(e.target.value) || 1,
                          })
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(totals.revenueUsd, "usd")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(totals.totalCost, "usd")}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs font-semibold",
                        totals.profit >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {formatMoney(totals.profit, "usd")}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs",
                        totals.roi >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {fmtNum(totals.roi, 1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs font-semibold",
                        dPositive ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {dPositive ? "+" : ""}
                      {formatMoney(delta.profit, "usd")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => applyScenario(s)}
                          disabled={applyingId === s.id}
                          title="Aplicar este cenário à simulação"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeScenario(s.id)}
                          title="Remover cenário"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={addScenario}
            disabled={scenarios.length >= 6}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar cenário
          </Button>
          <p className="text-xs text-muted-foreground">
            Comparação 100% local — só "Aplicar" persiste no banco.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
