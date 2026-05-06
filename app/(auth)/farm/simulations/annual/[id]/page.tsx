"use client";

import { useMemo, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { computeAnnualRollup } from "@/lib/annual-plan-calculator";
import { useAnnualDetailState } from "@/components/modules/farm/simulations/annual-detail/use-annual-detail-state";
import { PlanHeader } from "@/components/modules/farm/simulations/annual-detail/plan-header";
import { LeaguesTable } from "@/components/modules/farm/simulations/annual-detail/leagues-table";
import { FixedCostsPanel } from "@/components/modules/farm/simulations/annual-detail/fixed-costs-panel";
import { LeagueComparisonChart } from "@/components/modules/farm/simulations/annual-detail/league-comparison-chart";
import { SimulationPickerDialog } from "@/components/modules/farm/simulations/annual-detail/simulation-picker-dialog";

export default function AnnualPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { formatMoney, exchangeRate } = useCurrency();

  const state = useAnnualDetailState(id);

  const rollup = useMemo(() => {
    if (!state.plan) return null;
    const inputs = state.plan.simulationLinks.map((l) => ({
      snapshot: l.simulation,
      repeatCount: l.repeatCount,
    }));
    return computeAnnualRollup(inputs, state.plan.annualCustomCosts, exchangeRate);
  }, [state.plan, exchangeRate]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!state.plan) {
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

  const linkedIds = new Set(state.plan.simulationLinks.map((l) => l.simulationId));
  const pickerItems = state.allSims.filter((s) => !linkedIds.has(s.id));

  return (
    <div className="space-y-6">
      <PlanHeader
        plan={state.plan}
        rollup={rollup}
        dirty={state.dirty}
        saving={state.saving}
        onNameChange={(v) => state.updateField("name", v)}
        onYearChange={(v) => state.updateField("year", v)}
        onNotesChange={(v) => state.updateField("notes", v)}
        onSave={state.save}
        formatMoney={formatMoney}
      />

      <LeaguesTable
        leagues={rollup?.leagues ?? []}
        onAddLeague={() => state.setPickerOpen(true)}
        onUnlink={state.unlinkSimulation}
        onUpdateRepeat={state.updateRepeatCount}
        formatMoney={formatMoney}
      />

      <FixedCostsPanel
        costs={state.plan.annualCustomCosts ?? []}
        onAdd={state.addFixedCost}
        onUpdate={state.updateFixedCost}
        onRemove={state.removeFixedCost}
        formatMoney={formatMoney}
      />

      {rollup && rollup.leagues.length > 0 && (
        <LeagueComparisonChart rollup={rollup} formatMoney={formatMoney} />
      )}

      <SimulationPickerDialog
        open={state.pickerOpen}
        onOpenChange={state.setPickerOpen}
        items={pickerItems}
        showAllKinds={state.showAllKinds}
        onToggleAllKinds={state.setShowAllKinds}
        onSelect={state.linkSimulation}
      />
    </div>
  );
}
