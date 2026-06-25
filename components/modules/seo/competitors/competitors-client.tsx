'use client';

// CompetitorsClient — full CRUD island for /admin/competitors.
// Fetches from /api/engine/seo/competitors (engine DB-backed) on mount,
// then handles add / edit / soft-delete with optimistic refetch.
// Also owns the crawl-run polling logic:
//   - After POST /seo/competitors/crawl the client starts a short poll
//     (4 s interval, up to 40 s) on GET /seo/competitors/crawl-runs to
//     detect when the triggered run completes or fails.
//   - crawl-runs are also fetched on mount for the history panel.

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AddCompetitorForm } from './add-competitor-form';
import { CompetitorRow } from './competitor-row';
import { CrawlRunsPanel } from './crawl-runs-panel';
import type {
  Competitor,
  AddCompetitorPayload,
  EditCompetitorPayload,
  MutationResult,
  CrawlRun,
  CrawlStartResult,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENGINE_PREFIX = '/api/engine/seo/competitors';
const CRAWL_RUNS_URL = `${ENGINE_PREFIX}/crawl-runs?limit=20`;
/** Poll interval while a crawl is in progress (ms). */
const POLL_INTERVAL_MS = 4_000;
/** Maximum number of polling rounds per triggered crawl before giving up. */
const POLL_MAX_ROUNDS = 10; // 10 × 4s = 40s

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do engine (${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    const msg =
      body !== null && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the most recent crawl run for a given domain (or null). */
function latestRunForDomain(runs: CrawlRun[], domain: string): CrawlRun | null {
  const match = runs.find((r) => r.domain === domain);
  return match ?? null;
}

/** True if any run in the list is currently in progress. */
function hasRunningRun(runs: CrawlRun[]): boolean {
  return runs.some((r) => r.status === 'running');
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CompetitorsClient() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  // Tracks which domains have a crawl in flight (button disabled state).
  const [crawlingDomains, setCrawlingDomains] = useState<Set<string>>(new Set());

  // Polling refs — we use refs so the interval callbacks always see the
  // current values without re-creating the interval on every state change.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRoundsRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchCompetitors = useCallback(async () => {
    try {
      const data = await apiFetch<Competitor[]>(ENGINE_PREFIX);
      setCompetitors(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao carregar concorrentes: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCrawlRuns = useCallback(async (silent = false) => {
    if (!silent) setRunsLoading(true);
    try {
      const data = await apiFetch<CrawlRun[]>(CRAWL_RUNS_URL);
      const runs = Array.isArray(data) ? data : [];
      setCrawlRuns(runs);
      return runs;
    } catch (err) {
      // Crawl history is non-critical — warn instead of error toast.
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.warn(`[competitors] Falha ao carregar crawl-runs: ${msg}`);
      return null;
    } finally {
      if (!silent) setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompetitors();
    void fetchCrawlRuns();
  }, [fetchCompetitors, fetchCrawlRuns]);

  // ---------------------------------------------------------------------------
  // Polling — stop when all runs settle or max rounds hit
  // ---------------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollRoundsRef.current = 0;
  }, []);

  const startPolling = useCallback(() => {
    // Avoid double-starting.
    if (pollTimerRef.current !== null) return;

    pollRoundsRef.current = 0;
    pollTimerRef.current = setInterval(async () => {
      pollRoundsRef.current += 1;
      const runs = await fetchCrawlRuns(true);

      const shouldStop =
        runs === null ||
        !hasRunningRun(runs) ||
        pollRoundsRef.current >= POLL_MAX_ROUNDS;

      if (shouldStop) {
        stopPolling();
        // Clear all "crawling" domain locks once polling ends.
        setCrawlingDomains(new Set());
      }
    }, POLL_INTERVAL_MS);
  }, [fetchCrawlRuns, stopPolling]);

  // Clean up interval on unmount.
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  async function handleAdd(payload: AddCompetitorPayload) {
    setAdding(true);
    try {
      const result = await apiFetch<MutationResult>(ENGINE_PREFIX, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if ('error' in result) {
        toast.error(`Erro ao adicionar: ${result.error}`);
      } else {
        toast.success(`Concorrente "${result.domain}" adicionado.`);
        await fetchCompetitors();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao adicionar: ${msg}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleEdit(domain: string, payload: EditCompetitorPayload) {
    try {
      const encodedDomain = encodeURIComponent(domain);
      const result = await apiFetch<MutationResult>(`${ENGINE_PREFIX}/${encodedDomain}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if ('error' in result) {
        toast.error(`Erro ao editar: ${result.error}`);
      } else {
        toast.success(`"${result.domain}" atualizado.`);
        await fetchCompetitors();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao editar: ${msg}`);
    }
  }

  async function handleRemove(domain: string) {
    try {
      const encodedDomain = encodeURIComponent(domain);
      const result = await apiFetch<MutationResult>(`${ENGINE_PREFIX}/${encodedDomain}/remove`, {
        method: 'POST',
      });
      if ('error' in result) {
        toast.error(`Erro ao remover: ${result.error}`);
      } else {
        toast.success(`"${result.domain}" removido.`);
        await fetchCompetitors();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao remover: ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Crawl handler
  // ---------------------------------------------------------------------------

  async function handleCrawl(domain: string) {
    setCrawlingDomains((prev) => new Set([...prev, domain]));
    try {
      const result = await apiFetch<CrawlStartResult>(`${ENGINE_PREFIX}/crawl`, {
        method: 'POST',
        body: JSON.stringify({ domain }),
      });
      if ('error' in result) {
        toast.error(`Erro ao iniciar crawl: ${result.error}`);
        setCrawlingDomains((prev) => {
          const next = new Set(prev);
          next.delete(domain);
          return next;
        });
        return;
      }
      toast.success(`Crawl iniciado para ${domain}`);
      // Fetch runs once immediately so the UI shows the new 'running' row,
      // then start the poll loop to track completion.
      await fetchCrawlRuns(true);
      startPolling();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao iniciar crawl de ${domain}: ${msg}`);
      setCrawlingDomains((prev) => {
        const next = new Set(prev);
        next.delete(domain);
        return next;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Carregando concorrentes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AddCompetitorForm onAdd={handleAdd} adding={adding} />

      <div className="text-xs text-muted-foreground mb-2">
        {competitors.length} concorrente{competitors.length !== 1 ? 's' : ''} registrado
        {competitors.length !== 1 ? 's' : ''}
      </div>

      {competitors.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhum concorrente cadastrado. Use o formulário acima para adicionar o primeiro.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-background/50 border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Domínio / Source</th>
                  <th className="px-4 py-3 font-medium">Sitemap URL</th>
                  <th className="px-4 py-3 font-medium">Path Filter</th>
                  <th className="px-4 py-3 font-medium">Último crawl</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {competitors.map((c) => (
                  <CompetitorRow
                    key={c.domain}
                    competitor={c}
                    lastCrawlRun={latestRunForDomain(crawlRuns, c.domain)}
                    crawling={crawlingDomains.has(c.domain)}
                    onEdit={handleEdit}
                    onRemove={handleRemove}
                    onCrawl={handleCrawl}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crawl history panel — always visible, even when list is empty */}
      <CrawlRunsPanel runs={crawlRuns} loading={runsLoading} />
    </div>
  );
}
