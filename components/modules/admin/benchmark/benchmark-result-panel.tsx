"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown, ChevronRight, Clock, DollarSign, Zap, Database, MessageSquareText } from "lucide-react";
import type {
  BenchmarkSnapshot,
  BenchmarkLlmEvent,
  BenchmarkQdrantEvent,
} from "@/lib/benchmark-types";

interface ResultPanelProps {
  result: BenchmarkSnapshot | null;
  loading: boolean;
  error: string | null;
  elapsedSeconds: number;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(6)}`;
}

function LlmEventRow({ ev, index }: { ev: BenchmarkLlmEvent; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <Badge variant="outline" className="text-[10px]">{ev.node}</Badge>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{ev.model.split("/").pop()}</span>
          <span>{ev.inputTokens + ev.outputTokens} tok</span>
          <span>{formatMs(ev.latencyMs)}</span>
          <span>{formatCost(ev.costUsd)}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-muted/20 px-4 py-3 text-xs">
          <div>
            <p className="mb-1 font-semibold text-muted-foreground">System Prompt</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-foreground/80">
              {ev.systemPrompt}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-semibold text-muted-foreground">User Message</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-foreground/80">
              {ev.userMessage}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-semibold text-muted-foreground">Response</p>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-foreground/80">
              {ev.response}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function QdrantEventRow({ ev, index }: { ev: BenchmarkQdrantEvent; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <Badge variant="secondary" className="text-[10px]">{ev.collection}</Badge>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{ev.resultCount} hits</span>
          <span>{formatMs(ev.durationMs)}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-muted/20 px-4 py-3 text-xs">
          {ev.queryText && (
            <div>
              <p className="mb-1 font-semibold text-muted-foreground">Query</p>
              <p className="font-mono text-foreground/80">{ev.queryText}</p>
            </div>
          )}
          <div>
            <p className="mb-1 font-semibold text-muted-foreground">
              Top chunks ({ev.chunks.length})
            </p>
            {ev.chunks.slice(0, 5).map((chunk, i) => (
              <div key={i} className="mb-1 rounded bg-muted/40 px-2 py-1">
                <span className="text-muted-foreground">score: {chunk.score.toFixed(4)} — </span>
                <span className="font-mono">
                  {JSON.stringify(chunk.payload).slice(0, 200)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final-output rendering — shape differs per endpoint (string answer for QA,
// array of ideas for ideation, object with sections for content-generation).
// Detected structurally; unknown shapes fall back to pretty-printed JSON.
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function FinalOutputBlock({ output }: { output: unknown }) {
  // Plain string answer (QA endpoint today returns { answer, cost }).
  if (typeof output === "string") {
    return (
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm leading-relaxed">
        {output}
      </pre>
    );
  }

  // Array of ideas / items (ideation).
  if (Array.isArray(output)) {
    return (
      <div className="space-y-2">
        {output.map((item, i) => (
          <div key={i} className="rounded bg-muted/30 p-3 text-sm">
            {typeof item === "string" ? (
              <span className="whitespace-pre-wrap">{item}</span>
            ) : (
              <pre className="whitespace-pre-wrap text-xs font-mono">
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(output)) {
    // QA: { answer, cost, ... } — show answer prominently.
    const answer = pickString(output, ["answer", "response", "text"]);
    if (answer && Object.keys(output).length <= 4) {
      return (
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm leading-relaxed">
          {answer}
        </pre>
      );
    }

    // Ideation object with { ideas: [...] }.
    if (Array.isArray(output.ideas)) {
      return <FinalOutputBlock output={output.ideas} />;
    }

    // Content-generation: render sections as labeled blocks.
    const sections =
      (isPlainObject(output.sections) && output.sections) ||
      (isPlainObject(output.content) && output.content) ||
      output;

    const entries = Object.entries(sections).filter(
      ([k]) => !["tokensUsed", "cost", "critiqueIssues", "totalCostUsd"].includes(k),
    );

    if (entries.length === 0) {
      return <PrettyJson value={output} />;
    }

    return (
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {key}
            </p>
            {typeof value === "string" ? (
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm leading-relaxed">
                {value}
              </pre>
            ) : (
              <PrettyJson value={value} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback (null, number, boolean, etc).
  return <PrettyJson value={output} />;
}

function PrettyJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs font-mono">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FinalOutputCard({ output }: { output: unknown }) {
  if (output === undefined || output === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          Resposta final
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FinalOutputBlock output={output} />
      </CardContent>
    </Card>
  );
}

function RawJsonPanel({ snapshot }: { snapshot: BenchmarkSnapshot }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-left text-sm font-semibold"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Raw JSON
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded bg-muted/30 p-3 text-xs font-mono">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Displays benchmark results in collapsible sections:
 * Summary → LLM Events → Qdrant Events → Raw JSON.
 * Also handles loading + error states.
 */
export function BenchmarkResultPanel({ result, loading, error, elapsedSeconds }: ResultPanelProps) {
  if (!loading && !error && !result) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <Spinner size="md" className="text-primary" ariaLabel="Executando benchmark" />
          <div>
            <p className="text-sm font-medium">Executando benchmark...</p>
            {elapsedSeconds > 0 && (
              <p className="text-xs text-muted-foreground">{elapsedSeconds}s decorridos</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-4">
          <p className="text-sm font-semibold text-destructive">Erro no benchmark</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const llmEvents = result.events.filter((e) => e.kind === "llm") as Array<
    { kind: "llm" } & BenchmarkLlmEvent
  >;
  const qdrantEvents = result.events.filter((e) => e.kind === "qdrant") as Array<
    { kind: "qdrant" } & BenchmarkQdrantEvent
  >;

  return (
    <div className="space-y-4">
      {/* Final LLM output — the actual answer / ideas / guide */}
      <FinalOutputCard output={result.finalOutput} />

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duração total</p>
                <p className="text-sm font-semibold">{formatMs(result.totalDurationMs)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="text-sm font-semibold">{formatCost(result.totalCostUsd)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">LLM calls</p>
                <p className="text-sm font-semibold">{result.llmCallCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Qdrant queries</p>
                <p className="text-sm font-semibold">{result.qdrantQueryCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM Events */}
      {llmEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              LLM Events ({llmEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {llmEvents.map((ev, i) => (
                <LlmEventRow key={i} ev={ev} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Qdrant Events */}
      {qdrantEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Qdrant Events ({qdrantEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {qdrantEvents.map((ev, i) => (
                <QdrantEventRow key={i} ev={ev} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw JSON — always last, collapsed by default */}
      <RawJsonPanel snapshot={result} />
    </div>
  );
}
