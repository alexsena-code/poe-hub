"use client";

// What-if scenario tester. Two orthogonal axes per scenario:
//   1) bot progression (max, increment/day, startBots, startDay)
//   2) price overlay (historical league + median/cnl + day-1 alignment)
// Recomputes totals client-side via calcScenario — only the "Aplicar" button
// persists, and even then only the bot progression (not the price overlay).

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useLeagues } from "@/hooks/use-leagues";
import {
  calcScenario,
  makeScenarioId,
  type Scenario,
  type PriceLeagueData,
} from "./scenarios";
import { calcTotals, fmtNum } from "./utils";
import { ScenarioRow } from "./scenario-row";
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
  const baseProgression = (incr: number, label: string): Scenario => ({
    id: makeScenarioId(),
    label,
    maxBots: peak,
    incrementPerDay: incr,
    startBots: 1,
    startDay,
    price: { league: null, source: "median", startDay: 1 },
  });
  return [
    baseProgression(1, "Rampa lenta"),
    baseProgression(
      Math.max(2, Math.ceil(peak / Math.max(1, totalDays / 4))),
      "Rampa rápida"
    ),
  ];
}

export function ScenarioTester({
  simulation,
  simulationId,
  costConfig,
  onApplied,
}: ScenarioTesterProps) {
  const { formatMoney, exchangeRate } = useCurrency();
  const { leagues } = useLeagues();
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    defaultScenarios(simulation)
  );
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [priceCache, setPriceCache] = useState<
    Record<string, PriceLeagueData>
  >({});
  // Refs because mutating these can't trigger re-renders — we'd race with the
  // effect's cleanup and abort our own in-flight fetches.
  const fetchingRef = useRef<Set<string>>(new Set());
  const cacheRef = useRef<Record<string, PriceLeagueData>>({});

  // Lazy-fetch price data when a scenario references a league we don't have yet.
  // On error or empty response we still cache an empty PriceLeagueData so the
  // UI can show "sem dados" instead of looping forever in the loading state.
  useEffect(() => {
    for (const s of scenarios) {
      const league = s.price.league;
      if (!league) continue;
      if (cacheRef.current[league]) continue;
      if (fetchingRef.current.has(league)) continue;

      const lg = leagues.find((l) => l.name === league);
      if (!lg?.startDate) continue;

      fetchingRef.current.add(league);
      const startDate = lg.startDate;

      fetch(
        `/api/prices/daily?league=${encodeURIComponent(league)}&item=divine`
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then(
          (rows: Array<{ date: string; median: number; cnlPrice: number | null }>) => {
            const data: PriceLeagueData = {
              leagueStartDate: startDate,
              rows: rows.map((r) => ({
                date: r.date,
                median: Number(r.median),
                cnlPrice: r.cnlPrice == null ? null : Number(r.cnlPrice),
              })),
            };
            cacheRef.current[league] = data;
            setPriceCache((prev) => ({ ...prev, [league]: data }));
            if (rows.length === 0) {
              toast.warning(`Sem dados de preço para ${league}`);
            }
          }
        )
        .catch(() => {
          // Cache an empty result so we don't retry on every re-render.
          const empty: PriceLeagueData = {
            leagueStartDate: startDate,
            rows: [],
          };
          cacheRef.current[league] = empty;
          setPriceCache((prev) => ({ ...prev, [league]: empty }));
          toast.error(`Erro ao buscar preços de ${league}`);
        })
        .finally(() => {
          fetchingRef.current.delete(league);
        });
    }
  }, [scenarios, leagues]);

  const baseline = useMemo(
    () => calcTotals(simulation, costConfig, exchangeRate),
    [simulation, costConfig, exchangeRate]
  );

  const results = useMemo(
    () =>
      scenarios.map((s) => {
        const data = s.price.league ? priceCache[s.price.league] ?? null : null;
        return calcScenario(simulation, costConfig, exchangeRate, s, data);
      }),
    [scenarios, simulation, costConfig, exchangeRate, priceCache]
  );

  const totalDays = simulation.durationWeeks * 7;

  // Leagues with daily-price data are inferred from the leagues list. We can't
  // know in advance which leagues actually have rows in DailyPrice without an
  // extra round-trip, so we mark all leagues with a startDate as eligible and
  // surface "no data" via toast when the fetch returns empty.
  const leagueOptions = useMemo(
    () =>
      leagues
        .filter((l) => l.startDate != null)
        .sort((a, b) => {
          const da = a.startDate ? new Date(a.startDate).getTime() : 0;
          const db = b.startDate ? new Date(b.startDate).getTime() : 0;
          return db - da;
        })
        .map((l) => ({ name: l.name, hasData: true })),
    [leagues]
  );

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
        price: { league: null, source: "median", startDay: 1 },
      },
    ]);
  }, [simulation]);

  const applyScenario = useCallback(
    async (s: Scenario) => {
      if (s.price.league !== null) {
        toast.info(
          "Apenas a progressão de bots será persistida. Os preços ficam somente no preview."
        );
      }
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
            Recálculo é instantâneo. "Aplicar" persiste a progressão de bots
            (não os preços).
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
                <TableHead className="w-44">Preços</TableHead>
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
                <TableCell colSpan={5} className="text-xs text-muted-foreground">
                  Bots e preços como estão na simulação hoje
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

              {results.map((result) => {
                const s = result.scenario;
                const cached = s.price.league
                  ? priceCache[s.price.league]
                  : null;
                const priceLoading = s.price.league !== null && !cached;
                const priceNoData =
                  s.price.league !== null && !!cached && cached.rows.length === 0;
                return (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    result={result}
                    baseline={baseline}
                    totalDays={totalDays}
                    leagueOptions={leagueOptions}
                    applyingId={applyingId}
                    priceLoading={priceLoading}
                    priceNoData={priceNoData}
                    formatMoney={formatMoney}
                    onUpdate={(patch) => updateScenario(s.id, patch)}
                    onRemove={() => removeScenario(s.id)}
                    onApply={() => applyScenario(s)}
                  />
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
            Comparação 100% local. Preços por liga vêm do histórico do Discord.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
