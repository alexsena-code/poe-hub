'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const API = '/api/engine';

type EventNode =
  | 'classify'
  | 'plan'
  | 'research'
  | 'analyze'
  | 'gap_check'
  | 'write'
  | 'critique'
  | 'fix'
  | 'optimize';

type EventKind = 'started' | 'completed' | 'skipped' | 'failed' | 'info';

interface GenEvent {
  timestamp: string;
  node: EventNode;
  kind: EventKind;
  sectionId?: string;
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
}

interface LogResponse {
  slug: string;
  title: { 'pt-br': string; en: string };
  generatedAt: string;
  template: string;
  events: GenEvent[];
  totals: { durationMs: number; tokensUsed: number; costUsd: number };
  eventCount: number;
}

const NODE_COLORS: Record<EventNode, string> = {
  classify: 'bg-purple-500',
  plan: 'bg-cyan-500',
  research: 'bg-blue-500',
  analyze: 'bg-teal-500',
  gap_check: 'bg-amber-500',
  write: 'bg-green-500',
  critique: 'bg-orange-500',
  fix: 'bg-pink-500',
  optimize: 'bg-indigo-500',
};

const KIND_BADGE: Record<EventKind, string> = {
  started: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  skipped: 'bg-muted/20 text-muted-foreground',
  failed: 'bg-red-500/20 text-red-300',
  info: 'bg-foreground/20 text-foreground',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

export default function LogPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [log, setLog] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/content/posts/${slug}/log`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setLog(data);
        }
      })
      .catch(() => setError('Falha ao carregar log'))
      .finally(() => setLoading(false));
  }, [slug]);

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">Carregando log...</p>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground text-sm">{error || 'Log não encontrado'}</p>
        <Link href={`/guides/${slug}`} className="text-foreground text-sm hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao post
        </Link>
      </div>
    );
  }

  const hasEvents = log.events.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href={`/guides/${slug}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Voltar ao post</span>
          </Link>
          <span className="text-sm text-foreground font-medium truncate max-w-md">
            Audit log: {log.title?.['pt-br'] || slug}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Audit log</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Timeline do pipeline que gerou este post. Cada evento mostra duração, tokens e custo.
        </p>

        {/* Totals card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Eventos</div>
            <div className="text-xl font-bold text-foreground mt-1">{log.eventCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duração total</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatDuration(log.totals.durationMs)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {log.totals.tokensUsed.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatCost(log.totals.costUsd)}
            </div>
          </div>
        </div>

        {!hasEvents && (
          <div className="rounded-lg border border-border bg-card px-6 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum evento registrado. Posts gerados antes desta feature não têm log.
            </p>
          </div>
        )}

        {/* Timeline */}
        {hasEvents && (
          <ol className="relative border-l-2 border-border ml-4">
            {log.events.map((event, idx) => {
              const isExpanded = expanded.has(idx);
              const hasDetails = event.details && Object.keys(event.details).length > 0;

              return (
                <li key={idx} className="mb-4 ml-6">
                  <span
                    className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ${NODE_COLORS[event.node]}`}
                  />

                  <div className="rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/30 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {event.node}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${KIND_BADGE[event.kind]}`}>
                        {event.kind}
                      </span>
                      {event.sectionId && (
                        <span className="text-[10px] text-muted-foreground font-mono bg-background/60 px-2 py-0.5 rounded">
                          {event.sectionId}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                        {new Date(event.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-foreground mb-2">{event.message}</p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {event.durationMs !== undefined && (
                        <span>{formatDuration(event.durationMs)}</span>
                      )}
                      {event.tokensUsed !== undefined && event.tokensUsed > 0 && (
                        <span>{event.tokensUsed.toLocaleString('pt-BR')} tokens</span>
                      )}
                      {event.costUsd !== undefined && event.costUsd > 0 && (
                        <span>{formatCost(event.costUsd)}</span>
                      )}
                      {hasDetails && (
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="ml-auto text-foreground hover:underline"
                        >
                          {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                        </button>
                      )}
                    </div>

                    {isExpanded && hasDetails && (
                      <pre className="mt-3 text-[11px] text-foreground/80 bg-background rounded p-3 overflow-x-auto font-mono border border-border">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
