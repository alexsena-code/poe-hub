import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// OpenRouter's public /api/v1/models returns all available models with pricing.
// We cache for 5 minutes to avoid hammering their endpoint on repeated benchmark previews.
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_REVALIDATE_SECONDS = 300;

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  description: string | null;
}

// Raw shape from OpenRouter's /api/v1/models response (partial — only fields we use).
interface OpenRouterRawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterRawModel[];
}

function parsePricePer1M(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  if (!isFinite(n)) return 0;
  // OpenRouter returns price per token; multiply by 1e6 to get per-million tokens.
  return n * 1_000_000;
}

function buildModelInfo(raw: OpenRouterRawModel): OpenRouterModelInfo {
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.context_length ?? 0,
    inputPricePer1M: parsePricePer1M(raw.pricing?.prompt),
    outputPricePer1M: parsePricePer1M(raw.pricing?.completion),
    description: raw.description ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string[] }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: segments } = await params;
  const modelId = segments.join("/");

  const res = await fetch(OPENROUTER_MODELS_URL, {
    next: { revalidate: CACHE_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    console.error(
      `[openrouter/models] upstream fetch failed: ${res.status} ${res.statusText}`,
    );
    return NextResponse.json(
      { error: `OpenRouter upstream error: ${res.status}` },
      { status: 502 },
    );
  }

  const body: OpenRouterModelsResponse = await res.json();
  const match = body.data.find((m) => m.id === modelId);

  if (!match) {
    return NextResponse.json(
      { error: `Model not found: ${modelId}` },
      { status: 404 },
    );
  }

  return NextResponse.json(buildModelInfo(match));
}
