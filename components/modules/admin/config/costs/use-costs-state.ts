"use client";

// Hook encapsulating all async state + currency-toggle logic for the costs page.
// Keeps the page orchestrator and the Dialog free of fetch/mutation boilerplate.

import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import {
  CostConfig,
  CostFieldName,
  FieldCurrencies,
  DEFAULT_FIELD_CURRENCIES,
  COST_FIELDS,
} from "./types";
import { costConfigSchema, CostConfigForm, COST_CONFIG_DEFAULTS } from "./schema";

// --- helpers ---

function buildCustomCurrencies(customs: CostConfig["customCosts"]): Record<string, "usd" | "brl"> {
  return Object.fromEntries((customs ?? []).map((c) => [c.id, "usd" as const]));
}

// ---

export function useCostsState() {
  const { exchangeRate } = useCurrency();

  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CostConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Per-field input currency — user can type in $ or R$; stored always in $.
  const [fieldCurrencies, setFieldCurrencies] = useState<FieldCurrencies>(DEFAULT_FIELD_CURRENCIES);

  // Per-custom-cost currency keyed by the custom cost id.
  const [customCurrencies, setCustomCurrencies] = useState<Record<string, "usd" | "brl">>({});

  const formMethods = useForm<CostConfigForm>({
    resolver: zodResolver(costConfigSchema),
    defaultValues: COST_CONFIG_DEFAULTS,
  });

  const { reset, handleSubmit, control } = formMethods;

  const { fields: customFields, append: appendCustom, remove: removeCustom } = useFieldArray({
    control,
    name: "customCosts",
  });

  // --- fetch ---

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/cost-configs");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : (data.data ?? []));
    } catch (err) {
      toast.error(`Erro ao carregar configuracoes de custo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // --- dialog open/close ---

  function openCreate() {
    setEditingConfig(null);
    setFieldCurrencies(DEFAULT_FIELD_CURRENCIES);
    setCustomCurrencies({});
    reset(COST_CONFIG_DEFAULTS);
    setDialogOpen(true);
  }

  function openEdit(config: CostConfig) {
    setEditingConfig(config);
    setFieldCurrencies(DEFAULT_FIELD_CURRENCIES);
    const customs = config.customCosts ?? [];
    setCustomCurrencies(buildCustomCurrencies(config.customCosts));
    reset({
      name: config.name,
      isDefault: config.isDefault,
      proxyCostPerBotMonthly: Number(config.proxyCostPerBotMonthly),
      levelingCostPerBot: Number(config.levelingCostPerBot),
      stashPackCostPerBot: Number(config.stashPackCostPerBot),
      expluginsKeyCostDaily: Number(config.expluginsKeyCostDaily),
      dpbKeyCostDaily: Number(config.dpbKeyCostDaily),
      customCosts: customs.map((c) => ({
        id: c.id,
        name: c.name,
        amount: Number(c.amount),
        cadence: c.cadence,
        perBot: c.perBot,
      })),
      notes: config.notes ?? "",
    });
    setDialogOpen(true);
  }

  // --- currency toggles ---

  function toggleFieldCurrency(field: CostFieldName) {
    setFieldCurrencies((prev) => ({
      ...prev,
      [field]: prev[field] === "usd" ? "brl" : "usd",
    }));
  }

  function addCustomCost() {
    const newId = crypto.randomUUID();
    appendCustom({ id: newId, name: "", amount: 0, cadence: "monthly", perBot: false });
    setCustomCurrencies((prev) => ({ ...prev, [newId]: "usd" }));
  }

  function toggleCustomCurrency(id: string) {
    setCustomCurrencies((prev) => ({
      ...prev,
      [id]: (prev[id] ?? "usd") === "usd" ? "brl" : "usd",
    }));
  }

  // --- mutations ---

  async function onSubmit(data: CostConfigForm) {
    setSubmitting(true);
    try {
      // Convert any BRL-entered fields back to USD before persisting.
      const payload = { ...data };
      for (const field of COST_FIELDS) {
        if (fieldCurrencies[field] === "brl" && exchangeRate > 0) {
          payload[field] = Number(((payload[field] as number) / exchangeRate).toFixed(4));
        }
      }
      payload.customCosts = (data.customCosts ?? []).map((cc) => {
        const curr = customCurrencies[cc.id] ?? "usd";
        const amount =
          curr === "brl" && exchangeRate > 0
            ? Number((cc.amount / exchangeRate).toFixed(4))
            : cc.amount;
        return { ...cc, amount };
      });

      const url = editingConfig ? `/api/cost-configs/${editingConfig.id}` : "/api/cost-configs";
      const method = editingConfig ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Erro ao salvar");
      }

      toast.success(editingConfig ? "Configuracao atualizada" : "Configuracao criada");
      setDialogOpen(false);
      fetchConfigs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(config: CostConfig) {
    if (!confirm(`Deletar configuracao "${config.name}"?`)) return;
    try {
      const res = await fetch(`/api/cost-configs/${config.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success("Configuracao deletada");
      fetchConfigs();
    } catch (err) {
      toast.error(`Erro ao deletar configuracao: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    // list state
    configs, loading,
    // dialog state
    dialogOpen, setDialogOpen, editingConfig,
    submitting,
    // form
    formMethods, customFields,
    // currency state
    fieldCurrencies, customCurrencies,
    // actions
    openCreate, openEdit, handleDelete,
    handleSubmit: handleSubmit(onSubmit),
    addCustomCost, removeCustom,
    toggleFieldCurrency, toggleCustomCurrency,
  };
}
