"use client";

/**
 * Client island for /admin/benchmark/compare.
 *
 * Receives two fully-loaded BenchmarkRun objects + an optional existing
 * BenchmarkEvaluation from the RSC shell (server-side). All mutations
 * (judge runs) stay client-side via fetch to the evaluate endpoint.
 *
 * Sections:
 *   1. Header — run A vs B metadata
 *   2. Objective metrics — 4 stat cards + per-node breakdown table + event pairs
 *   3. Output diff — side-by-side result blocks
 *   4. Judge section — run/render evaluation verdict
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Clock,
  DollarSign,
  Zap,
  Database,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CompareOutput } from "./compare-output";
import { computeDelta, aggregateByNode, pairEventsByNode } from "@/lib/benchmark-compare";
import type { BenchmarkCollectorEvent, BenchmarkSnapshot } from "@/lib/benchmark-types";
import type { JudgeVerdict, JudgeErrorVerdict } from "@/lib/benchmark-judge-schema";
import type { BenchmarkType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Props types
// ---------------------------------------------------------------------------

export interface RunForCompare {
  id: string;
  type: BenchmarkType;
  modelOverrides: Record<string, string>;
  requestBody: unknown;
  response: unknown;
  totalCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
  qdrantQueryCount: number;
  httpStatus: number;
  error: string | null;
  createdAt: string;
  preset: { id: string; name: string; type: string } | null;
  evaluationsAsA: Array<{ id: string; runBId: string; judgeModel: string }>;
  evaluationsAsB: Array<{ id: string; runAId: string; judgeModel: string }>;
}

export interface EvaluationForCompare {
  id: string;
  runAId: string;
  runBId: string;
  judgeModel: string;
  verdict: Record<string, unknown>;
  winner: string | null;
  costUsd: number;
  createdAt: string;
}

interface BenchmarkCompareClientProps {
  runA: RunForCompare;
  runB: RunForCompare;
  existingEvaluation: EvaluationForCompare | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

const JUDGE_MODEL_OPTIONS = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(6)}`;
}

function formatPercent(pct: number | null): string {
  if (pct === null) return "N/A";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

type DeltaDirection = "lower-is-better" | "higher-is-better" | "neutral";

interface StatCardProps {
  label: string;
  valueA: number;
  valueB: number;
  format: (n: number) => string;
  direction: DeltaDirection;
  icon: React.ReactNode;
}

function StatCard({ label, valueA, valueB, format, direction, icon }: StatCardProps) {
  const { delta, percent } = computeDelta(valueA, valueB);

  let colorClass = "text-muted-foreground";
  let DeltaIcon = Minus;

  if (direction !== "neutral" && Math.abs(delta) > 0) {
    const isBetter =
      (direction === "lower-is-better" && delta < 0) ||
      (direction === "higher-is-better" && delta > 0);
    colorClass = isBetter ? "text-green-400" : "text-red-400";
    DeltaIcon = delta < 0 ? TrendingDown : TrendingUp;
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          {icon}
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-sm font-mono">
          <span className="text-blue-400">{format(valueA)}</span>
          <span className="mx-2 text-muted-foreground">→</span>
          <span className="text-amber-400">{format(valueB)}</span>
        </div>
        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${colorClass}`}>
          <DeltaIcon className="h-3 w-3" />
          {formatPercent(percent)}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-node breakdown table
// ---------------------------------------------------------------------------

function NodeBreakdownTable({ eventsA, eventsB }: { eventsA: BenchmarkCollectorEvent[]; eventsB: BenchmarkCollectorEvent[] }) {
  const aggA = aggregateByNode(eventsA);
  const aggB = aggregateByNode(eventsB);
  const allNodes = new Set([...aggA.keys(), ...aggB.keys()]);

  if (allNodes.size === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Per-node breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold">Node</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-400">Calls A</th>
                <th className="px-3 py-2 text-right font-semibold text-amber-400">Calls B</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-400">Cost A</th>
                <th className="px-3 py-2 text-right font-semibold text-amber-400">Cost B</th>
                <th className="px-3 py-2 text-right font-semibold">Cost Δ%</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-400">Lat A</th>
                <th className="px-3 py-2 text-right font-semibold text-amber-400">Lat B</th>
                <th className="px-3 py-2 text-right font-semibold">Lat Δ%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...allNodes].map((node) => {
                const a = aggA.get(node);
                const b = aggB.get(node);
                const costDelta = computeDelta(a?.totalCost ?? 0, b?.totalCost ?? 0);
                const latDelta = computeDelta(a?.totalLatency ?? 0, b?.totalLatency ?? 0);

                return (
                  <tr key={node} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{node}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{a?.callCount ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-amber-400">{b?.callCount ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-mono">
                      {a ? formatCost(a.totalCost) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400 font-mono">
                      {b ? formatCost(b.totalCost) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      costDelta.delta < 0 ? "text-green-400" : costDelta.delta > 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {formatPercent(costDelta.percent)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-400 font-mono">
                      {a ? formatMs(a.totalLatency) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400 font-mono">
                      {b ? formatMs(b.totalLatency) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      latDelta.delta < 0 ? "text-green-400" : latDelta.delta > 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {formatPercent(latDelta.percent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-event diff list
// ---------------------------------------------------------------------------

function EventDiffList({ eventsA, eventsB }: { eventsA: BenchmarkCollectorEvent[]; eventsB: BenchmarkCollectorEvent[] }) {
  const pairs = pairEventsByNode(eventsA, eventsB);

  if (pairs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Event pairs ({pairs.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {pairs.map((pair, i) => {
            const onlyA = !pair.b;
            const onlyB = !pair.a;

            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20">
                <Badge variant="outline" className="text-[10px] shrink-0">{pair.node}</Badge>

                {onlyA && (
                  <span className="text-blue-400 italic ml-1">only in A</span>
                )}
                {onlyB && (
                  <span className="text-amber-400 italic ml-1">only in B</span>
                )}

                {pair.a && (
                  <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                    <span className="text-blue-400">{formatMs(pair.a.latencyMs)}</span>
                    <span className="text-blue-400">{formatCost(pair.a.costUsd)}</span>
                  </span>
                )}
                {pair.a && pair.b && (
                  <span className="text-muted-foreground">vs</span>
                )}
                {pair.b && (
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-amber-400">{formatMs(pair.b.latencyMs)}</span>
                    <span className="text-amber-400">{formatCost(pair.b.costUsd)}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Judge verdict display
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<string, string> = {
  factualAccuracy: "Factual Accuracy",
  proseQuality: "Prose Quality",
  structure: "Structure",
  poeDomainKnowledge: "PoE Domain Knowledge",
  antiHallucination: "Anti-Hallucination",
};

interface VerdictDisplayProps {
  evaluation: EvaluationForCompare;
  onRerun: () => void;
  rerunLoading: boolean;
}

function WinnerBadge({ winner }: { winner: "A" | "B" | "tie" | string | null }) {
  if (winner === "A") return <Badge className="bg-blue-600 text-white text-sm px-3 py-1">Run A wins</Badge>;
  if (winner === "B") return <Badge className="bg-amber-600 text-white text-sm px-3 py-1">Run B wins</Badge>;
  if (winner === "tie") return <Badge className="bg-zinc-600 text-white text-sm px-3 py-1">Tie</Badge>;
  return <Badge variant="outline" className="text-sm px-3 py-1">Inconclusive</Badge>;
}

function VerdictDisplay({ evaluation, onRerun, rerunLoading }: VerdictDisplayProps) {
  const verdict = evaluation.verdict as JudgeVerdict | JudgeErrorVerdict;

  // Error verdict case
  if ("error" in verdict) {
    const errVerdict = verdict as JudgeErrorVerdict;
    return (
      <ErrorVerdictCard raw={errVerdict.raw} error={errVerdict.error} onRerun={onRerun} rerunLoading={rerunLoading} />
    );
  }

  const v = verdict as JudgeVerdict;
  const confidenceColor: Record<string, string> = {
    low: "text-red-400",
    medium: "text-yellow-400",
    high: "text-green-400",
  };

  return (
    <div className="space-y-4">
      {/* Winner + meta */}
      <div className="flex items-center gap-4 flex-wrap">
        <WinnerBadge winner={evaluation.winner} />
        <span className={`text-sm font-semibold ${confidenceColor[v.confidence] ?? ""}`}>
          Confidence: {v.confidence}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Judge cost: {formatCost(evaluation.costUsd)} · {evaluation.judgeModel}
        </span>
      </div>

      {/* Dimension grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(v.dimensions).map(([key, dim]) => (
          <Card key={key} className="bg-muted/20">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {DIMENSION_LABELS[key] ?? key}
                </span>
                <WinnerBadge winner={dim.winner} />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{dim.rationale}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall rationale */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Overall rationale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/80 leading-relaxed">{v.overallRationale}</p>
        </CardContent>
      </Card>

      {/* Re-run button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onRerun}
          disabled={rerunLoading}
        >
          {rerunLoading ? (
            <><Spinner size="sm" ariaLabel="Re-running judge" className="mr-2" />Running...</>
          ) : (
            "Re-run (force)"
          )}
        </Button>
      </div>
    </div>
  );
}

interface ErrorVerdictCardProps {
  error: string;
  raw: string;
  onRerun: () => void;
  rerunLoading: boolean;
}

function ErrorVerdictCard({ error, raw, onRerun, rerunLoading }: ErrorVerdictCardProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-3">
      <Card className="border-destructive/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">Judge failed</span>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showRaw ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Raw judge output
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-muted/30 p-2 text-xs font-mono">
              {raw}
            </pre>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRerun} disabled={rerunLoading}>
          {rerunLoading ? (
            <><Spinner size="sm" ariaLabel="Re-running judge" className="mr-2" />Running...</>
          ) : (
            "Re-run (force)"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge section (no evaluation yet)
// ---------------------------------------------------------------------------

interface JudgeSectionEmptyProps {
  runAId: string;
  runBId: string;
  onEvaluationComplete: (evaluation: EvaluationForCompare) => void;
}

function JudgeSectionEmpty({ runAId, runBId, onEvaluationComplete }: JudgeSectionEmptyProps) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_JUDGE_MODEL);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startElapsedTimer() {
    setElapsedSeconds(0);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  }

  function stopElapsedTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => () => stopElapsedTimer(), []);

  async function handleRunJudge() {
    setLoading(true);
    startElapsedTimer();

    try {
      const res = await fetch(`/api/benchmark/runs/${runAId}/evaluate?b=${runBId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeModel: selectedModel }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Judge failed: ${data.error ?? res.statusText}`);
        return;
      }

      toast.success("Judge verdict ready");
      onEvaluationComplete(data as EvaluationForCompare);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Judge request failed: ${msg}`);
    } finally {
      setLoading(false);
      stopElapsedTimer();
      setElapsedSeconds(0);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted-foreground">
        No evaluation for this pair + model yet. Pick a judge model and run.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedModel} onValueChange={setSelectedModel} disabled={loading}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JUDGE_MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleRunJudge} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" ariaLabel="Running judge" className="mr-2" />
              Running... {elapsedSeconds > 0 ? `${elapsedSeconds}s` : ""}
            </>
          ) : (
            "Run judge"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge section (has evaluation, force re-run)
// ---------------------------------------------------------------------------

interface JudgeSectionWithEvalProps {
  runAId: string;
  runBId: string;
  evaluation: EvaluationForCompare;
  onEvaluationUpdate: (evaluation: EvaluationForCompare) => void;
}

function JudgeSectionWithEval({ runAId, runBId, evaluation, onEvaluationUpdate }: JudgeSectionWithEvalProps) {
  const [loading, setLoading] = useState(false);

  async function handleRerun() {
    setLoading(true);

    try {
      const res = await fetch(`/api/benchmark/runs/${runAId}/evaluate?b=${runBId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeModel: evaluation.judgeModel, force: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Re-run failed: ${data.error ?? res.statusText}`);
        return;
      }

      toast.success("Judge re-run complete");
      onEvaluationUpdate(data as EvaluationForCompare);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Re-run request failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return <VerdictDisplay evaluation={evaluation} onRerun={handleRerun} rerunLoading={loading} />;
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

/**
 * Full compare UI for two benchmark runs.
 * All server data is injected via props — no client-side fetching for the
 * initial render. Only the judge POST requires a network call.
 */
export function BenchmarkCompareClient({
  runA,
  runB,
  existingEvaluation,
}: BenchmarkCompareClientProps) {
  const [evaluation, setEvaluation] = useState<EvaluationForCompare | null>(existingEvaluation);
  const [showEvents, setShowEvents] = useState(false);

  const snapshotA = (runA.response as { telemetry?: BenchmarkSnapshot }).telemetry;
  const snapshotB = (runB.response as { telemetry?: BenchmarkSnapshot }).telemetry;
  const eventsA: BenchmarkCollectorEvent[] = snapshotA?.events ?? [];
  const eventsB: BenchmarkCollectorEvent[] = snapshotB?.events ?? [];

  const modelA = Object.entries(runA.modelOverrides).map(([k, v]) => `${k}: ${v}`).join(", ") || "default";
  const modelB = Object.entries(runB.modelOverrides).map(([k, v]) => `${k}: ${v}`).join(", ") || "default";

  const resultA = (runA.response as Record<string, unknown>)?.result;
  const resultB = (runB.response as Record<string, unknown>)?.result;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RunHeader run={runA} label="A" model={modelA} />
        <RunHeader run={runB} label="B" model={modelB} />
      </div>

      {/* ── Objective metrics ───────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Objective Metrics
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Cost"
            valueA={runA.totalCostUsd}
            valueB={runB.totalCostUsd}
            format={formatCost}
            direction="lower-is-better"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Duration"
            valueA={runA.totalDurationMs}
            valueB={runB.totalDurationMs}
            format={formatMs}
            direction="lower-is-better"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            label="LLM Calls"
            valueA={runA.llmCallCount}
            valueB={runB.llmCallCount}
            format={(n) => String(n)}
            direction="neutral"
            icon={<Zap className="h-4 w-4" />}
          />
          <StatCard
            label="Qdrant Queries"
            valueA={runA.qdrantQueryCount}
            valueB={runB.qdrantQueryCount}
            format={(n) => String(n)}
            direction="neutral"
            icon={<Database className="h-4 w-4" />}
          />
        </div>

        <NodeBreakdownTable eventsA={eventsA} eventsB={eventsB} />

        {/* Per-event diff — collapsible to avoid overwhelming the page */}
        {eventsA.length + eventsB.length > 0 && (
          <div>
            <button
              onClick={() => setShowEvents(!showEvents)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {showEvents ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Per-event pairs
            </button>
            {showEvents && <div className="mt-3"><EventDiffList eventsA={eventsA} eventsB={eventsB} /></div>}
          </div>
        )}
      </section>

      {/* ── Output diff ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Output Diff
        </h2>
        <CompareOutput resultA={resultA} resultB={resultB} type={runA.type} />
      </section>

      {/* ── Judge section ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            LLM Judge
          </h2>
          {evaluation && (
            <CheckCircle className="h-4 w-4 text-green-400" />
          )}
        </div>

        {evaluation ? (
          <JudgeSectionWithEval
            runAId={runA.id}
            runBId={runB.id}
            evaluation={evaluation}
            onEvaluationUpdate={setEvaluation}
          />
        ) : (
          <JudgeSectionEmpty
            runAId={runA.id}
            runBId={runB.id}
            onEvaluationComplete={setEvaluation}
          />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run header card
// ---------------------------------------------------------------------------

interface RunHeaderProps {
  run: RunForCompare;
  label: "A" | "B";
  model: string;
}

function RunHeader({ run, label, model }: RunHeaderProps) {
  const labelColor = label === "A" ? "text-blue-400 border-blue-700" : "text-amber-400 border-amber-700";

  return (
    <Card className={`border-l-4 ${label === "A" ? "border-l-blue-700" : "border-l-amber-700"}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg font-bold ${labelColor}`}>Run {label}</span>
          <Badge variant="outline" className="text-[10px]">{run.type}</Badge>
          {run.httpStatus >= 400 && (
            <Badge variant="destructive" className="text-[10px]">HTTP {run.httpStatus}</Badge>
          )}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground/70">Model: </span>
            <code className="font-mono">{model}</code>
          </div>
          {run.preset && (
            <div>
              <span className="font-semibold text-foreground/70">Preset: </span>
              {run.preset.name}
            </div>
          )}
          <div>
            <span className="font-semibold text-foreground/70">Date: </span>
            {formatDate(run.createdAt)}
          </div>
          {run.error && (
            <div className="text-destructive mt-1">Error: {run.error}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
