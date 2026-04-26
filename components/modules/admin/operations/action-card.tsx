'use client';

// ---------------------------------------------------------------------------
// ActionCard — single tile for one Operations action (crawl/pipeline/etc.).
// Shows title + description + Run button + live status (when polling) + last
// result/error toast row.
// ---------------------------------------------------------------------------

import type { Action } from './types';
import type { ActionState } from './use-operations';

interface ActionCardProps {
  action: Action;
  state: ActionState;
  onRun: () => void;
}

export function ActionCard({ action, state, onRun }: ActionCardProps) {
  const { running, lastError, lastResult, status } = state;

  return (
    <div className="border border-border rounded-lg p-3 bg-surface flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{action.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            running
              ? 'bg-orange-900/30 border-orange-800/50 text-orange-300 cursor-not-allowed'
              : 'bg-emerald-900/20 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40'
          }`}
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* Live progress bar (only while a poll-able action is running). */}
      {running && status && typeof status.progress === 'number' && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">{status.step ?? 'working…'}</span>
            <span className="text-[10px] text-muted-foreground">{status.progress}%</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Live logs tail — last 4 lines. */}
      {running && status?.logs && status.logs.length > 0 && (
        <pre className="text-[10px] font-mono bg-black/30 border border-border/50 rounded p-2 max-h-24 overflow-auto whitespace-pre-wrap text-muted-foreground">
          {status.logs.slice(-4).join('\n')}
        </pre>
      )}

      {/* Final result / error toast row. */}
      {!running && lastError && (
        <div className="text-[11px] text-red-400">Failed: {lastError}</div>
      )}
      {!running && lastResult && !lastError && (
        <div className="text-[11px] text-emerald-400">{lastResult}</div>
      )}
    </div>
  );
}
