"use client";

import { useState } from "react";

// Session 04 S04.a — extracted from /workspace/guides/[slug]/log/page.tsx
// as a client island. Receives pre-fetched LogResponse from RSC parent and
// manages only the expand/collapse interaction state.

type EventNode =
  | "classify"
  | "plan"
  | "research"
  | "analyze"
  | "gap_check"
  | "write"
  | "critique"
  | "fix"
  | "optimize";

type EventKind = "started" | "completed" | "skipped" | "failed" | "info";

interface GenEvent {
  timestamp: string;
  node: EventNode;
  kind: EventKind;
  sectionId?: string;
  message: string;
  details?: Record<string, unknown>;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface LogResponse {
  slug: string;
  title: { "pt-br": string; en: string };
  generatedAt: string;
  template: string;
  events: GenEvent[];
  totals: { durationMs: number; tokensUsed: number; costUsd: number };
  eventCount: number;
}

const NODE_COLORS: Record<EventNode, string> = {
  classify: "bg-purple-500",
  plan: "bg-cyan-500",
  research: "bg-blue-500",
  analyze: "bg-teal-500",
  gap_check: "bg-amber-500",
  write: "bg-green-500",
  critique: "bg-orange-500",
  fix: "bg-pink-500",
  optimize: "bg-indigo-500",
};

const KIND_BADGE: Record<EventKind, string> = {
  started: "bg-blue-500/20 text-blue-300",
  completed: "bg-green-500/20 text-green-300",
  skipped: "bg-muted/20 text-muted-foreground",
  failed: "bg-red-500/20 text-red-300",
  info: "bg-foreground/20 text-foreground",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

interface LogTimelineProps {
  log: LogResponse;
}

export function LogTimeline({ log }: LogTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (log.events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhum evento registrado. Posts gerados antes desta feature não têm log.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-border ml-4">
      {log.events.map((event, idx) => {
        const isExpanded = expanded.has(idx);
        const hasDetails = event.details && Object.keys(event.details).length > 0;

        return (
          <li key={idx} className="mb-4 ml-6">
            <span
              className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ${NODE_COLORS[event.node]}`}
            />

            <div className="rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {event.node}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${KIND_BADGE[event.kind]}`}>
                  {event.kind}
                </span>
                {event.sectionId && (
                  <span className="text-[10px] text-muted-foreground font-mono bg-background/60 px-2 py-0.5 rounded">
                    {event.sectionId}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                  {new Date(event.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              <p className="text-sm text-foreground mb-2">{event.message}</p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {event.durationMs !== undefined && (
                  <span>{formatDuration(event.durationMs)}</span>
                )}
                {event.tokensUsed !== undefined && event.tokensUsed > 0 && (
                  <span>{event.tokensUsed.toLocaleString("pt-BR")} tokens</span>
                )}
                {event.costUsd !== undefined && event.costUsd > 0 && (
                  <span>{formatCost(event.costUsd)}</span>
                )}
                {hasDetails && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="ml-auto text-foreground hover:underline"
                  >
                    {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                )}
              </div>

              {isExpanded && hasDetails && (
                <pre className="mt-3 text-[11px] text-foreground/80 bg-background rounded p-3 overflow-x-auto font-mono border border-border">
                  {JSON.stringify(event.details, null, 2)}
                </pre>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
