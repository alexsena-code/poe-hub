"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { QaBenchmarkForm } from "./qa-benchmark-form";
import { IdeationBenchmarkForm } from "./ideation-benchmark-form";
import { ContentGenBenchmarkForm } from "./content-gen-benchmark-form";
import { BenchmarkResultPanel } from "./benchmark-result-panel";
import { useBenchmarkRunner } from "./use-benchmark-runner";
import type {
  QaBenchmarkRequest,
  IdeationBenchmarkRequest,
  ContentGenBenchmarkRequest,
  BenchmarkSnapshot,
} from "@/lib/benchmark-types";

// ─── Run persistence ──────────────────────────────────────────────────────────

type BenchmarkEndpointType = "qa" | "ideation" | "content_generation";

interface PersistRunInput {
  type: BenchmarkEndpointType;
  presetId: string | undefined;
  requestBody: unknown;
  snapshot: BenchmarkSnapshot | null;
  httpStatus: number;
  error: string | null;
}

/** Maps the route segment to the DB enum expected by /api/benchmark/runs. */
const ROUTE_TO_TYPE: Record<string, BenchmarkEndpointType> = {
  qa: "qa",
  ideation: "ideation",
  "content-generation": "content_generation",
};

/**
 * POSTs a completed run to /api/benchmark/runs for history persistence.
 * Errors here are non-blocking — just warns so a DB blip doesn't hide the result.
 */
async function persistRun(input: PersistRunInput): Promise<string | null> {
  try {
    const res = await fetch("/api/benchmark/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: input.type,
        presetId: input.presetId ?? null,
        requestBody: input.requestBody,
        response: input.snapshot ?? null,
        httpStatus: input.httpStatus,
        error: input.error ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(`[benchmark-client] persistRun failed: ${res.status} — ${text.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  } catch (err) {
    console.warn("[benchmark-client] persistRun threw:", err);
    return null;
  }
}

// ─── Client shell ─────────────────────────────────────────────────────────────

/**
 * Client shell for /admin/benchmark.
 * Owns the active tab + delegates run state to useBenchmarkRunner.
 * After each run (success or failure), persists to /api/benchmark/runs
 * and shows a toast with a link to the history entry.
 */
export function BenchmarkClient() {
  const { loading, error, result, elapsedSeconds, run, reset } = useBenchmarkRunner();
  const [activeTab, setActiveTab] = useState("qa");

  // Tracks the preset that triggered the most recent run for persistence.
  const activePresetId = useRef<string | undefined>(undefined);
  // Tracks the raw request body for persistence.
  const activeRequestBody = useRef<unknown>(null);
  // Tracks the current route endpoint string.
  const activeEndpoint = useRef<string>("qa");

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    // Reset result when switching tabs to avoid showing stale data
    // from a different endpoint.
    reset();
  }

  async function executeRun(endpoint: string, body: unknown, presetId?: string) {
    activeEndpoint.current = endpoint;
    activeRequestBody.current = body;
    activePresetId.current = presetId;

    await run(endpoint, body);
  }

  // After the run completes or errors, persist and show toast.
  // We derive success/failure from the runner's state after `run` resolves.
  async function afterRun(endpoint: string, body: unknown, presetId: string | undefined) {
    const type = ROUTE_TO_TYPE[endpoint] ?? "qa";
    // `result` and `error` from the hook reflect the just-completed run state.
    // The run() promise resolves once loading is false, so these values are settled.
    const runId = await persistRun({
      type,
      presetId,
      requestBody: body,
      snapshot: result,
      httpStatus: error ? 500 : 200,
      error: error ?? null,
    });

    if (runId) {
      toast.success("Run salvo", {
        description: "Histórico atualizado",
        action: {
          label: "Ver histórico",
          onClick: () => {
            window.location.href = `/admin/benchmark/history#run-${runId}`;
          },
        },
      });
    }
  }

  async function handleQaRun(body: QaBenchmarkRequest, presetId?: string) {
    await executeRun("qa", body, presetId);
    await afterRun("qa", body, presetId);
  }

  async function handleIdeationRun(body: IdeationBenchmarkRequest, presetId?: string) {
    await executeRun("ideation", body, presetId);
    await afterRun("ideation", body, presetId);
  }

  async function handleContentGenRun(body: ContentGenBenchmarkRequest, presetId?: string) {
    await executeRun("content-generation", body, presetId);
    await afterRun("content-generation", body, presetId);
  }

  return (
    <div className="space-y-6">
      {/* History link — replaces the old stale carryover notice */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Runs são persistidos no banco de dados.{" "}
            <a
              href="/admin/benchmark/history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver histórico de runs
            </a>
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="qa">QA</TabsTrigger>
          <TabsTrigger value="ideation">Ideation</TabsTrigger>
          <TabsTrigger value="content-generation">Content Generation</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="qa">
            <QaBenchmarkForm loading={loading} onRun={handleQaRun} />
          </TabsContent>

          <TabsContent value="ideation">
            <IdeationBenchmarkForm loading={loading} onRun={handleIdeationRun} />
          </TabsContent>

          <TabsContent value="content-generation">
            <ContentGenBenchmarkForm
              loading={loading}
              elapsedSeconds={elapsedSeconds}
              onRun={handleContentGenRun}
            />
          </TabsContent>
        </div>
      </Tabs>

      <BenchmarkResultPanel
        result={result}
        loading={loading}
        error={error}
        elapsedSeconds={elapsedSeconds}
      />
    </div>
  );
}
