"use client";

// Orchestrator for the simulation comparison view.
// State + mutations live in useComparisonState; this file only renders.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/use-currency";

import { calcSimTotals, calcWeekTotals } from "./helpers";
import { useComparisonState } from "./use-comparison-state";
import { FinancialSummary } from "./financial-summary";
import { CostPanel } from "./cost-panel";
import { WeekParamsTable } from "./week-params-table";
import { WeekResultsTable } from "./week-results-table";
import { DailyBreakdown } from "./daily-breakdown";

// Re-export the public types so callers can import from this barrel.
export type { Simulation, CostConfigOption, CustomCost } from "./types";

interface SimulationComparisonProps {
  ids: string[];
}

export function SimulationComparison({ ids }: SimulationComparisonProps) {
  const { formatMoney, exchangeRate } = useCurrency();
  const {
    simulations,
    loading,
    error,
    dirty,
    costConfigs,
    applyCostConfig,
    updateWeekDefault,
    updateSimCost,
    updateCustomCost,
    addCustomCost,
    removeCustomCost,
    saveSimulation,
  } = useComparisonState(ids);

  // --- Early returns ---

  if (ids.length < 2) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/farm/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-muted-foreground">
          Selecione pelo menos 2 simulacoes para comparar.
        </p>
        <Button asChild variant="outline">
          <Link href="/farm/simulations">Ir para Simulacoes</Link>
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
          <Link href="/farm/simulations">
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
          <Link href="/farm/simulations">
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

  const allWeekNumbers = Array.from(
    new Set(allWeekTotalsList.flatMap((wts) => wts.map((w) => w.weekNumber)))
  ).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/farm/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Comparacao de Simulacoes</h1>
        <p className="text-muted-foreground text-sm">
          {simulations.map((s) => s.name).join(" vs ")}
        </p>
      </div>

      {/* Section A: Summary metrics + cumulative profit chart */}
      <FinancialSummary
        simulations={simulations}
        simNames={simNames}
        allTotals={allTotals}
        exchangeRate={exchangeRate}
        formatMoney={formatMoney}
      />

      {/* Section B: Editable costs per simulation */}
      <CostPanel
        simulations={simulations}
        simNames={simNames}
        dirty={dirty}
        costConfigs={costConfigs}
        onApplyConfig={applyCostConfig}
        onUpdateSimCost={updateSimCost}
        onUpdateCustomCost={updateCustomCost}
        onAddCustomCost={addCustomCost}
        onRemoveCustomCost={removeCustomCost}
        onSave={saveSimulation}
      />

      {/* Section C: Editable week defaults */}
      <WeekParamsTable
        simulations={simulations}
        simNames={simNames}
        allWeekNumbers={allWeekNumbers}
        dirty={dirty}
        onUpdateWeekDefault={updateWeekDefault}
        onSave={saveSimulation}
      />

      {/* Section D: Week-by-week results */}
      <WeekResultsTable
        simulations={simulations}
        simNames={simNames}
        allWeekNumbers={allWeekNumbers}
        allWeekTotalsList={allWeekTotalsList}
        formatMoney={formatMoney}
      />

      {/* Section E: Unified daily breakdown */}
      <DailyBreakdown
        simulations={simulations}
        simNames={simNames}
        allWeekNumbers={allWeekNumbers}
        formatMoney={formatMoney}
      />
    </div>
  );
}
