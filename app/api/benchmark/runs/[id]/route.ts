/**
 * GET    /api/benchmark/runs/[id] — full run including requestBody, response,
 *                                    preset preview, and evaluation ids.
 * DELETE /api/benchmark/runs/[id] — 204, cascade handled by Prisma onDelete: Cascade.
 *
 * The evaluation ids are included so the compare UI can check whether a judge
 * has already run for this run without a separate query.
 *
 * Session 01 S01.benchmark-runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const run = await prisma.benchmarkRun.findUnique({
    where: { id },
    include: {
      preset: { select: { id: true, name: true, type: true } },
      // Only return evaluation ids — full evaluation data lives on its own route.
      evaluationsAsA: { select: { id: true, runBId: true, judgeModel: true } },
      evaluationsAsB: { select: { id: true, runAId: true, judgeModel: true } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.benchmarkRun.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // BenchmarkEvaluation has onDelete: Cascade on both runAId and runBId,
  // so Prisma/Postgres handles evaluation cleanup automatically.
  await prisma.benchmarkRun.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
