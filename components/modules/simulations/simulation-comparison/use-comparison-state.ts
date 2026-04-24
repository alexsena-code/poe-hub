"use client";

// Custom hook that owns all state and mutation logic for SimulationComparison.
// Extracted from index.tsx to keep the orchestrator under 250L.

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Simulation, CostConfigOption, CustomCost } from "./types";

interface ComparisonState {
  simulations: Simulation[];
  loading: boolean;
  error: string | null;
  dirty: Set<string>;
  costConfigs: CostConfigOption[];
}

interface ComparisonActions {
  applyCostConfig: (simIndex: number, configId: string) => Promise<void>;
  updateWeekDefault: (simIndex: number, weekNumber: number, field: string, value: number) => void;
  updateSimCost: (
    simIndex: number,
    field:
      | "proxyCostPerBotMonthly"
      | "levelingCostPerBot"
      | "stashPackCostPerBot"
      | "expluginsKeyCostDaily"
      | "dpbKeyCostDaily",
    value: number
  ) => void;
  updateCustomCost: (simIndex: number, costId: string, patch: Partial<CustomCost>) => void;
  addCustomCost: (simIndex: number) => void;
  removeCustomCost: (simIndex: number, costId: string) => void;
  saveSimulation: (simIndex: number) => Promise<void>;
}

export function useComparisonState(
  ids: string[]
): ComparisonState & ComparisonActions {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [costConfigs, setCostConfigs] = useState<CostConfigOption[]>([]);

  // Fetch available cost configs once on mount
  useEffect(() => {
    fetch("/api/cost-configs")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data.data ?? [];
        setCostConfigs(items);
      })
      .catch(() => setCostConfigs([]));
  }, []);

  // Fetch the two+ simulations by ID
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

  // --- Mutation handlers ---

  async function applyCostConfig(simIndex: number, configId: string) {
    const sim = simulations[simIndex];
    const cfg = costConfigs.find((c) => c.id === configId);
    if (!cfg) return;
    try {
      const res = await fetch(`/api/simulations/${sim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costConfigIds: [configId] }),
      });
      if (!res.ok) throw new Error();
      // Update local state with snapshot values from the new config
      setSimulations((prev) => {
        const updated = [...prev];
        updated[simIndex] = {
          ...updated[simIndex],
          costConfigName: cfg.name,
          proxyCostPerBotMonthly: Number(cfg.proxyCostPerBotMonthly),
          levelingCostPerBot: Number(cfg.levelingCostPerBot),
          stashPackCostPerBot: Number(cfg.stashPackCostPerBot),
          expluginsKeyCostDaily: Number(cfg.expluginsKeyCostDaily),
          dpbKeyCostDaily: Number(cfg.dpbKeyCostDaily),
          customCosts: cfg.customCosts ?? [],
          costLinks: [{ costConfigId: cfg.id, costConfig: { id: cfg.id, name: cfg.name } }],
        };
        return updated;
      });
      // Remove dirty flag — the new config was already persisted
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(sim.id);
        return next;
      });
      toast.success(`Config "${cfg.name}" aplicada a ${sim.name}`);
    } catch {
      toast.error("Erro ao aplicar config");
    }
  }

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

  function updateSimCost(
    simIndex: number,
    field:
      | "proxyCostPerBotMonthly"
      | "levelingCostPerBot"
      | "stashPackCostPerBot"
      | "expluginsKeyCostDaily"
      | "dpbKeyCostDaily",
    value: number
  ) {
    setSimulations((prev) => {
      const updated = [...prev];
      updated[simIndex] = { ...updated[simIndex], [field]: value };
      return updated;
    });
    setDirty((prev) => new Set(prev).add(ids[simIndex]));
  }

  function updateCustomCost(simIndex: number, costId: string, patch: Partial<CustomCost>) {
    setSimulations((prev) => {
      const updated = [...prev];
      const sim = updated[simIndex];
      const list = (sim.customCosts ?? []).map((c) =>
        c.id === costId ? { ...c, ...patch } : c
      );
      updated[simIndex] = { ...sim, customCosts: list };
      return updated;
    });
    setDirty((prev) => new Set(prev).add(ids[simIndex]));
  }

  function addCustomCost(simIndex: number) {
    setSimulations((prev) => {
      const updated = [...prev];
      const sim = updated[simIndex];
      const newItem: CustomCost = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `cc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: "Novo custo",
        amount: 0,
        cadence: "monthly",
        perBot: false,
      };
      updated[simIndex] = {
        ...sim,
        customCosts: [...(sim.customCosts ?? []), newItem],
      };
      return updated;
    });
    setDirty((prev) => new Set(prev).add(ids[simIndex]));
  }

  function removeCustomCost(simIndex: number, costId: string) {
    setSimulations((prev) => {
      const updated = [...prev];
      const sim = updated[simIndex];
      updated[simIndex] = {
        ...sim,
        customCosts: (sim.customCosts ?? []).filter((c) => c.id !== costId),
      };
      return updated;
    });
    setDirty((prev) => new Set(prev).add(ids[simIndex]));
  }

  async function saveSimulation(simIndex: number) {
    const sim = simulations[simIndex];
    try {
      // Save per-week defaults
      for (const week of sim.weeks) {
        await fetch(`/api/simulations/${sim.id}/weeks/${week.weekNumber}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultActiveBots: week.defaultActiveBots,
            defaultDivinePerHour: week.defaultDivinePerHour,
            defaultHoursPerDay: week.defaultHoursPerDay,
            defaultDivinePriceUsd: week.defaultDivinePriceUsd,
            defaultDivinePriceBrl: week.defaultDivinePriceBrl,
          }),
        });
      }

      // Save cost overrides (including custom costs) on the simulation itself
      await fetch(`/api/simulations/${sim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyCostPerBotMonthly: sim.proxyCostPerBotMonthly,
          levelingCostPerBot: sim.levelingCostPerBot,
          stashPackCostPerBot: sim.stashPackCostPerBot,
          expluginsKeyCostDaily: sim.expluginsKeyCostDaily,
          dpbKeyCostDaily: sim.dpbKeyCostDaily,
          customCosts: sim.customCosts ?? [],
        }),
      });

      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(sim.id);
        return next;
      });
      toast.success(`Alterações salvas: ${sim.name}`);
    } catch {
      toast.error("Falha ao salvar. Mudanças continuam em memória.");
    }
  }

  return {
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
  };
}
