/**
 * GET  /api/benchmark/runs  — paginated list (requestBody/response omitted for size).
 * POST /api/benchmark/runs  — persist a completed benchmark run.
 *
 * Telemetry denormalization: totalCostUsd / totalDurationMs / llmCallCount /
 * qdrantQueryCount are read from response.telemetry at write time so the list
 * query never needs to deserialize the large response JSON blob.
 *
 * Session 01 S01.benchmark-runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { benchmarkRunCreateSchema } from "@/lib/benchmark-run-schema";
import type { BenchmarkSnapshot } from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// GET — list (no requestBody/response — they're huge)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? undefined;
  const presetId = searchParams.get("presetId") ?? undefined;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  const where = buildListWhere(type, presetId);

  const [runs, total] = await Promise.all([
    prisma.benchmarkRun.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        presetId: true,
        preset: { select: { id: true, name: true } },
        modelOverrides: true,
        totalCostUsd: true,
        totalDurationMs: true,
        llmCallCount: true,
        qdrantQueryCount: true,
        httpStatus: true,
        error: true,
        createdAt: true,
        // requestBody and response excluded — fetched only on detail view
      },
    }),
    prisma.benchmarkRun.count({ where }),
  ]);

  return NextResponse.json({ runs, total });
}

// ---------------------------------------------------------------------------
// POST — create a run (persisted after benchmark completes client-side)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = benchmarkRunCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.presetId) {
    const presetError = await validatePreset(data.presetId, data.type);
    if (presetError) {
      return NextResponse.json({ error: presetError }, { status: 400 });
    }
  }

  const telemetry = extractTelemetry(data.response);

  const run = await prisma.benchmarkRun.create({
    data: {
      type: data.type,
      presetId: data.presetId ?? null,
      modelOverrides: data.modelOverrides,
      requestBody: data.requestBody as Prisma.InputJsonValue,
      response: data.response as Prisma.InputJsonValue,
      totalCostUsd: telemetry.totalCostUsd,
      totalDurationMs: telemetry.totalDurationMs,
      llmCallCount: telemetry.llmCallCount,
      qdrantQueryCount: telemetry.qdrantQueryCount,
      httpStatus: data.httpStatus,
      error: data.error ?? null,
    },
    include: {
      preset: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(run, { status: 201 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildListWhere(
  type: string | undefined,
  presetId: string | undefined,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (presetId) where.presetId = presetId;
  return where;
}

/**
 * Verify preset exists and its type matches the run type.
 * Returns an error message string on failure, null on success.
 */
async function validatePreset(presetId: string, runType: string): Promise<string | null> {
  const preset = await prisma.benchmarkPreset.findUnique({
    where: { id: presetId },
    select: { id: true, type: true },
  });

  if (!preset) {
    return `Preset not found: ${presetId}`;
  }

  if (preset.type !== runType) {
    return `Preset type mismatch: preset is ${preset.type} but run type is ${runType}`;
  }

  return null;
}

/**
 * Pull the 4 telemetry scalars from response.telemetry.
 * Defaults to 0 if the engine failed or the field is absent — we still
 * want the audit row.
 */
function extractTelemetry(response: unknown): {
  totalCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
  qdrantQueryCount: number;
} {
  const telemetry = (response as { telemetry?: Partial<BenchmarkSnapshot> } | null)
    ?.telemetry;

  return {
    totalCostUsd: telemetry?.totalCostUsd ?? 0,
    totalDurationMs: telemetry?.totalDurationMs ?? 0,
    llmCallCount: telemetry?.llmCallCount ?? 0,
    qdrantQueryCount: telemetry?.qdrantQueryCount ?? 0,
  };
}
