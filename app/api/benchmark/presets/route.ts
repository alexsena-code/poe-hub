/**
 * GET  /api/benchmark/presets — list all presets, sorted by updatedAt desc.
 *   ?type=qa|ideation|content_generation — optional filter
 * POST /api/benchmark/presets — create a new preset (validates payload per type).
 *
 * Session 13 S13.a — benchmark presets CRUD.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { benchmarkPresetInputSchema } from "@/lib/benchmark-schemas";
import type { BenchmarkType, Prisma } from "@prisma/client";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const typeFilter = searchParams.get("type") as BenchmarkType | null;

  const where: Prisma.BenchmarkPresetWhereInput = {};
  if (typeFilter) {
    const validTypes: BenchmarkType[] = ["qa", "ideation", "content_generation"];
    if (!validTypes.includes(typeFilter)) {
      return NextResponse.json(
        { error: `Invalid type filter: ${typeFilter}. Expected one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }
    where.type = typeFilter;
  }

  const presets = await prisma.benchmarkPreset.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ presets });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = benchmarkPresetInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, type, payload, notes } = parsed.data;

  try {
    const preset = await prisma.benchmarkPreset.create({
      data: {
        name,
        type,
        payload: payload as Prisma.InputJsonValue,
        notes: notes ?? null,
      },
    });
    return NextResponse.json(preset, { status: 201 });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json(
        { error: `A preset named "${name}" with type "${type}" already exists` },
        { status: 409 },
      );
    }
    console.error("[benchmark/presets] POST failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
