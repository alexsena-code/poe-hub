'use client';

import type { BriefSource } from './types';

interface BriefSourceSummaryProps {
  briefIdParam: string | null;
  briefLoading: boolean;
  briefSource: BriefSource | null;
}

// Card shown when arriving via /workspace/new?briefId=X.
// - While loading: skeleton text.
// - After hydrated: emerald card with expandable briefingText.
// - If brief has no expanded text: soft disclaimer so author knows
//   only rationale + keywords will be injected.
export function BriefSourceSummary({ briefIdParam, briefLoading, briefSource }: BriefSourceSummaryProps) {
  if (briefLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        Carregando brief #{briefIdParam}...
      </div>
    );
  }

  if (!briefSource) return null;

  return (
    <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-200">
          Brief #{briefSource.id} carregado
        </span>
        <span className="text-[10px] text-emerald-200/60">
          será injetado automaticamente no briefing
        </span>
      </div>
      {briefSource.briefingText ? (
        <details className="text-xs text-emerald-100/80">
          <summary className="cursor-pointer select-none text-emerald-200/80 hover:text-emerald-100">
            Ver briefing expandido
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-emerald-100/70">
            {briefSource.briefingText}
          </pre>
        </details>
      ) : (
        <p className="text-[11px] text-emerald-200/60">
          (Este brief não tem briefing expandido; só rationale + keywords serão usados.)
        </p>
      )}
    </div>
  );
}
