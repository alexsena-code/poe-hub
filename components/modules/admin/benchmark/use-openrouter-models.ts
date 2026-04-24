"use client";

import useSWR from "swr";
import type { OpenRouterModelSummary } from "@/app/api/openrouter/models/route";

export type { OpenRouterModelSummary };

export interface UseOpenRouterModelsResult {
  models: OpenRouterModelSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

async function fetchModels(url: string): Promise<OpenRouterModelSummary[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[use-openrouter-models] fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { models?: OpenRouterModelSummary[] };
  if (!Array.isArray(data.models)) {
    throw new Error(
      `[use-openrouter-models] unexpected response shape: ${JSON.stringify(data).slice(0, 120)}`,
    );
  }
  return data.models;
}

const FETCH_KEY = "/api/openrouter/models";

/**
 * Full OpenRouter model catalog for the combobox UI.
 *
 * Cached aggressively (1h server-side, 1h dedupe client-side) because the
 * catalog is large (~300 entries) and stable within an editing session.
 */
export function useOpenRouterModels(): UseOpenRouterModelsResult {
  const { data, error, isLoading, mutate } = useSWR<
    OpenRouterModelSummary[],
    Error
  >(FETCH_KEY, fetchModels, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60_000,
    keepPreviousData: true,
  });

  return {
    models: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
