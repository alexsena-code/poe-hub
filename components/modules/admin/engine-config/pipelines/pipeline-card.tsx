'use client';

// Renders a single pipeline entry: header (name + status + run button),
// optional config fields, progress bar, log viewer, result summary, and error.

import { PipelineDefinition, PipelineState, STEP_COLORS } from './types';
import { PipelineStatusBadge } from './pipeline-status-badge';
import { PipelineResultSummary } from './pipeline-result-summary';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

interface PipelineCardProps {
  pipeline: PipelineDefinition;
  state: PipelineState;
  cfg: Record<string, unknown>;
  logEndRef: (el: HTMLDivElement | null) => void;
  onRun: () => void;
  onConfigChange: (key: string, value: unknown) => void;
}

export function PipelineCard({ pipeline, state, cfg, logEndRef, onRun, onConfigChange }: PipelineCardProps) {
  const elapsed = state.startedAt
    ? ((state.finishedAt ?? Date.now()) - state.startedAt) / 1000
    : 0;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-foreground">{pipeline.name}</h3>
            <PipelineStatusBadge status={state.status} />
            {state.status === 'running' && state.step && (
              <span className="text-[10px] text-muted-foreground font-mono">{state.step}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {elapsed > 0 && (
              <span className="text-xs font-mono text-muted-foreground">{formatElapsed(elapsed)}</span>
            )}
            <button
              onClick={onRun}
              disabled={state.status === 'running'}
              className="px-3 py-1.5 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {state.status === 'running' ? 'Executando...' : 'Executar'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{pipeline.description}</p>

        {/* Config fields */}
        {pipeline.configFields.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {pipeline.configFields.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</label>
                {f.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!cfg[f.key]}
                    onChange={(e) => onConfigChange(f.key, e.target.checked)}
                    disabled={state.status === 'running'}
                    className="accent-foreground"
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={String(cfg[f.key] ?? f.default)}
                    onChange={(e) => onConfigChange(f.key, e.target.value)}
                    disabled={state.status === 'running'}
                    className="w-auto min-w-[80px] bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress bar for poll-mode pipelines */}
        {state.status === 'running' && state.progress !== undefined && state.progress > 0 && (
          <div className="mt-3 w-full bg-background rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, state.progress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Log viewer */}
      {state.logs.length > 0 && (
        <div className="border-t border-border bg-background/50">
          <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-5 p-3">
            {state.logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{log.time}</span>
                <span className={`shrink-0 w-20 text-right ${STEP_COLORS[log.step] ?? 'text-muted-foreground'}`}>
                  [{log.step}]
                </span>
                <span className="text-foreground/80 break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Result summary */}
      {state.status === 'done' && state.result != null && (
        <PipelineResultSummary pipelineId={pipeline.id} result={state.result} />
      )}

      {/* Error display */}
      {state.status === 'error' && state.error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2">
          <span className="text-xs text-red-400">{state.error}</span>
        </div>
      )}
    </div>
  );
}
