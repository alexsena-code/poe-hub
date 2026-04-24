"use client";

import { useState } from "react";
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
} from "@/lib/benchmark-types";

// TODO(S06.d carryover): listing endpoint not implemented on engine.
// Runs are persisted in engine's scripts/benchmark/runs/ (gitignored).
// To inspect past runs: `ls ../path-of-trade-content/scripts/benchmark/runs/`
// Track in: https://github.com/path-of-trade/hub/issues/XXX when listing is added.

/**
 * Client shell for /admin/benchmark.
 * Owns the active tab + delegates run state to useBenchmarkRunner.
 */
export function BenchmarkClient() {
  const { loading, error, result, elapsedSeconds, run, reset } = useBenchmarkRunner();
  const [activeTab, setActiveTab] = useState("qa");

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    // Reset result when switching tabs to avoid showing stale data
    // from a different endpoint.
    reset();
  }

  function handleQaRun(body: QaBenchmarkRequest) {
    run("qa", body);
  }

  function handleIdeationRun(body: IdeationBenchmarkRequest) {
    run("ideation", body);
  }

  function handleContentGenRun(body: ContentGenBenchmarkRequest) {
    run("content-generation", body);
  }

  return (
    <div className="space-y-6">
      {/* Carryover notice — no listing endpoint on engine */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Runs disparados daqui executam na API do engine. Responses aparecem abaixo.{" "}
            Histórico persistido em disk no engine (
            <code className="rounded bg-muted px-1 text-xs">
              scripts/benchmark/runs/
            </code>
            ). Listing via HTTP é carryover — hoje use{" "}
            <code className="rounded bg-muted px-1 text-xs">
              ls ../path-of-trade-content/scripts/benchmark/runs/
            </code>{" "}
            no engine.
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
