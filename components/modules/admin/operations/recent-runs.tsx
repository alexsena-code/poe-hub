'use client';

// ---------------------------------------------------------------------------
// RecentRuns — table of the last 20 PipelineRun rows (auto-refreshes via
// the parent useOperations hook). Click a row to expand the JSON result.
// ---------------------------------------------------------------------------

import { Fragment, useState } from 'react';
import type { PipelineRun } from './types';

interface RecentRunsProps {
  runs: PipelineRun[];
  loading: boolean;
}

export function RecentRuns({ runs, loading }: RecentRunsProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Loading recent runs…
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No pipeline runs yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="py-2 pr-3">Pipeline</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Started</th>
            <th className="py-2 pr-3 text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const open = expanded === run.id;
            return (
              <Fragment key={run.id}>
                <tr
                  onClick={() => setExpanded(open ? null : run.id)}
                  className="border-b border-border/50 hover:bg-white/[0.02] cursor-pointer"
                >
                  <td className="py-2 pr-3 text-foreground font-mono text-xs">{run.name}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground text-xs">
                    {formatTime(run.startedAt)}
                  </td>
                  <td className="py-2 pr-3 text-right text-muted-foreground font-mono text-xs">
                    {formatDuration(run.durationMs)}
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-border/50 bg-black/20">
                    <td colSpan={4} className="py-2 px-3">
                      {run.error && (
                        <div className="text-red-400 text-xs mb-2">Error: {run.error}</div>
                      )}
                      <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-64 overflow-auto">
                        {JSON.stringify(run.result ?? {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const cls =
    lower === 'completed' || lower === 'success'
      ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40'
      : lower === 'running' || lower === 'started'
        ? 'bg-orange-900/30 text-orange-300 border-orange-800/40'
        : lower === 'failed' || lower === 'error'
          ? 'bg-red-900/30 text-red-300 border-red-800/40'
          : 'bg-zinc-800/50 text-zinc-300 border-zinc-700/40';
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded ${cls}`}>
      {status}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
