'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTrace, deleteTrace } from '@/lib/content-api';
import type { PostTrace, TraceEvent, TraceMode } from '@/lib/engine-types';

interface TraceViewerProps {
  slug: string;
}

const NODE_COLORS: Record<string, string> = {
  classify: 'border-slate-500/40 bg-slate-950/30 text-slate-300',
  plan: 'border-blue-500/40 bg-blue-950/30 text-blue-300',
  research: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300',
  analyze: 'border-teal-500/40 bg-teal-950/30 text-teal-300',
  gap_check: 'border-sky-500/40 bg-sky-950/30 text-sky-300',
  write: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
  critique: 'border-amber-500/40 bg-amber-950/30 text-amber-300',
  fix: 'border-orange-500/40 bg-orange-950/30 text-orange-300',
  optimize: 'border-purple-500/40 bg-purple-950/30 text-purple-300',
};

function nodeClass(node: string) {
  return NODE_COLORS[node] || 'border-border bg-surface text-muted-foreground';
}

function modeBadge(mode: TraceMode) {
  const style =
    mode === 'autonomous' ? 'bg-blue-950/40 text-blue-300 border-blue-700/40' :
    mode === 'co_writer' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40' :
    'bg-muted text-muted-foreground border-border';
  return style;
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(v?: number): string {
  if (!v) return '$0';
  return `$${v.toFixed(5)}`;
}

function TraceEventCard({ event }: { event: TraceEvent }) {
  const [expandedLlm, setExpandedLlm] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(false);
  return (
    <div className={`rounded-lg border px-4 py-3 ${nodeClass(event.node)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-mono font-semibold uppercase">{event.node}</span>
            <span className="text-muted-foreground/70">· {event.kind}</span>
            {event.sectionId && (
              <span className="rounded border border-border bg-background/40 px-1.5 py-0.5 text-[10px] font-mono">
                {event.sectionId}
              </span>
            )}
            <span className="text-muted-foreground/60 text-[10px]">
              #{event.seq} · {new Date(event.timestamp).toLocaleTimeString('pt-BR')}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{event.message}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
          {event.durationMs !== undefined && <span>{formatDuration(event.durationMs)}</span>}
          {event.tokensUsed !== undefined && event.tokensUsed > 0 && (
            <span>{event.tokensUsed.toLocaleString('pt-BR')} tok</span>
          )}
          {event.costUsd !== undefined && event.costUsd > 0 && <span>{formatCost(event.costUsd)}</span>}
        </div>
      </div>

      {event.llm && (
        <div className="mt-2 rounded border border-border/60 bg-background/40 px-3 py-2">
          <button
            type="button"
            onClick={() => setExpandedLlm(!expandedLlm)}
            className="flex w-full items-center justify-between text-[11px] text-muted-foreground hover:text-foreground"
          >
            <span>
              🤖 LLM call · <span className="font-mono">{event.llm.model}</span> ·{' '}
              {event.llm.inputTokens}↑ {event.llm.outputTokens}↓ · {formatCost(event.llm.costUsd)}
            </span>
            <span>{expandedLlm ? '▲' : '▼'}</span>
          </button>
          {expandedLlm && (
            <div className="mt-2 space-y-2 text-[11px] leading-relaxed">
              <details open>
                <summary className="cursor-pointer text-foreground/80">system prompt</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-[10px] text-foreground/70">
                  {event.llm.systemPrompt}
                </pre>
              </details>
              <details open>
                <summary className="cursor-pointer text-foreground/80">user message</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-[10px] text-foreground/70">
                  {event.llm.userMessage}
                </pre>
              </details>
              <details>
                <summary className="cursor-pointer text-foreground/80">response</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-[10px] text-foreground/70">
                  {event.llm.response}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {event.retrieval && (
        <div className="mt-2 rounded border border-border/60 bg-background/40 px-3 py-2 text-[11px]">
          <div className="text-muted-foreground">
            🔍 retrieval · collections:{' '}
            <span className="font-mono">{event.retrieval.collections.join(', ') || '—'}</span> ·{' '}
            {event.retrieval.chunkCount} chunks · {formatDuration(event.retrieval.durationMs)}
            {event.retrieval.exactDataPresent && ' · exactData'}
            {event.retrieval.summaryPresent && ' · summary'}
          </div>
          {event.retrieval.topChunks.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground/90">
              {event.retrieval.topChunks.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {c.score.toFixed(2)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">{c.collection}</span>
                  <span className="truncate">
                    {c.pageTitle}
                    {c.section ? ` · ${c.section}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {event.details && Object.keys(event.details).length > 0 && (
        <div className="mt-2 rounded border border-border/60 bg-background/40 px-3 py-2 text-[11px]">
          <button
            type="button"
            onClick={() => setExpandedDetails(!expandedDetails)}
            className="flex w-full items-center justify-between text-muted-foreground hover:text-foreground"
          >
            <span>details</span>
            <span>{expandedDetails ? '▲' : '▼'}</span>
          </button>
          {expandedDetails && (
            <pre className="mt-1 whitespace-pre-wrap text-[10px] text-foreground/70">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function TraceViewer({ slug }: TraceViewerProps) {
  const [trace, setTrace] = useState<PostTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [nodeFilter, setNodeFilter] = useState<string>('');
  const [llmOnly, setLlmOnly] = useState(false);
  const [retrievalOnly, setRetrievalOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTrace(slug)
      .then((t) => {
        if (!cancelled) {
          setTrace(t);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'erro');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const sectionIds = useMemo(() => {
    if (!trace) return [];
    const set = new Set<string>();
    for (const e of trace.events) if (e.sectionId) set.add(e.sectionId);
    return Array.from(set);
  }, [trace]);

  const nodeTypes = useMemo(() => {
    if (!trace) return [];
    const set = new Set<string>();
    for (const e of trace.events) set.add(e.node);
    return Array.from(set);
  }, [trace]);

  const filteredEvents = useMemo(() => {
    if (!trace) return [];
    return trace.events.filter((e) => {
      if (sectionFilter && e.sectionId !== sectionFilter) return false;
      if (nodeFilter && e.node !== nodeFilter) return false;
      if (llmOnly && !e.llm) return false;
      if (retrievalOnly && !e.retrieval) return false;
      return true;
    });
  }, [trace, sectionFilter, nodeFilter, llmOnly, retrievalOnly]);

  function exportJson() {
    if (!trace) return;
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trace.slug}-trace.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!trace) return;
    if (!confirm(`Deletar trace de "${trace.slug}"?`)) return;
    try {
      await deleteTrace(trace.slug);
      setTrace(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'erro');
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando trace…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        Nenhum trace encontrado pra <code className="font-mono">{slug}</code>. Este post pode ter sido
        gerado antes do sistema de trace ser habilitado — regenere uma seção no co-writer para começar
        o trace.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header com totals */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-accent">Trace · {trace.slug}</h2>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase ${modeBadge(trace.mode)}`}
              >
                {trace.mode}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(trace.createdAt).toLocaleString('pt-BR')} → {new Date(trace.updatedAt).toLocaleString('pt-BR')}
              {trace.inputs.templateName && (
                <> · template <span className="font-mono">{trace.inputs.templateName}</span></>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded border border-red-700/50 bg-red-950/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40"
            >
              Deletar
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Eventos" value={String(trace.totals.eventCount)} />
          <Stat label="LLM calls" value={String(trace.totals.llmCallCount)} />
          <Stat label="Tokens" value={trace.totals.tokensUsed.toLocaleString('pt-BR')} />
          <Stat label="Custo" value={formatCost(trace.totals.costUsd)} />
          <Stat label="Duração" value={formatDuration(trace.totals.durationMs)} />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs">
        <span className="text-muted-foreground">Filtros:</span>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-foreground"
        >
          <option value="">todas as seções</option>
          {sectionIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select
          value={nodeFilter}
          onChange={(e) => setNodeFilter(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-foreground"
        >
          <option value="">todos os nodes</option>
          {nodeTypes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={llmOnly}
            onChange={(e) => setLlmOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          só LLM
        </label>
        <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={retrievalOnly}
            onChange={(e) => setRetrievalOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          só retrieval
        </label>
        <span className="ml-auto text-muted-foreground">
          {filteredEvents.length} de {trace.events.length} eventos
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Nenhum evento corresponde aos filtros.
          </div>
        ) : (
          filteredEvents.map((e) => <TraceEventCard key={e.seq} event={e} />)
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
