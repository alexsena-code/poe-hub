"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import { EditableNum } from "@/components/ui/editable-num";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import {
  computeAnnualRollup,
  type SimulationSnapshot,
} from "@/lib/annual-plan-calculator";
import type { CustomCostEntry } from "@/lib/simulation-calculator";

interface PlanResponse {
  id: string;
  name: string;
  year: number;
  annualCustomCosts: CustomCostEntry[] | null;
  notes: string | null;
  simulationLinks: {
    position: number;
    simulationId: string;
    simulation: SimulationSnapshot;
  }[];
}

interface SimulationListItem {
  id: string;
  name: string;
  league: string;
  kind: "operational" | "forecast";
  durationWeeks: number;
}

export default function AnnualPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { formatMoney, exchangeRate } = useCurrency();

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [allSims, setAllSims] = useState<SimulationListItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAllKinds, setShowAllKinds] = useState(false);

  async function fetchPlan() {
    try {
      const res = await fetch(`/api/annual-plans/${id}`);
      if (!res.ok) throw new Error();
      const data: PlanResponse = await res.json();
      setPlan(data);
    } catch {
      toast.error("Erro ao carregar plano");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSims() {
    try {
      const res = await fetch(`/api/simulations?limit=100${showAllKinds ? "" : "&kind=forecast"}`);
      const data = await res.json();
      setAllSims(data.data ?? []);
    } catch {
      setAllSims([]);
    }
  }

  useEffect(() => {
    fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchSims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllKinds]);

  function updateField<K extends keyof PlanResponse>(key: K, value: PlanResponse[K]) {
    if (!plan) return;
    setPlan({ ...plan, [key]: value });
    setDirty(true);
  }

  function addFixedCost() {
    if (!plan) return;
    const newItem: CustomCostEntry = {
      id: crypto.randomUUID(),
      name: "Novo custo fixo",
      amount: 0,
      cadence: "monthly",
      perBot: false,
    };
    updateField("annualCustomCosts", [...(plan.annualCustomCosts ?? []), newItem]);
  }

  function updateFixedCost(costId: string, patch: Partial<CustomCostEntry>) {
    if (!plan) return;
    updateField(
      "annualCustomCosts",
      (plan.annualCustomCosts ?? []).map((c) => (c.id === costId ? { ...c, ...patch } : c))
    );
  }

  function removeFixedCost(costId: string) {
    if (!plan) return;
    updateField(
      "annualCustomCosts",
      (plan.annualCustomCosts ?? []).filter((c) => c.id !== costId)
    );
  }

  function linkSimulation(simId: string) {
    if (!plan) return;
    if (plan.simulationLinks.some((l) => l.simulationId === simId)) return;
    const sim = allSims.find((s) => s.id === simId);
    if (!sim) return;

    // Optimistic: add placeholder, re-fetch after save to get full snapshot
    setPlan({
      ...plan,
      simulationLinks: [
        ...plan.simulationLinks,
        {
          position: plan.simulationLinks.length,
          simulationId: simId,
          // partial snapshot — full data will come on next fetch
          simulation: {
            id: sim.id,
            name: sim.name,
            league: sim.league,
            kind: sim.kind,
            durationWeeks: sim.durationWeeks,
            startDayOffset: 0,
            proxyCostPerBotMonthly: null,
            levelingCostPerBot: null,
            stashPackCostPerBot: null,
            expluginsKeyCostDaily: null,
            dpbKeyCostDaily: null,
            customCosts: null,
            weeks: [],
          },
        },
      ],
    });
    setDirty(true);
  }

  function unlinkSimulation(simId: string) {
    if (!plan) return;
    setPlan({
      ...plan,
      simulationLinks: plan.simulationLinks.filter((l) => l.simulationId !== simId),
    });
    setDirty(true);
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/annual-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.name,
          year: plan.year,
          notes: plan.notes,
          annualCustomCosts: plan.annualCustomCosts ?? [],
          simulationIds: plan.simulationLinks.map((l) => l.simulationId),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Plano salvo");
      setDirty(false);
      // Re-fetch to get fresh simulation snapshots
      fetchPlan();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const rollup = useMemo(() => {
    if (!plan) return null;
    const sims = plan.simulationLinks.map((l) => l.simulation);
    return computeAnnualRollup(sims, plan.annualCustomCosts, exchangeRate);
  }, [plan, exchangeRate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/farm/simulations/annual">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-destructive">Plano não encontrado.</p>
      </div>
    );
  }

  const fmt = (v: number) => formatMoney(v, "usd");
  const linkedIds = new Set(plan.simulationLinks.map((l) => l.simulationId));
  const pickerItems = allSims.filter((s) => !linkedIds.has(s.id));

  const chartConfig: ChartConfig = {
    Receita: { label: "Receita", color: "hsl(142, 71%, 45%)" },
    Custo: { label: "Custo", color: "hsl(0, 70%, 55%)" },
    Lucro: { label: "Lucro", color: "hsl(220, 70%, 60%)" },
  };

  const chartData = rollup?.leagues.map((l) => ({
    label: l.name,
    Receita: Number(l.revenue.toFixed(2)),
    Custo: Number(l.totalCost.toFixed(2)),
    Lucro: Number(l.profit.toFixed(2)),
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/farm/simulations/annual">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Input
                className="text-2xl font-bold h-auto border-0 bg-transparent px-0 focus-visible:ring-0"
                value={plan.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              <Input
                type="number"
                className="w-24 text-lg font-mono"
                value={plan.year}
                onChange={(e) => updateField("year", Number(e.target.value))}
              />
            </div>
            <Input
              placeholder="Notas (opcional)"
              className="text-sm text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0"
              value={plan.notes ?? ""}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </div>
          <Button onClick={save} disabled={!dirty || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {rollup && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Receita anual" value={fmt(rollup.leagueRevenue)} />
          <SummaryCard
            label="Custo das ligas"
            value={fmt(rollup.leagueOperationalCost + rollup.leagueOneTimeCost)}
            hint={`Op.: ${fmt(rollup.leagueOperationalCost)} · Único: ${fmt(rollup.leagueOneTimeCost)}`}
          />
          <SummaryCard label="Custo fixo anual" value={fmt(rollup.annualFixedCost)} />
          <SummaryCard
            label="Lucro anual"
            value={fmt(rollup.profit)}
            tone={rollup.profit >= 0 ? "good" : "bad"}
          />
          <SummaryCard
            label="ROI"
            value={`${rollup.roi >= 0 ? "+" : ""}${rollup.roi.toFixed(1)}%`}
            tone={rollup.roi >= 0 ? "good" : "bad"}
          />
        </div>
      )}

      {/* Leagues */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">Ligas do ano</p>
              <p className="text-xs text-muted-foreground">
                Cada liga é uma simulação. Cada liga tem seus próprios custos (proxy, keys, leveling, stash, etc.).
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar liga
            </Button>
          </div>

          {rollup && rollup.leagues.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Nenhuma liga adicionada. Clique em "Adicionar liga" para começar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Simulação</TableHead>
                    <TableHead>Liga</TableHead>
                    <TableHead className="text-center">Kind</TableHead>
                    <TableHead className="text-center">Semanas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Custo op.</TableHead>
                    <TableHead className="text-right">Custo único</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rollup?.leagues.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Link
                          href={`/farm/simulations/${l.id}`}
                          className="font-medium hover:underline"
                        >
                          {l.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.league}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={l.kind === "forecast" ? "outline" : "secondary"} className="text-xs">
                          {l.kind === "forecast" ? "Forecast" : "Oper."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {l.durationWeeks}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">
                        {fmt(l.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">
                        {fmt(l.operationalCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">
                        {fmt(l.oneTimeCost)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums text-sm font-medium",
                          l.profit >= 0 ? "text-green-500" : "text-destructive"
                        )}
                      >
                        {fmt(l.profit)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs",
                          l.roi >= 0 ? "text-green-500" : "text-destructive"
                        )}
                      >
                        {l.roi.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => unlinkSimulation(l.id)}
                          title="Remover do plano"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual fixed costs */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">Custos fixos anuais</p>
              <p className="text-xs text-muted-foreground">
                Custos que rodam o ano todo independente de liga (VPS, eletricidade). Diário × 365, mensal × 12.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addFixedCost}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar custo
            </Button>
          </div>

          {(plan.annualCustomCosts ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum custo fixo anual.
            </p>
          ) : (
            <div className="space-y-2">
              {(plan.annualCustomCosts ?? []).map((cc) => {
                const annual =
                  cc.cadence === "daily"
                    ? cc.amount * 365
                    : cc.cadence === "monthly"
                      ? cc.amount * 12
                      : cc.amount;
                return (
                  <div
                    key={cc.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 items-center p-2 rounded-md border bg-muted/30"
                  >
                    <Input
                      placeholder="Nome"
                      value={cc.name}
                      onChange={(e) => updateFixedCost(cc.id, { name: e.target.value })}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">$</span>
                      <EditableNum
                        value={cc.amount}
                        decimals={2}
                        onChange={(v) => updateFixedCost(cc.id, { amount: v })}
                      />
                    </div>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={cc.cadence}
                      onChange={(e) =>
                        updateFixedCost(cc.id, {
                          cadence: e.target.value as CustomCostEntry["cadence"],
                        })
                      }
                    >
                      <option value="daily">Diário</option>
                      <option value="monthly">Mensal</option>
                      <option value="one_time">Único</option>
                    </select>
                    <div className="text-right text-sm">
                      <span className="text-muted-foreground text-xs">anual: </span>
                      <span className="font-mono font-medium">{fmt(annual)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeFixedCost(cc.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      {rollup && rollup.leagues.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="font-semibold mb-3">Comparativo por liga</p>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="Receita" fill="hsl(142, 71%, 45%)" />
                <Bar dataKey="Custo" fill="hsl(0, 70%, 55%)" />
                <Bar dataKey="Lucro" fill="hsl(220, 70%, 60%)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar liga ao plano</DialogTitle>
            <DialogDescription>
              Selecione simulações para incluir neste plano. Cada simulação = 1 liga do ano.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAllKinds}
                onChange={(e) => setShowAllKinds(e.target.checked)}
              />
              Mostrar também simulações operacionais
            </label>
            <Button variant="outline" size="sm" asChild>
              <Link href="/farm/simulations?kind=forecast">Nova simulação forecast</Link>
            </Button>
          </div>
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {pickerItems.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">
                Nenhuma simulação disponível. {showAllKinds ? "" : "Tente marcar 'Mostrar também operacionais'."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Liga</TableHead>
                    <TableHead className="text-center">Kind</TableHead>
                    <TableHead className="text-center">Sem.</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickerItems.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.league}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.kind === "forecast" ? "outline" : "secondary"} className="text-xs">
                          {s.kind === "forecast" ? "Forecast" : "Oper."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {s.durationWeeks}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            linkSimulation(s.id);
                            setPickerOpen(false);
                          }}
                        >
                          Adicionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
