/**
 * Benchmark History — RSC shell.
 *
 * Fetches the first page of runs via Prisma (10 rows) to seed the client
 * island so the page loads with data immediately. The client island then
 * manages SWR-backed pagination and filters.
 *
 * Session 01 S01.benchmark-history.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { BenchmarkHistoryClient } from "@/components/modules/admin/benchmark/history-client";
import Link from "next/link";
import type { BenchmarkRunListRow } from "@/components/modules/admin/benchmark/history-types";

export const metadata = {
  title: "Benchmark History | PoE Hub",
};

// Matches the select in GET /api/benchmark/runs — no requestBody/response.
const RUNS_SELECT = {
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
} as const;

async function fetchInitialRuns(): Promise<{ runs: BenchmarkRunListRow[]; total: number }> {
  const [rawRuns, total] = await Promise.all([
    prisma.benchmarkRun.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: RUNS_SELECT,
    }),
    prisma.benchmarkRun.count(),
  ]);

  // Prisma returns Decimal for some fields and Date for createdAt;
  // serialize to plain objects so they're safe to pass as RSC props.
  const runs: BenchmarkRunListRow[] = rawRuns.map((r) => ({
    id: r.id,
    type: r.type as BenchmarkRunListRow["type"],
    presetId: r.presetId,
    preset: r.preset,
    modelOverrides: (r.modelOverrides ?? {}) as Record<string, string>,
    totalCostUsd: r.totalCostUsd,
    totalDurationMs: r.totalDurationMs,
    llmCallCount: r.llmCallCount,
    qdrantQueryCount: r.qdrantQueryCount,
    httpStatus: r.httpStatus,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  }));

  return { runs, total };
}

export default async function BenchmarkHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { runs, total } = await fetchInitialRuns();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Benchmark History"
        description="Historico de runs de QA, Ideation e Content Generation com telemetria completa"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/benchmark">Novo Run</Link>
          </Button>
        }
      />
      <BenchmarkHistoryClient initialRuns={runs} initialTotal={total} />
    </div>
  );
}
