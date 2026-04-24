"use client";
/**
 * SWR-backed hook for BenchmarkPreset CRUD.
 *
 * Centralises all preset API calls so the forms don't fetch directly.
 * The `mutate` returned by SWR is exposed so components can trigger a revalidation
 * after an external action (e.g., after loading a preset that might already be outdated).
 *
 * @example
 * const { presets, isLoading, createPreset, deletePreset } = useBenchmarkPresets("qa");
 */
import useSWR from "swr";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BenchmarkType = "qa" | "ideation" | "content_generation";

export interface BenchmarkPreset {
  id: string;
  name: string;
  type: BenchmarkType;
  payload: unknown;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreatePresetInput {
  name: string;
  type: BenchmarkType;
  payload: unknown;
  notes?: string;
}

export interface UseBenchmarkPresetsResult {
  presets: BenchmarkPreset[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
  createPreset: (input: CreatePresetInput) => Promise<BenchmarkPreset>;
  deletePreset: (id: string) => Promise<void>;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchPresets(url: string): Promise<BenchmarkPreset[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[use-benchmark-presets] fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { presets: BenchmarkPreset[] };
  return json.presets;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBenchmarkPresets(type: BenchmarkType): UseBenchmarkPresetsResult {
  const key = `/api/benchmark/presets?type=${type}`;

  const {
    data,
    error,
    isLoading,
    mutate: revalidate,
  } = useSWR<BenchmarkPreset[], Error>(key, fetchPresets, {
    revalidateOnFocus: false,
  });

  async function createPreset(input: CreatePresetInput): Promise<BenchmarkPreset> {
    const res = await fetch("/api/benchmark/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(
        `[use-benchmark-presets] createPreset failed: ${res.status} — ${text.slice(0, 200)}`
      );
    }
    const preset = (await res.json()) as BenchmarkPreset;
    // Optimistically update the cache after creation.
    await revalidate();
    return preset;
  }

  async function deletePreset(id: string): Promise<void> {
    const res = await fetch(`/api/benchmark/presets/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(
        `[use-benchmark-presets] deletePreset(${id}) failed: ${res.status} — ${text.slice(0, 200)}`
      );
    }
    await revalidate();
  }

  return {
    presets: data ?? [],
    isLoading,
    error: error ?? null,
    mutate: () => void revalidate(),
    createPreset,
    deletePreset,
  };
}
