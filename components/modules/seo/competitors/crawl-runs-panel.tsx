'use client';

// CrawlRunsPanel — tabela dos 20 runs mais recentes do crawl de concorrentes.
// Recebe os runs via props (gerenciados pelo CompetitorsClient) para evitar
// fetch duplicado. O pai faz poll e passa os dados atualizados.

import type { CrawlRun } from './types';
import { CrawlStatusBadge } from './crawl-status-badge';
import { CrawlErrorsDialog } from './crawl-errors-dialog';

interface CrawlRunsPanelProps {
  runs: CrawlRun[];
  loading: boolean;
}

// Formats ISO date string as dd/mm/yyyy HH:mm (pt-BR).
function formatDateTimeBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-xs">
      <span className="text-foreground">{value}</span>
      <span className="text-muted-foreground text-[10px] ml-0.5">{label}</span>
    </span>
  );
}

export function CrawlRunsPanel({ runs, loading }: CrawlRunsPanelProps) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Histórico de crawls
        </span>
        {loading && (
          <span className="text-[10px] text-muted-foreground animate-pulse">atualizando…</span>
        )}
      </div>

      {runs.length === 0 && !loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum crawl executado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-background/50 border-b border-border/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Domínio</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Métricas</th>
                <th className="px-4 py-2.5 font-medium">Duração</th>
                <th className="px-4 py-2.5 font-medium">Iniciado em</th>
                <th className="px-4 py-2.5 font-medium">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-foreground/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-foreground">
                      {run.domain ?? <span className="text-muted-foreground italic">todos</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <CrawlStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2 flex-wrap">
                      <StatCell value={run.fetched} label="fetch" />
                      <StatCell value={run.created} label="cri" />
                      <StatCell value={run.updated} label="atu" />
                      <StatCell value={run.skipped} label="skip" />
                      <StatCell value={run.thin} label="fin" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDateTimeBR(run.startedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <CrawlErrorsDialog
                      errors={run.errors}
                      runId={run.id}
                      domain={run.domain}
                    />
                    {run.errors.length === 0 && (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
