"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  RefreshCcw,
  Settings2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { EditableNum } from "@/components/ui/editable-num";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import {
  computeAnnualRows,
  defaultRows,
  type AnnualAssumptions,
  type MonthRow,
  type CostConfigLite,
} from "@/lib/annual-projection";
import { cn } from "@/lib/utils";

interface CostConfig extends CostConfigLite {
  id: string;
  name: string;
  isDefault: boolean;
}

const STORAGE_KEY = "poe-hub:annual-projection:v1";

interface StoredState {
  assumptions: AnnualAssumptions;
  costConfigId: string | null;
  rows: MonthRow[];
}

function initialAssumptions(): AnnualAssumptions {
  const now = new Date();
  return {
    bots: 20,
    divPerHour: 0.5,
    hoursPerDay: 22,
    priceUsd: 0.15,
    growthPct: 0,
    decayPct: 0,
    startMonth: now.getMonth(),
    startYear: now.getFullYear(),
  };
}

function loadStored(): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

function persist(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function AnnualProjectionPage() {
  const { formatMoney } = useCurrency();
  const [assumptions, setAssumptions] = useState<AnnualAssumptions>(initialAssumptions);
  const [costConfigId, setCostConfigId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [rows, setRows] = useState<MonthRow[]>(() =>
    defaultRows(new Date().getMonth(), new Date().getFullYear())
  );
  const [hydrated, setHydrated] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setAssumptions(stored.assumptions);
      setCostConfigId(stored.costConfigId);
      setRows(stored.rows);
    }
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    persist({ assumptions, costConfigId, rows });
  }, [assumptions, costConfigId, rows, hydrated]);

  // Load cost configs
  useEffect(() => {
    fetch("/api/cost-configs")
      .then((r) => r.json())
      .then((data) => {
        const items: CostConfig[] = Array.isArray(data) ? data : (data.data ?? []);
        setConfigs(items);
        if (!costConfigId) {
          const def = items.find((c) => c.isDefault) ?? items[0];
          if (def) setCostConfigId(def.id);
        }
      })
      .catch(() => setConfigs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep row count / labels in sync when startMonth or startYear change
  useEffect(() => {
    setRows((prev) => {
      const baseline = defaultRows(assumptions.startMonth, assumptions.startYear);
      // Preserve overrides by index
      return baseline.map((b, i) => ({
        ...b,
        bots: prev[i]?.bots ?? null,
        divPerHour: prev[i]?.divPerHour ?? null,
        hoursPerDay: prev[i]?.hoursPerDay ?? null,
        priceUsd: prev[i]?.priceUsd ?? null,
        revenueOverride: prev[i]?.revenueOverride ?? null,
        operationalCostOverride: prev[i]?.operationalCostOverride ?? null,
        days: prev[i]?.days ?? b.days,
      }));
    });
  }, [assumptions.startMonth, assumptions.startYear]);

  const costConfig = useMemo<CostConfigLite | null>(() => {
    const c = configs.find((x) => x.id === costConfigId);
    if (!c) return null;
    return {
      proxyCostPerBotMonthly: Number(c.proxyCostPerBotMonthly),
      levelingCostPerBot: Number(c.levelingCostPerBot),
      stashPackCostPerBot: Number(c.stashPackCostPerBot),
      expluginsKeyCostDaily: Number(c.expluginsKeyCostDaily),
      dpbKeyCostDaily: Number(c.dpbKeyCostDaily),
      customCosts: c.customCosts ?? null,
    };
  }, [configs, costConfigId]);

  const { rows: computed, totals } = useMemo(
    () => computeAnnualRows(rows, assumptions, costConfig),
    [rows, assumptions, costConfig]
  );

  function updateRow(index: number, patch: Partial<MonthRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function resetAll() {
    if (!confirm("Descartar todos os overrides e recalcular com as premissas?")) return;
    setRows(defaultRows(assumptions.startMonth, assumptions.startYear));
    toast.success("Projeção recalculada");
  }

  function clearStorage() {
    if (!confirm("Limpar tudo (premissas + tabela)?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setAssumptions(initialAssumptions());
    setRows(defaultRows(new Date().getMonth(), new Date().getFullYear()));
    toast.success("Projeção limpa");
  }

  const fmt = (v: number) => formatMoney(v, "usd");

  const chartData = computed.map((r) => ({
    label: r.label,
    Receita: Number(r.revenue.toFixed(2)),
    Custo: Number((r.operationalCost + r.oneTimeCost).toFixed(2)),
    Acumulado: Number(r.cumulativeProfit.toFixed(2)),
  }));

  const chartConfig: ChartConfig = {
    Receita: { label: "Receita", color: "hsl(142, 71%, 45%)" },
    Custo: { label: "Custo", color: "hsl(0, 70%, 55%)" },
    Acumulado: { label: "Lucro acum.", color: "hsl(220, 70%, 60%)" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Faturamento Anual</h1>
            <p className="text-muted-foreground text-sm">
              Projeção mensal editável célula a célula. Valores ficam salvos localmente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recalcular tudo
            </Button>
            <Button variant="outline" size="sm" onClick={clearStorage}>
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Area 1 — assumptions */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <button
            className="flex items-center gap-2 w-full text-left mb-3"
            onClick={() => setAssumptionsOpen(!assumptionsOpen)}
          >
            {assumptionsOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <p className="font-semibold">Premissas base</p>
          </button>
          {assumptionsOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field
                label="Bots iniciais"
                value={assumptions.bots}
                onChange={(v) => setAssumptions({ ...assumptions, bots: v })}
              />
              <Field
                label="Divines/hora"
                value={assumptions.divPerHour}
                step="0.01"
                onChange={(v) => setAssumptions({ ...assumptions, divPerHour: v })}
              />
              <Field
                label="Horas/dia"
                value={assumptions.hoursPerDay}
                step="0.1"
                onChange={(v) => setAssumptions({ ...assumptions, hoursPerDay: v })}
              />
              <Field
                label="Preço divine (USD)"
                value={assumptions.priceUsd}
                step="0.001"
                onChange={(v) => setAssumptions({ ...assumptions, priceUsd: v })}
              />
              <Field
                label="Crescimento mensal bots (%)"
                value={assumptions.growthPct * 100}
                step="0.1"
                onChange={(v) =>
                  setAssumptions({ ...assumptions, growthPct: v / 100 })
                }
              />
              <Field
                label="Queda mensal preço (%)"
                value={assumptions.decayPct * 100}
                step="0.1"
                onChange={(v) =>
                  setAssumptions({ ...assumptions, decayPct: v / 100 })
                }
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Início
                </Label>
                <div className="flex gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-1"
                    value={assumptions.startMonth}
                    onChange={(e) =>
                      setAssumptions({
                        ...assumptions,
                        startMonth: Number(e.target.value),
                      })
                    }
                  >
                    {[
                      "Jan",
                      "Fev",
                      "Mar",
                      "Abr",
                      "Mai",
                      "Jun",
                      "Jul",
                      "Ago",
                      "Set",
                      "Out",
                      "Nov",
                      "Dez",
                    ].map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    className="w-24 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={assumptions.startYear}
                    onChange={(e) =>
                      setAssumptions({
                        ...assumptions,
                        startYear: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Config de custos
                  </Label>
                  <Button variant="ghost" size="icon" className="h-5 w-5" asChild>
                    <Link href="/settings/costs" title="Gerenciar">
                      <Settings2 className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={costConfigId ?? ""}
                  onChange={(e) => setCostConfigId(e.target.value || null)}
                >
                  <option value="">Sem custos</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isDefault ? "(padrão)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Receita anual" value={fmt(totals.revenue)} />
        <SummaryCard
          label="Custo total"
          value={fmt(totals.totalCost)}
          hint={`Op.: ${fmt(totals.operationalCost)} · Único: ${fmt(totals.oneTimeCost)}`}
        />
        <SummaryCard
          label="Lucro anual"
          value={fmt(totals.profit)}
          tone={totals.profit >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          label="ROI"
          value={`${totals.roi >= 0 ? "+" : ""}${totals.roi.toFixed(1)}%`}
          tone={totals.roi >= 0 ? "good" : "bad"}
        />
      </div>

      {/* Area 2 — editable monthly table */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">Projeção mensal</p>
              <p className="text-xs text-muted-foreground">
                Clique em qualquer valor para editar. Valores manuais aparecem em{" "}
                <span className="text-amber-500">âmbar</span> — use o ✎ para resetar.
                Passe o mouse sobre custo/único para ver a composição.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Mês</TableHead>
                  <TableHead className="text-right">Bots</TableHead>
                  <TableHead className="text-right">Div/hr</TableHead>
                  <TableHead className="text-right">Hrs/dia</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Preço USD</TableHead>
                  <TableHead className="text-right">Divines</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo op.</TableHead>
                  <TableHead className="text-right">Custo único</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.map((c, i) => (
                  <TableRow key={c.monthIndex}>
                    <TableCell className="font-medium text-sm">{c.label}</TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.bots}
                        decimals={1}
                        overridden={c.botsOverridden}
                        onChange={(v) => updateRow(i, { bots: v })}
                        onReset={() => updateRow(i, { bots: null })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.divPerHour}
                        decimals={3}
                        overridden={c.divPerHourOverridden}
                        onChange={(v) => updateRow(i, { divPerHour: v })}
                        onReset={() => updateRow(i, { divPerHour: null })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.hoursPerDay}
                        decimals={1}
                        overridden={c.hoursPerDayOverridden}
                        onChange={(v) => updateRow(i, { hoursPerDay: v })}
                        onReset={() => updateRow(i, { hoursPerDay: null })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.days}
                        type="int"
                        onChange={(v) => updateRow(i, { days: Math.max(1, Math.min(31, v)) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.priceUsd}
                        decimals={4}
                        overridden={c.priceOverridden}
                        onChange={(v) => updateRow(i, { priceUsd: v })}
                        onReset={() => updateRow(i, { priceUsd: null })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {c.divines.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableNum
                        value={c.revenue}
                        decimals={2}
                        overridden={c.revenueOverridden}
                        onChange={(v) => updateRow(i, { revenueOverride: v })}
                        onReset={() => updateRow(i, { revenueOverride: null })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <EditableNum
                                value={c.operationalCost}
                                decimals={2}
                                overridden={c.operationalCostOverridden}
                                onChange={(v) =>
                                  updateRow(i, { operationalCostOverride: v })
                                }
                                onReset={() =>
                                  updateRow(i, { operationalCostOverride: null })
                                }
                              />
                            </span>
                          </TooltipTrigger>
                          {c.operationalBreakdown.length > 0 && (
                            <TooltipContent>
                              <ul className="text-xs space-y-0.5 font-mono">
                                {c.operationalBreakdown.map((b, idx) => (
                                  <li key={idx} className="flex justify-between gap-4">
                                    <span>{b.label}</span>
                                    <span>{fmt(b.amount)}</span>
                                  </li>
                                ))}
                                <li className="flex justify-between gap-4 border-t border-border pt-1 mt-1 font-medium">
                                  <span>Total</span>
                                  <span>
                                    {fmt(
                                      c.operationalBreakdown.reduce(
                                        (s, b) => s + b.amount,
                                        0
                                      )
                                    )}
                                  </span>
                                </li>
                              </ul>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.oneTimeCost > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-sm cursor-help underline decoration-dotted underline-offset-4">
                                {fmt(c.oneTimeCost)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <ul className="text-xs space-y-0.5 font-mono">
                                {c.oneTimeBreakdown.map((b, idx) => (
                                  <li key={idx} className="flex justify-between gap-4">
                                    <span>{b.label}</span>
                                    <span>{fmt(b.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm tabular-nums font-medium",
                        c.profit >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {c.profit >= 0 ? "+" : ""}
                      {fmt(c.profit)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm tabular-nums",
                        c.cumulativeProfit >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {fmt(c.cumulativeProfit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Area 3 — chart */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="font-semibold mb-3">Evolução mensal</p>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="g-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="g-acc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220, 70%, 60%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(220, 70%, 60%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area type="monotone" dataKey="Receita" stroke="hsl(142, 71%, 45%)" strokeWidth={2} fill="url(#g-rev)" dot={false} />
              <Area type="monotone" dataKey="Custo" stroke="hsl(0, 70%, 55%)" strokeWidth={2} fill="url(#g-cost)" dot={false} />
              <Area type="monotone" dataKey="Acumulado" stroke="hsl(220, 70%, 60%)" strokeWidth={2} fill="url(#g-acc)" dot={false} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-xl font-mono font-semibold tabular-nums mt-1",
            tone === "good" && "text-green-500",
            tone === "bad" && "text-destructive"
          )}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
