/**
 * GET    /api/benchmark/presets/[id] — fetch a single preset by id.
 * PATCH  /api/benchmark/presets/[id] — partial update (name, payload, notes).
 *   Changing `type` is rejected with 400 — payload shape is bound to type.
 * DELETE /api/benchmark/presets/[id] — remove the preset (204).
 *   BenchmarkRun.presetId is onDelete: SetNull, so runs keep their history.
 *
 * Session 13 S13.a — benchmark presets CRUD.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { benchmarkPresetPatchSchema } from "@/lib/benchmark-schemas";
import type { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const preset = await prisma.benchmarkPreset.findUnique({ where: { id } });
  if (!preset) {
    return NextResponse.json({ error: `Preset not found: ${id}` }, { status: 404 });
  }

  return NextResponse.json(preset);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Reject early if caller tried to change type — this would break the
  // semantic invariant that payload shape matches the declared type.
  if (typeof rawBody === "object" && rawBody !== null && "type" in rawBody) {
    return NextResponse.json(
      { error: "Cannot change preset type — create a new preset instead" },
      { status: 400 },
    );
  }

  const parsed = benchmarkPresetPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.benchmarkPreset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: `Preset not found: ${id}` }, { status: 404 });
  }

  const { name, payload, notes } = parsed.data;

  const updated = await prisma.benchmarkPreset.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(payload !== undefined && { payload: payload as Prisma.InputJsonValue }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.benchmarkPreset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: `Preset not found: ${id}` }, { status: 404 });
  }

  await prisma.benchmarkPreset.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
