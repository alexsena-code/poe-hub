"use client";

import { useEffect, useState } from "react";
import type { DailyCostComponents } from "@/lib/daily-cost";
import type { CurvePoint } from "@/lib/league-price-curve";

export interface ProfitForecastData {
  league: {
    name: string;
    poeVersion: string;
    startDate: string | null;
    currentDayOfLeague: number | null;
  };
  basePrice: {
    medianUsd: number;
    p25Usd: number;
    offerCount: number;
    collectedAt: string;
  } | null;
  curve: {
    referenceDay: number;
    leaguesUsed: string[];
    maxDay: number;
    usedOtherGameVersion: boolean;
    points: CurvePoint[];
  } | null;
  costConfigs: {
    id: string;
    name: string;
    isDefault: boolean;
    parts: DailyCostComponents;
    /** Leveling + stash pack + customs únicos por bot. Só o payback usa. */
    oneTimePerBot: number;
  }[];
}

/**
 * Carrega o material da calculadora: preço de hoje, curva histórica e custos.
 *
 * Busca uma vez por liga. Os controles do operador não disparam refetch — o
 * cálculo é local, justamente para responder na hora.
 */
export function useProfitForecastData(league?: string) {
  const [data, setData] = useState<ProfitForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = league ? `?league=${encodeURIComponent(league)}` : "";
        const res = await fetch(`/api/prices/profit-forecast${params}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar dados");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [league]);

  return { data, loading, error };
}
