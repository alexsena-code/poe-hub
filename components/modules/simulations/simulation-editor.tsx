"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Check, X } from "lucide-react";
import { WeekEditor, type SimulationWeek, type SimulationDay } from "./week-editor";
import { CostConfigSelector } from "./cost-config-selector";
import { ImportPricesDialog } from "./import-prices-dialog";
import { useCurrency } from "@/hooks/use-currency";
import { useLeagues } from "@/hooks/use-leagues";

// --- Types ---

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
}

interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  startDayOffset: number;
  notes: string | null;
  // Cost snapshot
  costConfigName: string | null;
  proxyCostPerBotMonthly: number | null;
  levelingCostPerBot: number | null;
  stashPackCostPerBot: number | null;
  expluginsKeyCostDaily: number | null;
  dpbKeyCostDaily: number | null;
  createdAt: string;
  updatedAt: string;
  weeks: SimulationWeek[];
  costLinks: Array<{ costConfigId: string; costConfig: CostConfig }>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
};

function fmtUsd(val: number): string {
  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBrl(val: number): string {
  return `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(val: number, decimals = 2): string {
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// --- Resolve field helper (same logic as week-editor) ---
function resolveField(
  day: SimulationDay,
  field: keyof Pick<SimulationDay, "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl">,
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

// --- Component ---

interface SimulationEditorProps {
  simulationId: string;
}

export function SimulationEditor({ simulationId }: SimulationEditorProps) {
  const router = useRouter();
  const { formatMoney, convert, exchangeRate } = useCurrency();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingLeague, setEditingLeague] = useState(false);
  const { leagues } = useLeagues();

  const fetchSimulation = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulations/${simulationId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSimulation(data);
    } catch {
      toast.error("Erro ao carregar simulacao");
    } finally {
      setLoading(false);
    }
  }, [simulationId]);

  useEffect(() => {
    fetchSimulation();
  }, [fetchSimulation]);

  // --- Name editing ---
  function startEditName() {
    if (!simulation) return;
    setNameValue(simulation.name);
    setEditingName(true);
  }

  async function saveName() {
    if (!simulation || !nameValue.trim()) {
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/simulations/${simulationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (!res.ok) throw new Error();
      setSimulation((s) => (s ? { ...s, name: nameValue.trim() } : s));
      setEditingName(false);
      toast.success("Nome atualizado");
    } catch {
      toast.error("Erro ao atualizar nome");
    }
  }

  // --- Status change ---
  async function changeStatus(status: string) {
    if (!simulation) return;
    try {
      const res = await fetch(`/api/simulations/${simulationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setSimulation((s) =>
        s ? { ...s, status: status as Simulation["status"] } : s
      );
      setEditingStatus(false);
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  // --- Cost config (read from simulation snapshot) ---
  const costConfig: CostConfig | null =
    simulation?.proxyCostPerBotMonthly != null
      ? {
          id: simulation.costLinks?.[0]?.costConfigId ?? "",
          name: simulation.costConfigName ?? "",
          isDefault: false,
          proxyCostPerBotMonthly: Number(simulation.proxyCostPerBotMonthly),
          levelingCostPerBot: Number(simulation.levelingCostPerBot),
          stashPackCostPerBot: Number(simulation.stashPackCostPerBot),
          expluginsKeyCostDaily: Number(simulation.expluginsKeyCostDaily),
          dpbKeyCostDaily: Number(simulation.dpbKeyCostDaily),
        }
      : null;

  function handleCostConfigChange(config: CostConfig | null) {
    if (!simulation) return;
    if (config) {
      setSimulation({
        ...simulation,
        costConfigName: config.name,
        proxyCostPerBotMonthly: config.proxyCostPerBotMonthly,
        levelingCostPerBot: config.levelingCostPerBot,
        stashPackCostPerBot: config.stashPackCostPerBot,
        expluginsKeyCostDaily: config.expluginsKeyCostDaily,
        dpbKeyCostDaily: config.dpbKeyCostDaily,
        costLinks: [{ costConfigId: config.id, costConfig: config }],
      });
    } else {
      setSimulation({
        ...simulation,
        costConfigName: null,
        proxyCostPerBotMonthly: null,
        levelingCostPerBot: null,
        stashPackCostPerBot: null,
        expluginsKeyCostDaily: null,
        dpbKeyCostDaily: null,
        costLinks: [],
      });
    }
  }

  // --- Week update handler ---
  function handleWeekUpdated(updatedWeek: SimulationWeek) {
    if (!simulation) return;
    const newWeeks = simulation.weeks.map((w) =>
      w.weekNumber === updatedWeek.weekNumber ? updatedWeek : w
    );
    setSimulation({ ...simulation, weeks: newWeeks });
  }

  // --- Calculate totals ---
  function calcTotals() {
    if (!simulation) return { revenueUsd: 0, revenueBrl: 0, cost: 0, profit: 0, roi: 0 };

    let totalRevenueUsd = 0;
    let totalRevenueBrl = 0;
    let totalCost = 0;

    const offset = simulation.startDayOffset ?? 0;

    for (const week of simulation.weeks) {
      let weekRevenueUsd = 0;
      let weekRevenueBrl = 0;

      for (const day of week.days) {
        // Skip locked days (before startDayOffset)
        const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
        if (globalDayIndex < offset) continue;

        const bots = resolveField(day, "activeBots", week);
        const dph = resolveField(day, "divinePerHour", week);
        const hours = resolveField(day, "hoursPerDay", week);
        const priceUsd = resolveField(day, "divinePriceUsd", week);
        const priceBrl = resolveField(day, "divinePriceBrl", week);

        if (bots !== null && dph !== null && hours !== null) {
          const divines = bots * dph * hours;
          if (priceUsd !== null) weekRevenueUsd += divines * priceUsd;
          if (priceBrl !== null) weekRevenueBrl += divines * priceBrl;
        }
      }

      totalRevenueUsd += weekRevenueUsd;
      totalRevenueBrl += weekRevenueBrl;

      // Weekly cost — only active days, all costs are per-bot
      if (costConfig) {
        const expluginsPerBotDaily = Number(costConfig.expluginsKeyCostDaily);
        const dpbPerBotDaily = Number(costConfig.dpbKeyCostDaily);
        const proxyPerBotDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
        const costPerBotDaily = expluginsPerBotDaily + dpbPerBotDaily + proxyPerBotDaily;

        for (const day of week.days) {
          const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
          if (globalDayIndex < offset) continue;

          const bots = resolveField(day, "activeBots", week) ?? 0;
          totalCost += bots * costPerBotDaily;
        }
      }
    }

    // If no USD revenue, convert BRL→USD directly (divide by rate)
    const effectiveRevenueUsd = totalRevenueUsd > 0
      ? totalRevenueUsd
      : totalRevenueBrl / exchangeRate;

    // One-time costs based on max bots across all weeks
    let oneTimeCost = 0;
    if (costConfig) {
      const maxBots = Math.max(...simulation.weeks.map((w) => Number(w.defaultActiveBots)), 0);
      oneTimeCost = maxBots * (Number(costConfig.levelingCostPerBot) + Number(costConfig.stashPackCostPerBot));
    }
    const totalCostWithOneTime = totalCost + oneTimeCost;
    const profit = effectiveRevenueUsd - totalCostWithOneTime;
    const roi = totalCostWithOneTime > 0 ? (profit / totalCostWithOneTime) * 100 : 0;

    return {
      revenueUsd: effectiveRevenueUsd,
      revenueBrl: totalRevenueBrl,
      operationalCost: totalCost,
      oneTimeCost,
      totalCost: totalCostWithOneTime,
      profit,
      roi,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando simulacao...
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Simulacao nao encontrada.</p>
        <Button variant="outline" onClick={() => router.push("/simulations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const totals = calcTotals();
  const sortedWeeks = [...simulation.weeks].sort(
    (a, b) => a.weekNumber - b.weekNumber
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2"
            onClick={() => router.push("/simulations")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  className="text-2xl font-bold h-10 w-96"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  autoFocus
                />
                <Button variant="ghost" size="icon" onClick={saveName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingName(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-3xl font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                onClick={startEditName}
              >
                {simulation.name}
                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {editingLeague ? (
              <Select
                defaultValue={simulation.league}
                onValueChange={async (val) => {
                  setEditingLeague(false);
                  if (val === simulation.league) return;
                  await fetch(`/api/simulations/${simulationId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ league: val }),
                  });
                  setSimulation({ ...simulation, league: val });
                  toast.success("Liga atualizada");
                }}
              >
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      {l.name} {l.isCurrent ? "(atual)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setEditingLeague(true)}
              >
                Liga: {simulation.league}
              </span>
            )}
            <Separator orientation="vertical" className="h-4" />
            <span>{simulation.durationWeeks} semanas</span>
            <Separator orientation="vertical" className="h-4" />

            {editingStatus ? (
              <Select
                value={simulation.status}
                onValueChange={(val) => changeStatus(val)}
              >
                <SelectTrigger className="w-36 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant={STATUS_VARIANTS[simulation.status] ?? "outline"}
                className="cursor-pointer"
                onClick={() => setEditingStatus(true)}
              >
                {STATUS_LABELS[simulation.status] ?? simulation.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <ImportPricesDialog
            simulationId={simulationId}
            onImported={fetchSimulation}
          />
          <CostConfigSelector
            simulationId={simulationId}
            selectedConfigId={costConfig?.id ?? null}
            onConfigChange={(c) =>
              handleCostConfigChange(c as CostConfig | null)
            }
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Receita</p>
            <p className="text-xl font-bold font-mono">
              {formatMoney(totals.revenueUsd, "usd")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Custo Operacional</p>
            <p className="text-xl font-bold font-mono">
              {formatMoney(totals.operationalCost ?? 0, "usd")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Custo Unico (Lv+Stash)</p>
            <p className="text-xl font-bold font-mono">
              {formatMoney(totals.oneTimeCost ?? 0, "usd")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Lucro Liquido</p>
            <p
              className={`text-xl font-bold font-mono ${
                totals.profit >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {formatMoney(totals.profit, "usd")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p
              className={`text-xl font-bold font-mono ${
                totals.roi >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {fmtNum(totals.roi, 1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weeks accordion */}
      <Accordion
        type="multiple"
        defaultValue={sortedWeeks.map((w) => `week-${w.weekNumber}`)}
        className="space-y-2"
      >
        {sortedWeeks.map((week) => {
          // Calculate week revenue for the trigger label
          let weekRevenue = 0;
          for (const day of week.days) {
            const bots = resolveField(day, "activeBots", week);
            const dph = resolveField(day, "divinePerHour", week);
            const hours = resolveField(day, "hoursPerDay", week);
            const price = resolveField(day, "divinePriceUsd", week);
            if (bots !== null && dph !== null && hours !== null && price !== null) {
              weekRevenue += bots * dph * hours * price;
            }
          }

          return (
            <AccordionItem
              key={week.weekNumber}
              value={`week-${week.weekNumber}`}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <span className="text-base font-semibold">
                    Semana {week.weekNumber}
                  </span>
                  {week.label && (
                    <span className="text-sm text-muted-foreground">
                      ({week.label})
                    </span>
                  )}
                  <Badge variant="outline" className="font-mono text-xs">
                    {week.defaultActiveBots} bots
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">
                    Receita: {formatMoney(weekRevenue, "usd")}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <WeekEditor
                  simulationId={simulationId}
                  week={week}
                  costConfig={costConfig}
                  startDayOffset={simulation?.startDayOffset ?? 0}
                  onWeekUpdated={handleWeekUpdated}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
