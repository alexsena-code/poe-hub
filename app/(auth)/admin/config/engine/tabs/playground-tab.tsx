'use client';

// Runs the RAG context-assembly pipeline read-only via POST /api/engine/knowledge/query.
// Loads query-type dropdown from GET /api/engine/config/query-routing.

import { useEffect, useState } from 'react';

const API = '/api/engine';

interface PlaygroundResult {
  systemPrompt: string;
  context: string;
  tokenEstimate: number;
  detectedPageType?: string;
  responseHint?: string;
  layers: {
    exactData?: string;
    chunks?: Array<{ score: number; content: string; metadata: any }>;
    expandedPages?: Array<{ pageTitle: string; extractedContent: string }>;
    summary?: string;
    buildMeta?: string;
  };
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 0.85
    ? 'text-green-400 bg-green-500/10'
    : score >= 0.75
      ? 'text-yellow-400 bg-yellow-500/10'
      : 'text-orange-400 bg-orange-500/10';
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${color}`}>
      {score.toFixed(3)}
    </span>
  );
}

function collectionColor(col: string): string {
  const map: Record<string, string> = {
    poe_wiki: 'bg-blue-500/10 text-blue-400',
    poe_builds: 'bg-purple-500/10 text-purple-400',
    poe_transcripts: 'bg-red-500/10 text-red-400',
    poe_reddit: 'bg-orange-500/10 text-orange-400',
    poe_patch_notes: 'bg-green-500/10 text-green-400',
    poe_ggg_news: 'bg-cyan-500/10 text-cyan-400',
    poe_meta: 'bg-gray-500/10 text-gray-400',
  };
  return map[col] || 'bg-foreground/5 text-muted-foreground';
}

function CollapsibleSection({
  title, children, defaultOpen = false,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface border border-border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground text-xs">{open ? 'v' : '>'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export default function PlaygroundTab() {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState('qa');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routingTypes, setRoutingTypes] = useState<string[]>([]);

  // Load routing types for the dropdown
  useEffect(() => {
    fetch(`${API}/config/query-routing`)
      .then((r) => r.json())
      .then((data) => setRoutingTypes(Object.keys(data)))
      .catch(() => {});
  }, []);

  const runQuery = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, queryType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao executar query');
    }
    setRunning(false);
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">RAG Playground</h2>
        <p className="text-xs text-muted-foreground">Testa o pipeline de context assembly com dados reais. Nada e persistido.</p>
      </div>

      {/* Query form */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex gap-3 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runQuery()}
            placeholder="Ex: how does Righteous Fire scale with life?"
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
          />
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="bg-background border border-border rounded px-2 py-2 text-sm text-foreground"
          >
            {routingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={runQuery}
            disabled={running || !query.trim()}
            className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {running ? 'Buscando...' : 'Executar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Tokens estimados" value={result.tokenEstimate.toString()} />
            <StatBox label="Page type" value={result.detectedPageType || '-'} />
            <StatBox label="Chunks" value={(result.layers.chunks?.length || 0).toString()} />
            <StatBox label="Has exact data" value={result.layers.exactData ? 'Sim' : 'Nao'} />
          </div>

          {/* Layer 1: Exact data */}
          {result.layers.exactData && (
            <CollapsibleSection title="Layer 1: Dados Exatos (PostgreSQL)" defaultOpen>
              <pre className="text-xs text-foreground font-mono whitespace-pre-wrap bg-background rounded p-3 max-h-48 overflow-y-auto">
                {result.layers.exactData}
              </pre>
            </CollapsibleSection>
          )}

          {/* Layer 2: Chunks */}
          {result.layers.chunks && result.layers.chunks.length > 0 && (
            <CollapsibleSection title={`Layer 2: Chunks (${result.layers.chunks.length})`} defaultOpen>
              <div className="space-y-2">
                {result.layers.chunks.map((chunk, i) => (
                  <div key={i} className="bg-background rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                        <span className="text-xs font-medium text-foreground">
                          {chunk.metadata.page_title || 'unknown'}
                        </span>
                        {chunk.metadata.collection && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            collectionColor(chunk.metadata.collection)
                          }`}>
                            {chunk.metadata.collection.replace('poe_', '')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {chunk.metadata.section && (
                          <span className="text-[10px] text-muted-foreground">{chunk.metadata.section}</span>
                        )}
                        <ScoreBadge score={chunk.score} />
                      </div>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {chunk.content.slice(0, 300)}
                      {chunk.content.length > 300 && '...'}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Layer 3: Summary */}
          {result.layers.summary && (
            <CollapsibleSection title="Layer 3: Summary (poe_meta)">
              <p className="text-xs text-foreground/80 leading-relaxed bg-background rounded p-3">
                {result.layers.summary}
              </p>
            </CollapsibleSection>
          )}

          {/* Layer 4: Build Meta */}
          {result.layers.buildMeta && (
            <CollapsibleSection title="Layer 4: Build Meta (poe.ninja)">
              <pre className="text-xs text-foreground font-mono whitespace-pre-wrap bg-background rounded p-3 max-h-48 overflow-y-auto">
                {result.layers.buildMeta}
              </pre>
            </CollapsibleSection>
          )}

          {/* Expanded Pages */}
          {result.layers.expandedPages && result.layers.expandedPages.length > 0 && (
            <CollapsibleSection title={`Expanded Pages (${result.layers.expandedPages.length})`}>
              {result.layers.expandedPages.map((page, i) => (
                <div key={i} className="bg-background rounded p-3 mb-2">
                  <div className="text-xs font-medium text-foreground mb-1">{page.pageTitle}</div>
                  <p className="text-xs text-foreground/80">{page.extractedContent.slice(0, 500)}</p>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Response Hint */}
          {result.responseHint && (
            <CollapsibleSection title="Response Hint">
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap bg-background rounded p-3">
                {result.responseHint}
              </pre>
            </CollapsibleSection>
          )}

          {/* Full context (raw) */}
          <CollapsibleSection title="Raw Context (enviado ao LLM)">
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap bg-background rounded p-3 max-h-96 overflow-y-auto">
              {result.context}
            </pre>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
