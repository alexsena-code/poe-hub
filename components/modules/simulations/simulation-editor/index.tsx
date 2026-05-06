"use client";

// Orchestrator for the simulation detail editor.
// Owns fetch/state; delegates all rendering to focused sub-components.
// Consumed by app/(auth)/farm/simulations/[id]/page.tsx.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLeagues } from "@/hooks/use-leagues";
import type { SimulationWeek } from "../week-editor";
import { calcTotals, buildWeekData } from "./utils";
import { type CostConfig, type Simulation } from "./types";
import { SimulationHeader } from "./simulation-header";
import { SimulationSummaryCards } from "./simulation-summary-cards";
import { SimulationCostBreakdown } from "./simulation-cost-breakdown";
import { SimulationRevenueChart } from "./simulation-revenue-chart";
import { SimulationWeeksAccordion } from "./simulation-weeks-accordion";
import { ScenarioTester } from "./scenario-tester";
import { CohortBreakdown } from "./cohort-breakdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SimulationEditorProps {
  simulationId: string;
}

export function SimulationEditor({ simulationId }: SimulationEditorProps) {
  const router = useRouter();
  const { formatMoney, exchangeRate } = useCurrency();
  const { leagues } = useLeagues();

  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingLeague, setEditingLeague] = useState(false);
  const [editingKind, setEditingKind] = useState(false);

  const fetchSimulation = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulations/${simulationId}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
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
      if (!res.ok) throw new Error(`status ${res.status}`);
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
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSimulation((s) =>
        s ? { ...s, status: status as Simulation["status"] } : s
      );
      setEditingStatus(false);
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  // --- Kind change ---
  async function changeKind(kind: string) {
    if (!simulation) return;
    try {
      const res = await fetch(`/api/simulations/${simulationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSimulation((s) =>
        s ? { ...s, kind: kind as Simulation["kind"] } : s
      );
      setEditingKind(false);
      toast.success("Tipo de operação atualizado");
    } catch {
      toast.error("Erro ao atualizar tipo de operação");
    }
  }

  // --- Explugins discount change ---
  // Optimistic + immediate save. The patch shape mirrors the API contract:
  // null startDay disables the discount; null percent falls back to 50.
  async function changeDiscount(patch: {
    expluginsDiscountStartDay?: number | null;
    expluginsDiscountPercent?: number | null;
  }) {
    if (!simulation) return;
    setSimulation({ ...simulation, ...patch });
    try {
      const res = await fetch(`/api/simulations/${simulationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      toast.error("Erro ao salvar desconto Explugins");
      fetchSimulation();
    }
  }

  // --- League change ---
  async function changeLeague(val: string) {
    if (!simulation) return;
    setEditingLeague(false);
    if (val === simulation.league) return;
    await fetch(`/api/simulations/${simulationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ league: val }),
    });
    setSimulation({ ...simulation, league: val });
    toast.success("Liga atualizada");
  }

  // --- Cost config (resolved from simulation snapshot) ---
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

  function handleWeekUpdated(updatedWeek: SimulationWeek) {
    if (!simulation) return;
    const newWeeks = simulation.weeks.map((w) =>
      w.weekNumber === updatedWeek.weekNumber ? updatedWeek : w
    );
    setSimulation({ ...simulation, weeks: newWeeks });
  }

  // --- Loading / not-found guards ---
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
        <Button variant="outline" onClick={() => router.push("/farm/simulations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const totals = calcTotals(simulation, costConfig, exchangeRate);
  const sortedWeeks = [...simulation.weeks].sort(
    (a, b) => a.weekNumber - b.weekNumber
  );
  const weekData = costConfig
    ? buildWeekData(simulation, costConfig, exchangeRate)
    : null;

  return (
    <div className="space-y-6">
      <SimulationHeader
        simulation={simulation}
        simulationId={simulationId}
        editingName={editingName}
        nameValue={nameValue}
        editingStatus={editingStatus}
        editingLeague={editingLeague}
        editingKind={editingKind}
        costConfig={costConfig}
        leagues={leagues}
        onBackClick={() => router.push("/farm/simulations")}
        onStartEditName={startEditName}
        onNameChange={setNameValue}
        onSaveName={saveName}
        onCancelEditName={() => setEditingName(false)}
        onNameKeyDown={(e) => {
          if (e.key === "Enter") saveName();
          if (e.key === "Escape") setEditingName(false);
        }}
        onStatusChange={changeStatus}
        onEditStatusOpen={() => setEditingStatus(true)}
        onKindChange={changeKind}
        onEditKindOpen={() => setEditingKind(true)}
        onLeagueChange={changeLeague}
        onEditLeagueOpen={() => setEditingLeague(true)}
        onImported={fetchSimulation}
        onCostConfigChange={handleCostConfigChange}
      />

      <SimulationSummaryCards totals={totals} formatMoney={formatMoney} />

      {costConfig && weekData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SimulationCostBreakdown
            costConfig={costConfig}
            simulation={simulation}
            totals={totals}
            weekData={weekData}
            formatMoney={formatMoney}
            onDiscountChange={changeDiscount}
          />
          <SimulationRevenueChart weekData={weekData} formatMoney={formatMoney} />
        </div>
      )}

      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="scenarios" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="text-base font-semibold">
              Testador de cenários
            </span>
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              comparar variações de progressão
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ScenarioTester
              simulation={simulation}
              simulationId={simulationId}
              costConfig={costConfig}
              onApplied={fetchSimulation}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cohorts" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="text-base font-semibold">
              Cohorts de bots
            </span>
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              economia por dia de criação
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CohortBreakdown
              simulation={simulation}
              costConfig={costConfig}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <SimulationWeeksAccordion
        simulationId={simulationId}
        sortedWeeks={sortedWeeks}
        costConfig={costConfig}
        startDayOffset={simulation.startDayOffset ?? 0}
        formatMoney={formatMoney}
        onWeekUpdated={handleWeekUpdated}
      />
    </div>
  );
}
