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

// --- Types ---

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  vpsCostMonthly: number;
  dpbLicenseCostMonthly: number;
  otherFixedCostsMonthly: number;
  otherVariableCostPerBot: number;
}

interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  notes: string | null;
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

function fmtNum(val: number, decimals = 2): string {
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(val: number, prefix: string): string {
  return `${prefix}${fmtNum(val)}`;
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
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);

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

  // --- Cost config ---
  const costConfig =
    simulation?.costLinks?.[0]?.costConfig ?? null;

  function handleCostConfigChange(config: CostConfig | null) {
    if (!simulation) return;
    if (config) {
      setSimulation({
        ...simulation,
        costLinks: [
          {
            costConfigId: config.id,
            costConfig: config,
          },
        ],
      });
    } else {
      setSimulation({ ...simulation, costLinks: [] });
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

    for (const week of simulation.weeks) {
      let weekRevenueUsd = 0;
      let weekRevenueBrl = 0;

      for (const day of week.days) {
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

      // Weekly cost
      if (costConfig) {
        const fixedMonthly =
          costConfig.vpsCostMonthly +
          costConfig.dpbLicenseCostMonthly +
          costConfig.otherFixedCostsMonthly;
        const fixedWeekly = fixedMonthly / 4;

        const maxBots = week.days.reduce((max, d) => {
          const b = resolveField(d, "activeBots", week);
          return Math.max(max, b ?? 0);
        }, 0);

        const variablePerBot =
          costConfig.proxyCostPerBotMonthly + costConfig.otherVariableCostPerBot;
        const variableWeekly = maxBots * variablePerBot * (7 / 30);

        totalCost += fixedWeekly + variableWeekly;
      }
    }

    const profit = totalRevenueUsd - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return { revenueUsd: totalRevenueUsd, revenueBrl: totalRevenueBrl, cost: totalCost, profit, roi };
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
            <span>Liga: {simulation.league}</span>
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
            <p className="text-xs text-muted-foreground">Receita Total (USD)</p>
            <p className="text-xl font-bold font-mono">
              {fmtCurrency(totals.revenueUsd, "$")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Receita Total (BRL)</p>
            <p className="text-xl font-bold font-mono">
              {fmtCurrency(totals.revenueBrl, "R$")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Custo Total</p>
            <p className="text-xl font-bold font-mono">
              {fmtCurrency(totals.cost, "$")}
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
              {fmtCurrency(totals.profit, "$")}
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
                    Receita: {fmtCurrency(weekRevenue, "$")}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <WeekEditor
                  simulationId={simulationId}
                  week={week}
                  costConfig={costConfig}
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
