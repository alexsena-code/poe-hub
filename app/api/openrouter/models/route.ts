import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/openrouter/models
 *
 * Returns the full OpenRouter model catalog (simplified shape) for the
 * benchmark combobox. Cached 1h server-side — the catalog rarely changes
 * within a single editing session.
 *
 * For a single-model lookup (pricing card), use /api/openrouter/models/:id
 * (the catch-all sibling route).
 */

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_REVALIDATE_SECONDS = 3600;

export interface OpenRouterModelSummary {
  id: string;
  name: string;
  contextLength: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

interface OpenRouterRawModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
}

interface OpenRouterModelsResponse {
  data: OpenRouterRawModel[];
}

function parsePricePer1M(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  if (!isFinite(n)) return 0;
  return n * 1_000_000;
}

function buildModelSummary(raw: OpenRouterRawModel): OpenRouterModelSummary {
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.context_length ?? 0,
    inputPricePer1M: parsePricePer1M(raw.pricing?.prompt),
    outputPricePer1M: parsePricePer1M(raw.pricing?.completion),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(OPENROUTER_MODELS_URL, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    console.error(
      `[openrouter/models:list] upstream fetch failed: ${res.status} ${res.statusText}`,
    );
    return NextResponse.json(
      { error: `OpenRouter upstream error: ${res.status}` },
      { status: 502 },
    );
  }

  const body: OpenRouterModelsResponse = await res.json();
  const models = body.data
    .map(buildModelSummary)
    // Stable alphabetical order — simpler for combobox UX than upstream ordering.
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return NextResponse.json({ models });
}
