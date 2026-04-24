/**
 * RSC shell for /admin/benchmark/compare?a=<runId>&b=<runId>
 *
 * Fetches both runs in parallel from Prisma (server-side, no HTTP round-trip).
 * Finds the existing BenchmarkEvaluation row for (a, b, default judge) if any,
 * so the client island can render the verdict immediately without a POST.
 *
 * 404 — either run not found.
 * 400 — runs have different type (comparing apples to oranges makes no sense).
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { BenchmarkCompareClient } from "@/components/modules/admin/benchmark/compare-client";
import type { EvaluationForCompare, RunForCompare } from "@/components/modules/admin/benchmark/compare-client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Compare Runs | Benchmark | PoE Hub",
};

const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

interface SearchParams {
  a?: string;
  b?: string;
}

interface ComparePageProps {
  searchParams: Promise<SearchParams>;
}

export default async function BenchmarkComparePage({ searchParams }: ComparePageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { a: runAId, b: runBId } = await searchParams;

  if (!runAId || !runBId) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Compare Runs" description="Benchmark Wave 2 + 3" />
        <p className="text-sm text-destructive">
          Both ?a= and ?b= query params are required. Example:{" "}
          <code className="rounded bg-muted px-1 text-xs">/admin/benchmark/compare?a=RUN-A-UUID&b=RUN-B-UUID</code>
        </p>
      </div>
    );
  }

  // Fetch both runs + any existing evaluation in parallel
  const [runA, runB, existingEval] = await Promise.all([
    prisma.benchmarkRun.findUnique({
      where: { id: runAId },
      include: {
        preset: { select: { id: true, name: true, type: true } },
        evaluationsAsA: { select: { id: true, runBId: true, judgeModel: true } },
        evaluationsAsB: { select: { id: true, runAId: true, judgeModel: true } },
      },
    }),
    prisma.benchmarkRun.findUnique({
      where: { id: runBId },
      include: {
        preset: { select: { id: true, name: true, type: true } },
        evaluationsAsA: { select: { id: true, runBId: true, judgeModel: true } },
        evaluationsAsB: { select: { id: true, runAId: true, judgeModel: true } },
      },
    }),
    prisma.benchmarkEvaluation.findUnique({
      where: {
        runAId_runBId_judgeModel: {
          runAId,
          runBId,
          judgeModel: DEFAULT_JUDGE_MODEL,
        },
      },
    }),
  ]);

  if (!runA || !runB) {
    notFound();
  }

  if (runA.type !== runB.type) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Compare Runs" description="Benchmark Wave 2 + 3" />
        <p className="text-sm text-destructive">
          Type mismatch: run A is{" "}
          <code className="rounded bg-muted px-1 text-xs">{runA.type}</code> and run B is{" "}
          <code className="rounded bg-muted px-1 text-xs">{runB.type}</code>.
          Only runs of the same type can be compared.
        </p>
      </div>
    );
  }

  // Shape the data for the client island — avoid leaking raw Prisma JSON types
  const runAForClient: RunForCompare = {
    id: runA.id,
    type: runA.type,
    modelOverrides: runA.modelOverrides as Record<string, string>,
    requestBody: runA.requestBody,
    response: runA.response,
    totalCostUsd: runA.totalCostUsd,
    totalDurationMs: runA.totalDurationMs,
    llmCallCount: runA.llmCallCount,
    qdrantQueryCount: runA.qdrantQueryCount,
    httpStatus: runA.httpStatus,
    error: runA.error,
    createdAt: runA.createdAt.toISOString(),
    preset: runA.preset,
    evaluationsAsA: runA.evaluationsAsA,
    evaluationsAsB: runA.evaluationsAsB,
  };

  const runBForClient: RunForCompare = {
    id: runB.id,
    type: runB.type,
    modelOverrides: runB.modelOverrides as Record<string, string>,
    requestBody: runB.requestBody,
    response: runB.response,
    totalCostUsd: runB.totalCostUsd,
    totalDurationMs: runB.totalDurationMs,
    llmCallCount: runB.llmCallCount,
    qdrantQueryCount: runB.qdrantQueryCount,
    httpStatus: runB.httpStatus,
    error: runB.error,
    createdAt: runB.createdAt.toISOString(),
    preset: runB.preset,
    evaluationsAsA: runB.evaluationsAsA,
    evaluationsAsB: runB.evaluationsAsB,
  };

  const evalForClient: EvaluationForCompare | null = existingEval
    ? {
        id: existingEval.id,
        runAId: existingEval.runAId,
        runBId: existingEval.runBId,
        judgeModel: existingEval.judgeModel,
        verdict: existingEval.verdict as Record<string, unknown>,
        winner: existingEval.winner,
        costUsd: existingEval.costUsd,
        createdAt: existingEval.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Compare Runs"
        description={`${runA.type} · ${runAId.slice(0, 8)} vs ${runBId.slice(0, 8)}`}
      />
      <BenchmarkCompareClient
        runA={runAForClient}
        runB={runBForClient}
        existingEvaluation={evalForClient}
      />
    </div>
  );
}
