'use client';

import type { CritiqueIssue, CritiqueSeverity, CritiqueIssueType } from '@/lib/engine-types';

interface IssueBannerProps {
  issues: CritiqueIssue[];
  dismissedIds: string[];
  collapsed: boolean;
  fixingIds: string[];
  onDismiss: (id: string) => void;
  onFix: (ids: string[]) => void;
  onToggleCollapse: (collapsed: boolean) => void;
  onClearAll: () => void;
}

const severityStyles: Record<CritiqueSeverity, { chip: string; dot: string; label: string }> = {
  high: {
    chip: 'bg-red-500/10 border-red-500/30 text-red-300',
    dot: 'bg-red-500',
    label: 'HIGH',
  },
  medium: {
    chip: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    dot: 'bg-amber-500',
    label: 'MEDIUM',
  },
  low: {
    chip: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    dot: 'bg-blue-500',
    label: 'LOW',
  },
};

const typeLabel: Record<CritiqueIssueType, string> = {
  factual: 'Factual',
  instruction: 'Instrução',
  completeness: 'Completude',
  invented: 'Inventado',
  banned_phrase: 'Frase banida',
};

export default function IssueBanner({
  issues,
  dismissedIds,
  collapsed,
  fixingIds,
  onDismiss,
  onFix,
  onToggleCollapse,
  onClearAll,
}: IssueBannerProps) {
  if (issues.length === 0) return null;

  const activeIssues = issues.filter((i) => !dismissedIds.includes(i.id));
  const highCount = activeIssues.filter((i) => i.severity === 'high').length;
  const totalActive = activeIssues.length;

  const headerColor =
    highCount > 0
      ? 'bg-red-500/5 border-red-500/30'
      : totalActive > 0
        ? 'bg-amber-500/5 border-amber-500/30'
        : 'bg-green-500/5 border-green-500/30';

  return (
    <div className={`mb-4 rounded-lg border ${headerColor}`}>
      <button
        onClick={() => onToggleCollapse(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left"
      >
        <span className="text-sm font-semibold text-foreground">
          {totalActive > 0
            ? `${totalActive} issue${totalActive > 1 ? 's' : ''} detectada${totalActive > 1 ? 's' : ''}`
            : 'Todas issues tratadas'}
        </span>
        {highCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
            {highCount} alta{highCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{collapsed ? 'Expandir' : 'Recolher'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-2">
          {totalActive > 0 && (
            <div className="flex gap-2 pb-2 border-b border-border">
              <button
                onClick={() => onFix(activeIssues.map((i) => i.id))}
                disabled={fixingIds.length > 0}
                className="px-3 py-1.5 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {fixingIds.length > 0 ? 'Corrigindo...' : 'Corrigir todas com AI'}
              </button>
              <button
                onClick={onClearAll}
                disabled={fixingIds.length > 0}
                className="px-3 py-1.5 rounded border border-border text-muted-foreground text-xs hover:text-foreground transition-colors disabled:opacity-50"
              >
                Ignorar todas
              </button>
            </div>
          )}

          {issues.map((issue) => {
            const dismissed = dismissedIds.includes(issue.id);
            const fixing = fixingIds.includes(issue.id);
            const style = severityStyles[issue.severity];

            return (
              <div
                key={issue.id}
                className={`rounded border px-3 py-2 ${style.chip} ${dismissed ? 'opacity-40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 inline-block w-2 h-2 rounded-full ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold tracking-wider">{style.label}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {typeLabel[issue.type]}
                      </span>
                      {dismissed && (
                        <span className="text-[10px] italic opacity-70">(ignorada)</span>
                      )}
                    </div>
                    <p className={`text-sm text-foreground mt-0.5 ${dismissed ? 'line-through' : ''}`}>
                      {issue.message}
                    </p>
                    {issue.span && !dismissed && (
                      <p className="text-xs text-muted-foreground mt-1 italic bg-background/40 rounded px-2 py-1 font-mono">
                        &quot;{issue.span.slice(0, 140)}
                        {issue.span.length > 140 ? '...' : ''}&quot;
                      </p>
                    )}
                  </div>
                  {!dismissed && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => onFix([issue.id])}
                        disabled={fixing || fixingIds.length > 0}
                        className="px-2 py-1 rounded bg-foreground/80 text-background text-[10px] font-bold hover:bg-foreground transition-colors disabled:opacity-50"
                      >
                        {fixing ? '...' : 'Corrigir'}
                      </button>
                      <button
                        onClick={() => onDismiss(issue.id)}
                        disabled={fixingIds.length > 0}
                        className="px-2 py-1 rounded border border-border text-muted-foreground text-[10px] hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
