'use client';

// CompetitorRow — a single table row with inline edit, confirm-remove,
// and a "Crawlar" action button that dispatches a crawl for this domain.
// Crawl state (last run for this domain) is passed from the parent
// CompetitorsClient, which owns the polling loop.

import { useState } from 'react';
import type { Competitor, EditCompetitorPayload, CompetitorSource, CrawlRun } from './types';
import { CrawlStatusBadge } from './crawl-status-badge';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

// Formats an ISO date string as dd/mm/yyyy HH:mm (pt-BR, per project memory).
function formatDateTimeBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// Formats an ISO date string as dd/mm/yyyy (short, for "criado em" column).
function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Summarizes crawl run metrics in a compact string.
function summarizeCrawlRun(run: CrawlRun): string {
  const parts: string[] = [];
  if (run.created > 0) parts.push(`${run.created} cri`);
  if (run.updated > 0) parts.push(`${run.updated} atu`);
  if (run.thin > 0) parts.push(`${run.thin} fin`);
  if (run.errors.length > 0) parts.push(`${run.errors.length} err`);
  return parts.length > 0 ? parts.join(' · ') : `${run.fetched} fetch`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: CompetitorSource }) {
  const config: Record<CompetitorSource, { label: string; className: string }> = {
    manual: { label: 'manual', className: 'bg-blue-500/15 text-blue-400' },
    yaml: { label: 'yaml', className: 'bg-amber-500/15 text-amber-400' },
    auto_discover: { label: 'auto', className: 'bg-purple-500/15 text-purple-400' },
  };
  const { label, className } = config[source] ?? config.manual;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// Shows the last crawl status + brief summary for a given domain.
function LastCrawlCell({ lastRun }: { lastRun: CrawlRun | null }) {
  if (!lastRun) {
    return <span className="text-xs text-muted-foreground/40">nunca</span>;
  }

  const when = lastRun.status === 'running'
    ? lastRun.startedAt
    : (lastRun.finishedAt ?? lastRun.startedAt);

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <CrawlStatusBadge status={lastRun.status} />
        {lastRun.status !== 'running' && (
          <span className="text-[10px] text-muted-foreground">{formatDateTimeBR(when)}</span>
        )}
      </div>
      {lastRun.status !== 'running' && (
        <span className="text-[10px] text-muted-foreground/70">{summarizeCrawlRun(lastRun)}</span>
      )}
      {lastRun.status === 'running' && (
        <span className="text-[10px] text-amber-400/70 animate-pulse">rodando…</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CompetitorRowProps {
  competitor: Competitor;
  lastCrawlRun: CrawlRun | null;
  crawling: boolean;
  onEdit: (domain: string, payload: EditCompetitorPayload) => Promise<void>;
  onRemove: (domain: string) => Promise<void>;
  onCrawl: (domain: string) => Promise<void>;
}

export function CompetitorRow({
  competitor,
  lastCrawlRun,
  crawling,
  onEdit,
  onRemove,
  onCrawl,
}: CompetitorRowProps) {
  const [editing, setEditing] = useState(false);
  const [sitemapUrl, setSitemapUrl] = useState(competitor.sitemapUrl ?? '');
  const [pathFilter, setPathFilter] = useState(competitor.pathFilter ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onEdit(competitor.domain, {
      sitemapUrl: sitemapUrl.trim() || undefined,
      pathFilter: pathFilter.trim() || undefined,
    });
    setSaving(false);
    setEditing(false);
  }

  function handleCancelEdit() {
    setSitemapUrl(competitor.sitemapUrl ?? '');
    setPathFilter(competitor.pathFilter ?? '');
    setEditing(false);
  }

  async function handleRemove() {
    setRemoving(true);
    await onRemove(competitor.domain);
    setRemoving(false);
    setConfirmRemove(false);
  }

  async function handleCrawl() {
    await onCrawl(competitor.domain);
  }

  if (editing) {
    return (
      <tr className="bg-foreground/5">
        <td className="px-4 py-2">
          <span className="font-mono text-xs font-medium text-foreground">{competitor.domain}</span>
        </td>
        <td className="px-4 py-2" colSpan={4}>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://dominio/sitemap.xml"
              className="flex-1 min-w-[200px] bg-background border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50"
            />
            <input
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              placeholder=".+"
              className="w-[180px] bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono placeholder:text-muted-foreground/50"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[10px] rounded transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-foreground/10 hover:bg-foreground/20 text-muted-foreground text-[10px] rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </td>
        <td className="px-4 py-2" />
        <td className="px-4 py-2" />
      </tr>
    );
  }

  return (
    <tr className="hover:bg-foreground/5 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground">{competitor.domain}</span>
          <SourceBadge source={competitor.source} />
        </div>
        {competitor.addedBy && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{competitor.addedBy}</div>
        )}
      </td>
      <td className="px-4 py-3 max-w-[220px] truncate">
        {competitor.sitemapUrl ? (
          <a
            href={competitor.sitemapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:underline font-mono"
          >
            {competitor.sitemapUrl}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {competitor.pathFilter ? (
          <code className="text-[10px] bg-foreground/10 px-1.5 py-0.5 rounded text-foreground/80">
            {competitor.pathFilter}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <LastCrawlCell lastRun={lastCrawlRun} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDateBR(competitor.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          {/* Crawl trigger */}
          <button
            onClick={handleCrawl}
            disabled={crawling || lastCrawlRun?.status === 'running'}
            className="px-2.5 py-0.5 text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 disabled:opacity-40 text-indigo-400 rounded transition-colors font-medium"
          >
            {lastCrawlRun?.status === 'running' ? 'Crawlando...' : crawling ? 'Aguarde...' : 'Crawlar'}
          </button>

          {/* Edit / Remove */}
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Editar
          </button>
          {confirmRemove ? (
            <span className="inline-flex gap-1">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-2 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded transition-colors"
              >
                {removing ? '...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="px-2 py-0.5 text-[10px] bg-foreground/10 hover:bg-foreground/20 text-muted-foreground rounded transition-colors"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              Remover
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
