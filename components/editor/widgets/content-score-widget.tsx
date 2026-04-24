'use client';
/**
 * Content Score right-rail widget.
 *
 * Ports the ContentScoreCard (workspace/guides) into the editor right rail.
 * Data comes from EditorContext.contentScore — populated by the shell from
 * initialPost.contentScore when editing an existing post.
 *
 * Empty state shown when no score is available (new posts, drafts not yet
 * processed by the engine's Fase C pipeline).
 */

import React from 'react';
import { Gauge } from 'lucide-react';
import { WidgetShell } from './widget-shell';
import { useEditorContext } from '../editor-context';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StatusBadgeVariant } from '@/components/ui/status-badge';
import type { ContentScoreReport } from '@/lib/engine-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreVariant(value: number): StatusBadgeVariant {
  if (value >= 80) return 'success';
  if (value >= 60) return 'warning';
  return 'danger';
}

function formatUsd(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreDelta({ before, after }: { before: number; after: number | null }) {
  if (after === null) return null;
  const delta = after - before;
  const sign = delta >= 0 ? '+' : '';
  return (
    <span className="text-xs text-muted-foreground ml-2">
      {before} → {after}{' '}
      <span className={delta >= 0 ? 'text-success' : 'text-destructive'}>
        ({sign}{delta})
      </span>
    </span>
  );
}

interface CollapseListProps {
  label: string;
  items: string[];
}

function CollapseList({ label, items }: CollapseListProps) {
  if (items.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
        {label} ({items.length})
      </summary>
      <ul className="mt-1.5 space-y-0.5 pl-3">
        {items.map((item) => (
          <li key={item} className="text-xs text-muted-foreground list-disc ml-2">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ScoreBody({ score }: { score: ContentScoreReport }) {
  const displayScore = score.scoreAfter ?? score.scoreBefore;
  return (
    <div className="px-4 pb-4 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <StatusBadge variant={scoreVariant(displayScore)} className="text-sm px-3 py-1">
            {displayScore}
          </StatusBadge>
          {score.filled && (
            <ScoreDelta before={score.scoreBefore} after={score.scoreAfter} />
          )}
        </div>
        <span className="text-xs text-muted-foreground">threshold: {score.threshold}</span>
      </div>

      {/* Status */}
      <p className="text-xs text-muted-foreground">
        {score.filled
          ? 'Gap-fill aplicado — score melhorado com entidades/headings ausentes.'
          : 'Gap-fill não aplicado.'}
      </p>

      {/* Collapsible missing items */}
      <CollapseList label="Entidades ausentes" items={score.missingEntities} />
      <CollapseList label="Headings ausentes" items={score.missingHeadings} />

      {/* Footer */}
      <div className="pt-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        <span>Custo: {formatUsd(score.gapFillCostUsd)}</span>
        <span className="w-px h-3 bg-border" />
        <span>
          {score.analysisStaleDays === 0
            ? 'Análise atual'
            : `${score.analysisStaleDays}d atrás`}
        </span>
        <span className="w-px h-3 bg-border" />
        <span className="font-mono opacity-60">{score.analysisId}</span>
      </div>
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function ContentScoreWidget() {
  const { contentScore } = useEditorContext();

  return (
    <WidgetShell id="content-score" icon={Gauge} title="Content Score">
      {contentScore ? (
        <ScoreBody score={contentScore} />
      ) : (
        <p className="px-4 pb-4 text-xs text-zinc-500 leading-relaxed">
          Sem score ainda — score é gerado pelo engine após salvar.
        </p>
      )}
    </WidgetShell>
  );
}
