'use client';
/**
 * Slang Report right-rail widget.
 *
 * Ports the SlangReportCard (workspace/guides) into the editor right rail.
 * Data comes from EditorContext.slangReport — populated by the shell from
 * initialPost.slangReport when editing an existing post.
 *
 * Empty state when no report is available (new posts or engine Fase C not run).
 */

import React from 'react';
import { BookText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetShell } from './widget-shell';
import { useEditorContext } from '../editor-context';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SlangReport } from '@/lib/engine-types';

// ─── Sub-components ───────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

interface DensityBarProps {
  before: number;
  after: number | null;
  threshold: number;
}

function DensityBar({ before, after, threshold }: DensityBarProps) {
  const max = Math.max(threshold * 2, 1);
  const displayValue = after ?? before;
  const barWidth = Math.min((displayValue / max) * 100, 100);
  const thresholdPct = Math.min((threshold / max) * 100, 100);
  const aboveThreshold = displayValue >= threshold;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>
          Densidade: {(before * 100).toFixed(1)}%
          {after !== null && after !== before && (
            <>
              {' → '}
              <span className={aboveThreshold ? 'text-success' : 'text-warning'}>
                {(after * 100).toFixed(1)}%
              </span>
            </>
          )}
        </span>
        <span>threshold: {(threshold * 100).toFixed(1)}%</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', aboveThreshold ? 'bg-success' : 'bg-warning')}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${thresholdPct}%` }}
        />
      </div>
    </div>
  );
}

function ReportBody({ report }: { report: SlangReport }) {
  const injectedCount = report.termsInjected.length;
  return (
    <div className="px-4 pb-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge variant={report.injected ? 'success' : 'neutral'}>
          {report.injected ? 'Slang injetado' : 'Nenhum slang injetado'}
        </StatusBadge>
        <span className="ml-auto text-xs text-muted-foreground">
          {injectedCount} de {report.termsAvailable} termos
        </span>
      </div>

      <DensityBar
        before={report.densityBefore}
        after={report.densityAfter}
        threshold={report.densityThreshold}
      />

      {/* Injected terms badges */}
      {injectedCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {report.termsInjected.map((term) => (
            <span
              key={term}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
                         bg-foreground/8 text-muted-foreground border border-border"
            >
              {term}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-border text-[11px] text-muted-foreground">
        Custo injeção: {formatUsd(report.injectionCostUsd)}
      </div>
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function SlangReportWidget() {
  const { slangReport } = useEditorContext();

  return (
    <WidgetShell id="slang-report" icon={BookText} title="Slang Report">
      {slangReport ? (
        <ReportBody report={slangReport} />
      ) : (
        <p className="px-4 pb-4 text-xs text-zinc-500 leading-relaxed">
          Sem relatório de slang — gerado pelo engine após Fase C.
        </p>
      )}
    </WidgetShell>
  );
}
