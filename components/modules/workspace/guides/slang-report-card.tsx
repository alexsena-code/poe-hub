import type { SlangReport } from "@/lib/content-api";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface SlangReportCardProps {
  report: SlangReport;
}

function formatUsd(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

function DensityBar({
  before,
  after,
  threshold,
}: {
  before: number;
  after: number | null;
  threshold: number;
}) {
  // Clamp to [0, max(threshold*2, 1)] to avoid overflows on the visual bar
  const max = Math.max(threshold * 2, 1);
  const displayValue = after ?? before;
  const barWidth = Math.min((displayValue / max) * 100, 100);
  const thresholdPct = Math.min((threshold / max) * 100, 100);
  const aboveThreshold = displayValue >= threshold;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>
          Densidade: {(before * 100).toFixed(1)}%
          {after !== null && after !== before && (
            <> → <span className={aboveThreshold ? "text-success" : "text-warning"}>
              {(after * 100).toFixed(1)}%
            </span></>
          )}
        </span>
        <span>threshold: {(threshold * 100).toFixed(1)}%</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        {/* Filled bar */}
        <div
          className={cn(
            "h-full rounded-full transition-all",
            aboveThreshold ? "bg-success" : "bg-warning",
          )}
          style={{ width: `${barWidth}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${thresholdPct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Displays the SlangReport returned by engine session 21 Fase C.
 * Shows injection status, term counts, density bar, injected term badges,
 * and cost.
 *
 * Rendered only when `post.slangReport` is present in `PostDetail`.
 */
export function SlangReportCard({ report }: SlangReportCardProps) {
  const injectedCount = report.termsInjected.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-foreground">Slang Report</span>
        <StatusBadge variant={report.injected ? "success" : "neutral"}>
          {report.injected ? "Slang injetado" : "Nenhum slang injetado"}
        </StatusBadge>
        <span className="ml-auto text-xs text-muted-foreground">
          {injectedCount} de {report.termsAvailable} termos injetados
        </span>
      </div>

      {/* Density bar */}
      <DensityBar
        before={report.densityBefore}
        after={report.densityAfter}
        threshold={report.densityThreshold}
      />

      {/* Injected terms */}
      {injectedCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
      <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
        Custo injeção: {formatUsd(report.injectionCostUsd)}
      </div>
    </div>
  );
}
