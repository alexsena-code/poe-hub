"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Save, ChevronDown, ChevronUp } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { SimulationWeek, SimulationDay } from "./week-editor";

// --- Types ---

interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  startDayOffset: number;
  costConfigName: string | null;
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  weeks: SimulationWeek[];
}

interface SimTotals {
  revenueUsd: number;
  operationalCost: number;
  oneTimeCost: number;
  totalCost: number;
  profit: number;
  roi: number;
}

interface WeekTotals {
  weekNumber: number;
  label: string | null;
  revenue: number;
  cost: number;
  profit: number;
}

// --- Helpers ---

function resolveField(
  day: SimulationDay,
  field: keyof Pick<
    SimulationDay,
    "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl"
  >,
  week: SimulationWeek
): number | null {
  const dayVal = day[field];
  if (dayVal !== null && dayVal !== undefined) return Number(dayVal);

  const defaultMap: Record<string, keyof SimulationWeek> = {
    activeBots: "defaultActiveBots",
    divinePerHour: "defaultDivinePerHour",
    hoursPerDay: "defaultHoursPerDay",
    divinePriceUsd: "defaultDivinePriceUsd",
    divinePriceBrl: "defaultDivinePriceBrl",
  };

  const weekVal = week[defaultMap[field]];
  return weekVal !== null && weekVal !== undefined ? Number(weekVal) : null;
}

function calcSimTotals(sim: Simulation, exchangeRate: number): SimTotals {
  let totalRevenueUsd = 0;
  let totalRevenueBrl = 0;
  let totalOperationalCost = 0;

  const offset = sim.startDayOffset ?? 0;

  const hasCost =
    sim.proxyCostPerBotMonthly != null &&
    sim.expluginsKeyCostDaily != null &&
    sim.dpbKeyCostDaily != null;

  const expluginsDaily = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const costPerBotDaily = expluginsDaily + dpbDaily + proxyDaily;

  for (const week of sim.weeks) {
    for (const day of week.days) {
      const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
      if (globalDayIndex < offset) continue;

      const bots = resolveField(day, "activeBots", week);
      const dph = resolveField(day, "divinePerHour", week);
      const hours = resolveField(day, "hoursPerDay", week);
      const priceUsd = resolveField(day, "divinePriceUsd", week);
      const priceBrl = resolveField(day, "divinePriceBrl", week);

      if (bots !== null && dph !== null && hours !== null) {
        const divines = bots * dph * hours;
        if (priceUsd !== null) totalRevenueUsd += divines * priceUsd;
        if (priceBrl !== null) totalRevenueBrl += divines * priceBrl;
      }

      if (hasCost) {
        const activeBots = resolveField(day, "activeBots", week) ?? 0;
        totalOperationalCost += activeBots * costPerBotDaily;
      }
    }
  }

  const effectiveRevenueUsd =
    totalRevenueUsd > 0 ? totalRevenueUsd : totalRevenueBrl / exchangeRate;

  let oneTimeCost = 0;
  if (hasCost) {
    const maxBots = Math.max(
      ...sim.weeks.map((w) => Number(w.defaultActiveBots)),
      0
    );
    oneTimeCost =
      maxBots *
      (Number(sim.levelingCostPerBot ?? 0) +
        Number(sim.stashPackCostPerBot ?? 0));
  }

  const totalCost = totalOperationalCost + oneTimeCost;
  const profit = effectiveRevenueUsd - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    revenueUsd: effectiveRevenueUsd,
    operationalCost: totalOperationalCost,
    oneTimeCost,
    totalCost,
    profit,
    roi,
  };
}

function calcWeekTotals(sim: Simulation, exchangeRate: number): WeekTotals[] {
  const offset = sim.startDayOffset ?? 0;

  const hasCost =
    sim.proxyCostPerBotMonthly != null &&
    sim.expluginsKeyCostDaily != null &&
    sim.dpbKeyCostDaily != null;

  const expluginsDaily = hasCost ? Number(sim.expluginsKeyCostDaily) : 0;
  const dpbDaily = hasCost ? Number(sim.dpbKeyCostDaily) : 0;
  const proxyDaily = hasCost ? Number(sim.proxyCostPerBotMonthly) / 30 : 0;
  const costPerBotDaily = expluginsDaily + dpbDaily + proxyDaily;

  return [...sim.weeks]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => {
      let weekRevUsd = 0;
      let weekRevBrl = 0;
      let weekCost = 0;

      for (const day of week.days) {
        const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
        if (globalDayIndex < offset) continue;

        const bots = resolveField(day, "activeBots", week);
        const dph = resolveField(day, "divinePerHour", week);
        const hours = resolveField(day, "hoursPerDay", week);
        const priceUsd = resolveField(day, "divinePriceUsd", week);
        const priceBrl = resolveField(day, "divinePriceBrl", week);

        if (bots !== null && dph !== null && hours !== null) {
          const divines = bots * dph * hours;
          if (priceUsd !== null) weekRevUsd += divines * priceUsd;
          if (priceBrl !== null) weekRevBrl += divines * priceBrl;
        }

        if (hasCost) {
          const activeBots = resolveField(day, "activeBots", week) ?? 0;
          weekCost += activeBots * costPerBotDaily;
        }
      }

      const effectiveRev =
        weekRevUsd > 0 ? weekRevUsd : weekRevBrl / exchangeRate;

      return {
        weekNumber: week.weekNumber,
        label: week.label,
        revenue: effectiveRev,
        cost: weekCost,
        profit: effectiveRev - weekCost,
      };
    });
}

// --- Delta display ---

interface DeltaProps {
  a: number;
  b: number;
  formatFn: (v: number) => string;
  positiveIsGood?: boolean;
}

function Delta({ a, b, formatFn, positiveIsGood = true }: DeltaProps) {
  const delta = b - a;
  const pct = a !== 0 ? (delta / Math.abs(a)) * 100 : 0;
  const isPositive = delta > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const isZero = Math.abs(delta) < 0.001;

  if (isZero) {
    return <span className="text-muted-foreground font-mono tabular-nums">—</span>;
  }

  return (
    <span
      className={cn(
        "font-mono tabular-nums text-sm",
        isGood ? "text-green-500" : "text-destructive"
      )}
    >
      {isPositive ? "+" : ""}
      {formatFn(delta)}
      {a !== 0 && (
        <span className="ml-1 text-xs opacity-80">
          ({isPositive ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}

// --- Inline edit cell ---

function EditableNum({
  value,
  onChange,
  type = "decimal",
}: {
  value: number;
  onChange: (v: number) => void;
  type?: "int" | "decimal";
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setEditVal(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const parsed = type === "int" ? parseInt(editVal) : parseFloat(editVal);
    if (!isNaN(parsed) && parsed !== value) onChange(parsed);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="h-6 w-16 text-center font-mono text-sm bg-background border border-input rounded-sm outline-none focus:ring-1 focus:ring-ring"
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer font-mono text-sm hover:text-primary transition-colors underline decoration-dotted underline-offset-4"
      onClick={start}
    >
      {type === "int" ? value : value.toFixed(2)}
    </span>
  );
}

// --- Main component ---

interface SimulationComparisonProps {
  ids: string[];
}

export function SimulationComparison({ ids }: SimulationComparisonProps) {
  const { formatMoney, exchangeRate } = useCurrency();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState(false);

  function updateWeekDefault(
    simIndex: number,
    weekNumber: number,
    field: string,
    value: number
  ) {
    setSimulations((prev) => {
      const updated = [...prev];
      const sim = { ...updated[simIndex], weeks: [...updated[simIndex].weeks] };
      sim.weeks = sim.weeks.map((w) =>
        w.weekNumber === weekNumber ? { ...w, [field]: value } : w
      );
      updated[simIndex] = sim;
      return updated;
    });
    setDirty((prev) => new Set(prev).add(ids[simIndex]));
  }

  async function saveSimulation(simIndex: number) {
    const sim = simulations[simIndex];
    try {
      for (const week of sim.weeks) {
        await fetch(
          `/api/simulations/${sim.id}/weeks/${week.weekNumber}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              defaultActiveBots: week.defaultActiveBots,
              defaultDivinePerHour: week.defaultDivinePerHour,
              defaultHoursPerDay: week.defaultHoursPerDay,
              defaultDivinePriceUsd: week.defaultDivinePriceUsd,
              defaultDivinePriceBrl: week.defaultDivinePriceBrl,
            }),
          }
        );
      }
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(sim.id);
        return next;
      });
    } catch {
      // data already updated locally
    }
  }

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }

    async function fetchAll() {
      try {
        const results = await Promise.all(
          ids.map((id) =>
            fetch(`/api/simulations/${id}`).then((r) => {
              if (!r.ok) throw new Error(`Erro ao carregar simulacao ${id}`);
              return r.json() as Promise<Simulation>;
            })
          )
        );
        setSimulations(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar simulacoes");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Early returns ---

  if (ids.length < 2) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-muted-foreground">
          Selecione pelo menos 2 simulacoes para comparar.
        </p>
        <Button asChild variant="outline">
          <Link href="/simulations">Ir para Simulacoes</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando simulacoes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (simulations.length < 2) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-muted-foreground">Nao foi possivel carregar as simulacoes.</p>
      </div>
    );
  }

  // Unique display names (append index if names collide)
  const simNames = simulations.map((sim, i) => {
    const hasDupe = simulations.some((s, j) => j !== i && s.name === sim.name);
    return hasDupe ? `${sim.name} (${i + 1})` : sim.name;
  });

  const allTotals = simulations.map((sim) => calcSimTotals(sim, exchangeRate));
  const allWeekTotalsList = simulations.map((sim) => calcWeekTotals(sim, exchangeRate));

  const totalsA = allTotals[0];
  const totalsB = allTotals[1];

  const allWeekNumbers = Array.from(
    new Set(allWeekTotalsList.flatMap((wts) => wts.map((w) => w.weekNumber)))
  ).sort((a, b) => a - b);

  const fmt = (v: number) => formatMoney(v, "usd");
  const fmtPct = (v: number) =>
    `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Comparacao de Simulacoes</h1>
        <p className="text-muted-foreground text-sm">
          {simulations.map((s) => s.name).join(" vs ")}
        </p>
      </div>

      {/* Section A: Summary metrics table */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="font-semibold mb-3">Resumo Financeiro</p>
          <div className="overflow-x-auto">
              {(() => {
                const metrics: { label: string; key: keyof SimTotals; positiveIsGood: boolean; isRoi?: boolean }[] = [
                  { label: "Receita", key: "revenueUsd", positiveIsGood: true },
                  { label: "Custo Op.", key: "operationalCost", positiveIsGood: false },
                  { label: "Custo Unico", key: "oneTimeCost", positiveIsGood: false },
                  { label: "Lucro", key: "profit", positiveIsGood: true },
                  { label: "ROI", key: "roi", positiveIsGood: true, isRoi: true },
                ];

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Metrica</TableHead>
                        {simNames.map((name) => (
                          <TableHead key={name} className="text-right font-medium text-foreground">{name}</TableHead>
                        ))}
                        {simulations.length >= 2 && <TableHead className="text-right">Delta</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.map((m) => (
                        <TableRow key={m.key}>
                          <TableCell className={cn("text-muted-foreground text-sm", (m.key === "profit" || m.isRoi) && "font-medium")}>
                            {m.label}
                          </TableCell>
                          {allTotals.map((t, i) => {
                            const val = t[m.key];
                            const isHighlight = m.key === "profit" || m.isRoi;
                            return (
                              <TableCell key={i} className={cn(
                                "text-right font-mono tabular-nums",
                                isHighlight && "font-medium",
                                isHighlight && (val >= 0 ? "text-green-500" : "text-destructive")
                              )}>
                                {m.isRoi ? fmtPct(val) : fmt(val)}
                              </TableCell>
                            );
                          })}
                          {simulations.length >= 2 && (
                            <TableCell className="text-right">
                              <Delta
                                a={allTotals[0][m.key]}
                                b={allTotals[allTotals.length - 1][m.key]}
                                formatFn={m.isRoi ? (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp` : fmt}
                                positiveIsGood={m.positiveIsGood}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
          </div>

          {/* Chart toggle */}
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showChart ? "Ocultar grafico" : "Ver impacto por semana"}
          </button>

          {showChart && (() => {
            const colors = ["hsl(142, 71%, 45%)", "hsl(220, 70%, 60%)", "hsl(45, 90%, 55%)", "hsl(340, 70%, 55%)"];
            const simKeys = simNames;

            // Build daily cumulative profit for each sim
            const totalDays = Math.max(...simulations.map((s) => s.durationWeeks * 7));
            const chartData: Record<string, number | string>[] = [];

            for (let d = 0; d < totalDays; d++) {
              const point: Record<string, number | string> = { name: `D${d + 1}` };

              simulations.forEach((sim, si) => {
                const offset = sim.startDayOffset ?? 0;
                const hasCost = sim.proxyCostPerBotMonthly != null && sim.expluginsKeyCostDaily != null && sim.dpbKeyCostDaily != null;
                const costPerBotDaily = hasCost
                  ? Number(sim.expluginsKeyCostDaily) + Number(sim.dpbKeyCostDaily) + Number(sim.proxyCostPerBotMonthly) / 30
                  : 0;

                // Start with one-time costs as negative (investment)
                const maxBots = Math.max(...sim.weeks.map((w) => Number(w.defaultActiveBots)), 0);
                const oneTime = hasCost
                  ? maxBots * (Number(sim.levelingCostPerBot ?? 0) + Number(sim.stashPackCostPerBot ?? 0))
                  : 0;
                let cumProfit = -oneTime;
                for (let di = 0; di <= d; di++) {
                  if (di < offset) continue;
                  const wn = Math.floor(di / 7);
                  const dn = di % 7;
                  const week = sim.weeks.find((w) => w.weekNumber === wn + 1);
                  if (!week) continue;
                  const day = week.days.find((dd) => dd.dayNumber === dn + 1);
                  if (!day) continue;

                  const bots = resolveField(day, "activeBots", week) ?? 0;
                  const dph = resolveField(day, "divinePerHour", week);
                  const hours = resolveField(day, "hoursPerDay", week);
                  const priceUsd = resolveField(day, "divinePriceUsd", week);
                  const priceBrl = resolveField(day, "divinePriceBrl", week);

                  let dayRev = 0;
                  if (bots && dph && hours) {
                    const divines = bots * Number(dph) * Number(hours);
                    if (priceUsd) dayRev = divines * Number(priceUsd);
                    else if (priceBrl) dayRev = (divines * Number(priceBrl)) / exchangeRate;
                  }
                  const dayCost = hasCost ? bots * costPerBotDaily : 0;
                  cumProfit += dayRev - dayCost;
                }

                point[simKeys[si]] = Number(cumProfit.toFixed(2));
              });

              chartData.push(point);
            }

            const chartConfig: ChartConfig = {};
            simulations.forEach((_sim, i) => {
              chartConfig[simKeys[i]] = { label: simKeys[i], color: colors[i] };
            });

            // Compute KPIs per sim
            const kpis = simulations.map((sim, si) => {
              const tots = si === 0 ? totalsA : totalsB;
              const activeDays = totalDays - (sim.startDayOffset ?? 0);
              const profitPerDay = activeDays > 0 ? tots.profit / activeDays : 0;

              // Find break-even day
              let breakEvenDay: number | null = null;
              for (let d = 0; d < chartData.length; d++) {
                const val = chartData[d][simKeys[si]] as number;
                if (val > 0 && breakEvenDay === null) { breakEvenDay = d + 1; break; }
              }

              return { profitPerDay, breakEvenDay, totalProfit: tots.profit };
            });

            return (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">Lucro Acumulado por Dia</p>
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        {simulations.map((_sim, i) => (
                          <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colors[i]} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={colors[i]} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} tickCount={8} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      {simulations.map((_sim, i) => (
                        <Area
                          key={i}
                          type="linear"
                          dataKey={simKeys[i]}
                          stroke={colors[i]}
                          strokeWidth={2}
                          fill={`url(#grad-${i})`}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </AreaChart>
                  </ChartContainer>
                </div>

                <div className="space-y-3 text-sm">
                  {simulations.map((sim, si) => (
                    <div key={sim.id} className="space-y-2">
                      <p className="font-medium" style={{ color: colors[si] }}>{simKeys[si]}</p>
                      <div className="grid gap-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lucro/dia</span>
                          <span className="font-mono tabular-nums">{fmt(kpis[si].profitPerDay)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Break-even</span>
                          <span className="font-mono tabular-nums">
                            {kpis[si].breakEvenDay ? `Dia ${kpis[si].breakEvenDay}` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total</span>
                          <span className={cn("font-mono tabular-nums font-medium", kpis[si].totalProfit >= 0 ? "text-green-500" : "text-destructive")}>
                            {fmt(kpis[si].totalProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Section C: Editable week defaults */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="font-semibold mb-3">Parametros por Semana</p>
          <p className="text-xs text-muted-foreground mb-4">Clique em um valor para editar. Os calculos atualizam em tempo real.</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Semana</TableHead>
                  {simulations.map((sim, si) => (
                    <TableHead key={sim.id} colSpan={3} className="text-center border-l border-border/50">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-foreground">{sim.name}</span>
                        {dirty.has(sim.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="Salvar alteracoes"
                            onClick={() => saveSimulation(si)}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  {simulations.map((sim) => (
                    <React.Fragment key={sim.id}>
                      <TableHead className="text-center border-l border-border/50 text-xs font-normal text-muted-foreground">Bots</TableHead>
                      <TableHead className="text-center text-xs font-normal text-muted-foreground">Div/hr</TableHead>
                      <TableHead className="text-center text-xs font-normal text-muted-foreground">Hrs/dia</TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allWeekNumbers.map((wn) => (
                  <TableRow key={wn}>
                    <TableCell className="text-sm font-medium">S{wn}</TableCell>
                    {simulations.map((sim, si) => {
                      const week = sim.weeks.find((w) => w.weekNumber === wn);
                      if (!week) return (
                        <React.Fragment key={sim.id}>
                          <TableCell className="text-center border-l border-border/50 text-muted-foreground">—</TableCell>
                          <TableCell className="text-center text-muted-foreground">—</TableCell>
                          <TableCell className="text-center text-muted-foreground">—</TableCell>
                        </React.Fragment>
                      );
                      return (
                        <React.Fragment key={sim.id}>
                          <TableCell className="text-center border-l border-border/50">
                            <EditableNum
                              value={week.defaultActiveBots}
                              type="int"
                              onChange={(v) => updateWeekDefault(si, wn, "defaultActiveBots", v)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <EditableNum
                              value={Number(week.defaultDivinePerHour)}
                              type="int"
                              onChange={(v) => updateWeekDefault(si, wn, "defaultDivinePerHour", v)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <EditableNum
                              value={Number(week.defaultHoursPerDay)}
                              type="int"
                              onChange={(v) => updateWeekDefault(si, wn, "defaultHoursPerDay", v)}
                            />
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section D: Week-by-week results */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="font-semibold mb-3">Resultados por Semana</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Semana</TableHead>
                  {simNames.map((name) => (
                    <TableHead key={name} colSpan={3} className="text-center border-l border-border/50 text-foreground">
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
                      <TableHead className="text-right border-l border-border/50 text-xs font-normal text-muted-foreground">Receita</TableHead>
                      <TableHead className="text-right text-xs font-normal text-muted-foreground">Custo</TableHead>
                      <TableHead className="text-right text-xs font-normal text-muted-foreground">Lucro</TableHead>
                    </React.Fragment>
                  ))}
                  {simulations.length >= 2 && <TableHead className="border-l border-border/50" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allWeekNumbers.map((wn) => {
                  const weekData = allWeekTotalsList.map((wts) => wts.find((w) => w.weekNumber === wn));
                  const anyLabel = weekData.find((w) => w?.label)?.label;

                  return (
                    <TableRow key={wn}>
                      <TableCell className="text-sm font-medium">
                        S{wn}
                        {anyLabel && <span className="ml-1 text-xs text-muted-foreground">({anyLabel})</span>}
                      </TableCell>
                      {weekData.map((w, si) => (
                        <React.Fragment key={si}>
                          <TableCell className="text-right font-mono tabular-nums text-sm border-l border-border/50">
                            {w ? fmt(w.revenue) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm">
                            {w ? fmt(w.cost) : "—"}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono tabular-nums text-sm font-medium",
                            w ? (w.profit >= 0 ? "text-green-500" : "text-destructive") : "text-muted-foreground"
                          )}>
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
                          ) : "—"}
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
      {/* Section: Unified daily breakdown */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="font-semibold mb-3">Breakdown Diario</p>
          <Accordion type="multiple" className="space-y-2">
            {allWeekNumbers.map((wn) => {
              // Gather week data for each simulation
              const weeksPerSim = simulations.map((sim) =>
                sim.weeks.find((w) => w.weekNumber === wn)
              );
              const maxDays = 7;

              return (
                <AccordionItem key={wn} value={`week-${wn}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-sm font-medium">Semana {wn}</span>
                      {weeksPerSim[0]?.label && (
                        <span className="text-xs text-muted-foreground">({weeksPerSim[0].label})</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Dia</TableHead>
                            {simNames.map((name) => (
                              <TableHead key={name} colSpan={4} className="text-center border-l border-border/50 text-xs">{name}</TableHead>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableHead />
                            {simulations.map((sim) => (
                              <React.Fragment key={sim.id}>
                                <TableHead className="text-right border-l border-border/50 text-xs font-normal text-muted-foreground">Preco</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Divines</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Receita</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Lucro</TableHead>
                              </React.Fragment>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: maxDays }, (_, di) => {
                            const dayNum = di + 1;
                            const globalIdx = (wn - 1) * 7 + di;

                            return (
                              <TableRow key={dayNum}>
                                <TableCell className="text-xs font-medium text-muted-foreground">D{dayNum}</TableCell>
                                {simulations.map((sim, si) => {
                                  const week = weeksPerSim[si];
                                  if (!week) return (
                                    <React.Fragment key={sim.id}>
                                      <TableCell className="text-right border-l border-border/50 text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                    </React.Fragment>
                                  );

                                  const day = week.days.find((d) => d.dayNumber === dayNum);
                                  if (!day) return (
                                    <React.Fragment key={sim.id}>
                                      <TableCell className="text-right border-l border-border/50 text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                      <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
                                    </React.Fragment>
                                  );

                                  const isLocked = globalIdx < (sim.startDayOffset ?? 0);
                                  const bots = resolveField(day, "activeBots", week) ?? 0;
                                  const dph = resolveField(day, "divinePerHour", week);
                                  const hours = resolveField(day, "hoursPerDay", week);
                                  const priceBrl = resolveField(day, "divinePriceBrl", week);
                                  const priceUsd = resolveField(day, "divinePriceUsd", week);
                                  const price = priceBrl ?? priceUsd;

                                  const divines = !isLocked && bots && dph && hours ? bots * Number(dph) * Number(hours) : 0;
                                  const revenue = divines * (price ?? 0);

                                  // Daily cost per bot
                                  const hasCost = sim.proxyCostPerBotMonthly != null && sim.expluginsKeyCostDaily != null && sim.dpbKeyCostDaily != null;
                                  const costPerBotDaily = hasCost
                                    ? Number(sim.expluginsKeyCostDaily) + Number(sim.dpbKeyCostDaily) + Number(sim.proxyCostPerBotMonthly) / 30
                                    : 0;
                                  const dayCost = bots * costPerBotDaily;
                                  const profit = revenue - dayCost;

                                  const muted = isLocked ? " opacity-40" : "";
                                  const curr = priceBrl != null ? "brl" as const : "usd" as const;

                                  return (
                                    <React.Fragment key={sim.id}>
                                      <TableCell className={`text-right border-l border-border/50 font-mono text-xs tabular-nums${muted}`}>
                                        {price != null ? formatMoney(price, curr) : "—"}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono text-xs tabular-nums${muted}`}>
                                        {divines > 0 ? divines.toFixed(0) : isLocked ? "—" : "—"}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono text-xs tabular-nums${muted}`}>
                                        {revenue > 0 ? formatMoney(revenue, curr) : isLocked ? "—" : "—"}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono text-xs tabular-nums${muted} ${!isLocked && revenue > 0 ? (profit >= 0 ? "text-green-500" : "text-destructive") : ""}`}>
                                        {!isLocked && revenue > 0 ? formatMoney(profit, curr) : "—"}
                                      </TableCell>
                                    </React.Fragment>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
