"use client";

import { useCallback, useEffect, useState } from "react";

export interface G2gSnapshot {
  id: string;
  collectedAt: string;
  item: string;
  league: string;
  median: number;
  mean: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  offerCount: number;
  rawOfferCount: number;
}

interface G2gSnapshotsResponse {
  data: G2gSnapshot[];
  latest: G2gSnapshot | null;
  count: number;
}

interface UseG2gSnapshotsParams {
  item?: string;
  league?: string;
  days?: number;
}

/**
 * Série de snapshots do G2G.
 *
 * Hook e não fetch inline porque o card de estatística e o gráfico consomem os
 * mesmos dados — sem isso seriam duas requisições para a mesma série.
 */
export function useG2gSnapshots({ item = "Divine Orb", league, days = 30 }: UseG2gSnapshotsParams) {
  const [snapshots, setSnapshots] = useState<G2gSnapshot[]>([]);
  const [latest, setLatest] = useState<G2gSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ item, days: String(days) });
      if (league) params.set("league", league);

      const res = await fetch(`/api/prices/g2g?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload: G2gSnapshotsResponse = await res.json();
      setSnapshots(payload.data);
      setLatest(payload.latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar snapshots");
      setSnapshots([]);
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, [item, league, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { snapshots, latest, loading, error, reload };
}
