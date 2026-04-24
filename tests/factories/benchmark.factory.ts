/**
 * Factory helpers for BenchmarkRun and BenchmarkEvaluation test records.
 * Session 13 — benchmark judge endpoint.
 */

import { prisma } from "@/lib/prisma";
import type { BenchmarkType } from "@prisma/client";

let counter = 0;

export function buildRunInput(overrides: Partial<{
  type: BenchmarkType;
  modelOverrides: object;
  requestBody: object;
  response: object;
  totalCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
  qdrantQueryCount: number;
  httpStatus: number;
}> = {}) {
  counter++;
  return {
    type: "qa" as BenchmarkType,
    modelOverrides: {},
    requestBody: { question: `Test question ${counter}` },
    response: { result: `Answer ${counter}`, telemetry: {} },
    totalCostUsd: 0.001,
    totalDurationMs: 500,
    llmCallCount: 1,
    qdrantQueryCount: 0,
    httpStatus: 200,
    ...overrides,
  };
}

export async function createBenchmarkRun(overrides: Parameters<typeof buildRunInput>[0] = {}) {
  const input = buildRunInput(overrides);
  return prisma.benchmarkRun.create({ data: input });
}

export async function cleanupBenchmarkRuns() {
  await prisma.benchmarkEvaluation.deleteMany();
  await prisma.benchmarkRun.deleteMany();
}
