import type { ContentScoreReport } from "@/lib/content-api";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";

interface ContentScoreCardProps {
  score: ContentScoreReport;
}

function scoreVariant(value: number): StatusBadgeVariant {
  if (value >= 80) return "success";
  if (value >= 60) return "warning";
  return "danger";
}

function formatUsd(amount: number): string {
  // Small amounts like $0.0023 — use 4 decimal places to avoid showing $0.00
  return amount < 0.01
    ? `$${amount.toFixed(4)}`
    : `$${amount.toFixed(2)}`;
}

function ScoreDelta({
  before,
  after,
}: {
  before: number;
  after: number | null;
}) {
  if (after === null) return null;
  const delta = after - before;
  const sign = delta >= 0 ? "+" : "";
  return (
    <span className="text-xs text-muted-foreground ml-2">
      {before} → {after}{" "}
      <span className={delta >= 0 ? "text-success" : "text-destructive"}>
        ({sign}{delta})
      </span>
    </span>
  );
}

function CollapseList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
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

/**
 * Displays the ContentScore gap-fill report returned by engine session 21
 * Fase C. Shows the final score (with optional before→after delta), threshold
 * reference, and collapsible lists of missing entities/headings.
 *
 * Rendered only when `post.contentScore` is present in `PostDetail`.
 */
export function ContentScoreCard({ score }: ContentScoreCardProps) {
  const displayScore = score.scoreAfter ?? score.scoreBefore;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Content Score</span>
          <StatusBadge variant={scoreVariant(displayScore)} className="text-sm px-3 py-1">
            {displayScore}
          </StatusBadge>
          {score.filled && (
            <ScoreDelta before={score.scoreBefore} after={score.scoreAfter} />
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          threshold: {score.threshold}
        </span>
      </div>

      {/* Status line */}
      <p className="mt-2 text-xs text-muted-foreground">
        {score.filled
          ? "Gap-fill aplicado — score melhorado com entidades/headings ausentes."
          : "Gap-fill não aplicado."}
      </p>

      {/* Missing items (collapsible) */}
      <div className="mt-1">
        <CollapseList label="Entidades ausentes" items={score.missingEntities} />
        <CollapseList label="Headings ausentes" items={score.missingHeadings} />
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>Custo gap-fill: {formatUsd(score.gapFillCostUsd)}</span>
        <span className="w-px h-3 bg-border" />
        <span>
          Análise {score.analysisStaleDays === 0
            ? "atual"
            : `${score.analysisStaleDays}d atrás`}
        </span>
        <span className="w-px h-3 bg-border" />
        <span className="font-mono opacity-60">{score.analysisId}</span>
      </div>
    </div>
  );
}
