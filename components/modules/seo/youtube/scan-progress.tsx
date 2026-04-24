'use client';

// ---------------------------------------------------------------------------
// ScanProgress — streaming progress bar shown during Smart Scan
// ---------------------------------------------------------------------------

import React, { useState } from 'react';

const SCAN_STEPS = [
  { key: 'start', label: 'Starting' },
  { key: 'fetch', label: 'RSS Fetch' },
  { key: 'classify', label: 'AI Classification' },
  { key: 'transcripts', label: 'Transcripts' },
  { key: 'keywords', label: 'Keyword Extraction' },
  { key: 'ingest', label: 'Qdrant + Slang' },
  { key: 'validate', label: 'Cross-Validation' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'qdrant', label: 'DB Validation' },
  { key: 'done', label: 'Complete' },
];

interface Props {
  step: string | null;
  logs: Array<{ step: string; message: string }>;
  running: boolean;
}

export function ScanProgress({ step, logs, running }: Props) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll log container to bottom as new logs arrive
  React.useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs.length, expanded]);

  // When expanding, scroll the whole page so the progress bar is visible
  React.useEffect(() => {
    if (expanded && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [expanded]);

  const currentIdx = SCAN_STEPS.findIndex((s) => s.key === step);
  const progress =
    step === 'done' || !running
      ? 100
      : Math.max(5, Math.round(((currentIdx + 1) / SCAN_STEPS.length) * 100));

  return (
    <div ref={containerRef} className="mb-4 bg-surface border border-border rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-muted-foreground">
            {running
              ? SCAN_STEPS.find((s) => s.key === step)?.label || 'Processing...'
              : 'Scan complete'}
          </span>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${running ? 'bg-purple-500' : 'bg-emerald-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {SCAN_STEPS.filter((s) => s.key !== 'start').map((s) => {
          const idx = SCAN_STEPS.findIndex((x) => x.key === s.key);
          const isDone = currentIdx > idx || (!running && logs.length > 0);
          const isCurrent = s.key === step;
          return (
            <span
              key={s.key}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                isCurrent
                  ? 'bg-purple-500/30 text-purple-300'
                  : isDone
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-foreground/5 text-muted-foreground/50'
              }`}
            >
              {s.label}
            </span>
          );
        })}
      </div>

      {/* Log viewer toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-1.5 text-[10px] text-muted-foreground hover:text-foreground border-t border-border/50 transition-colors text-left"
      >
        {expanded ? 'Hide logs' : `Show logs (${logs.length} lines)`}
      </button>

      {/* Log lines */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto bg-background px-4 py-2 border-t border-border/50 font-mono text-[10px] leading-relaxed">
          {logs.map((log, i) => (
            <div key={i} className={log.step === 'done' ? 'text-emerald-400' : 'text-muted-foreground'}>
              {log.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
