"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PlanResponse, SimulationListItem, CustomCostEntry, SimulationSnapshot } from "./types";

export interface AnnualDetailState {
  plan: PlanResponse | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  allSims: SimulationListItem[];
  pickerOpen: boolean;
  showAllKinds: boolean;
  setPickerOpen: (v: boolean) => void;
  setShowAllKinds: (v: boolean) => void;
  updateField: <K extends keyof PlanResponse>(key: K, value: PlanResponse[K]) => void;
  addFixedCost: () => void;
  updateFixedCost: (costId: string, patch: Partial<CustomCostEntry>) => void;
  removeFixedCost: (costId: string) => void;
  linkSimulation: (simId: string) => void;
  unlinkSimulation: (simId: string) => void;
  updateRepeatCount: (simId: string, repeatCount: number) => void;
  save: () => Promise<void>;
}

/** Builds a partial SimulationSnapshot for optimistic UI before re-fetch. */
function buildPartialSnapshot(sim: SimulationListItem, position: number): PlanResponse["simulationLinks"][number] {
  const snapshot: SimulationSnapshot = {
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
    expluginsDiscountStartDay: null,
    expluginsDiscountPercent: null,
    customCosts: null,
    weeks: [],
  };
  return { position, simulationId: sim.id, repeatCount: 1, simulation: snapshot };
}

/** Hook that owns all fetch/save/optimistic state for the annual plan detail page. */
export function useAnnualDetailState(id: string): AnnualDetailState {
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
      if (!res.ok) throw new Error(`status ${res.status}`);
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
      const url = `/api/simulations?limit=100${showAllKinds ? "" : "&kind=forecast"}`;
      const res = await fetch(url);
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
    const updated = (plan.annualCustomCosts ?? []).map((c) =>
      c.id === costId ? { ...c, ...patch } : c
    );
    updateField("annualCustomCosts", updated);
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
    // Optimistic: add placeholder — full snapshot arrives after save+re-fetch
    const partial = buildPartialSnapshot(sim, plan.simulationLinks.length);
    setPlan({ ...plan, simulationLinks: [...plan.simulationLinks, partial] });
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

  function updateRepeatCount(simId: string, repeatCount: number) {
    if (!plan) return;
    const n = Math.max(1, Math.floor(repeatCount));
    setPlan({
      ...plan,
      simulationLinks: plan.simulationLinks.map((l) =>
        l.simulationId === simId ? { ...l, repeatCount: n } : l
      ),
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
          simulationLinks: plan.simulationLinks.map((l) => ({
            simulationId: l.simulationId,
            repeatCount: l.repeatCount,
          })),
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success("Plano salvo");
      setDirty(false);
      // Re-fetch to hydrate full simulation snapshots after save
      fetchPlan();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return {
    plan,
    loading,
    saving,
    dirty,
    allSims,
    pickerOpen,
    showAllKinds,
    setPickerOpen,
    setShowAllKinds,
    updateField,
    addFixedCost,
    updateFixedCost,
    removeFixedCost,
    linkSimulation,
    unlinkSimulation,
    updateRepeatCount,
    save,
  };
}
