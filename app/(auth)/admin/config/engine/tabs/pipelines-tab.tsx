'use client';

// Fires SEO/content pipelines and streams their logs/progress.
// Dispatches to POST /api/engine/<endpoint> per pipeline config below;
// poll-mode pipelines then GET /api/engine/<statusEndpoint> for updates.
// Also renders /api/engine/seo/pipeline/costs?days=30 summary card.

import { useCallback, useEffect, useRef, useState } from 'react';

const API = '/api/engine';

interface PipelineLog {
  time: string;
  step: string;
  message: string;
}

interface PipelineState {
  status: 'idle' | 'running' | 'done' | 'error';
  logs: PipelineLog[];
  startedAt?: number;
  finishedAt?: number;
  result?: any;
  error?: string;
  progress?: number;
  step?: string;
}

const PIPELINES = [
  {
    id: 'full-pipeline',
    name: 'Full Pipeline',
    description: 'Reddit extract → YT import → KeyBERT extraction → poe.ninja → Qdrant ingest → LLM Validate → VICE recalc → Semantic cross-ref (9 steps)',
    mode: 'fire' as const,
    endpoint: '/seo/pipeline/full',
    configFields: [
      { key: 'maxSeeds', label: 'Max Seeds (suggest)', type: 'number', default: 10 },
    ],
  },
  {
    id: 'llm-keyword-validation',
    name: 'LLM Keyword Validation',
    description: 'Valida keywords via Qdrant context + LLM scoring (relevance, cluster)',
    mode: 'fire' as const,
    endpoint: '/seo/keywords/llm-validate',
    configFields: [
      { key: 'limit', label: 'Max keywords', type: 'number', default: 500 },
    ],
  },
  {
    id: 'youtube-smart-scan',
    name: 'YouTube Smart Scan',
    description: 'RSS fetch + classificacao + transcripts + keywords LLM + scoring',
    mode: 'sse' as const,
    endpoint: '/seo/youtube/smart-scan-stream',
    configFields: [
      { key: 'days', label: 'Dias', type: 'number', default: 30 },
      { key: 'maxTranscripts', label: 'Max Transcripts', type: 'number', default: 15 },
    ],
  },
  {
    id: 'reddit-crawl',
    name: 'Reddit Crawl (New)',
    description: 'Busca posts mais recentes dos subreddits PoE e salva no DB',
    mode: 'fire' as const,
    endpoint: '/seo/reddit/crawl',
    body: { sort: 'new', time: 'day', maxPosts: 50, parallel: true },
    statusEndpoint: null,
    configFields: [],
  },
  {
    id: 'reddit-keywords',
    name: 'Reddit Keyword Scan',
    description: 'Extrai keywords dos posts Reddit via LLM (Gemini)',
    mode: 'poll' as const,
    endpoint: '/seo/scan/reddit',
    statusEndpoint: '/seo/scan/reddit/status',
    configFields: [
      { key: 'minScore', label: 'Score minimo', type: 'number', default: 50 },
      { key: 'batchSize', label: 'Batch size', type: 'number', default: 60 },
      { key: 'regexOnly', label: 'Regex only (sem LLM)', type: 'boolean', default: false },
    ],
  },
  {
    id: 'suggest-scan',
    name: 'Google Suggest Expansion',
    description: 'Expande seed keywords via Google Suggest autocomplete',
    mode: 'fire' as const,
    endpoint: '/seo/scan/suggest',
    configFields: [
      { key: 'seeds', label: 'Seeds (comma-separated)', type: 'text', default: 'poe builds,path of exile' },
    ],
  },
  {
    id: 'competitor-crawl',
    name: 'Competitor Sitemap Crawl',
    description: 'Crawl sitemaps de concorrentes para content gap analysis',
    mode: 'fire' as const,
    endpoint: '/seo/competitors/crawl',
    configFields: [],
  },
  {
    id: 'gap-analysis',
    name: 'Competitor Gap Analysis',
    description: 'Cruza competitors com Qdrant + GSC + LLM para encontrar gaps de conteúdo',
    mode: 'fire' as const,
    endpoint: '/seo/competitors/gap-analysis',
    configFields: [],
  },
  {
    id: 'youtube-monitor',
    name: 'YouTube Monitor (Quick)',
    description: 'Detecta novos uploads via RSS — sem transcripts, rapido',
    mode: 'fire' as const,
    endpoint: '/seo/youtube/monitor',
    configFields: [],
  },
  {
    id: 'ninja-validation',
    name: 'poe.ninja Validation',
    description: 'Cruza keywords com dados de builds do poe.ninja (skills, classes, popularidade)',
    mode: 'poll' as const,
    endpoint: '/seo/scan/ninja',
    statusEndpoint: '/seo/scan/ninja/status',
    configFields: [
      { key: 'force', label: 'Revalidar todos', type: 'boolean', default: false },
    ],
  },
  {
    id: 'semantic-crossref',
    name: 'Semantic Cross-Ref',
    description: 'Cruza keywords via Qdrant — valida YouTube keywords no Reddit e vice-versa',
    mode: 'fire' as const,
    endpoint: '/seo/keywords/semantic-cross-ref',
    configFields: [
      { key: 'limit', label: 'Max keywords', type: 'number', default: 1100 },
      { key: 'minSimilarity', label: 'Min similarity', type: 'number', default: 0.80 },
    ],
  },
  {
    id: 'reddit-qdrant',
    name: 'Reddit → Qdrant',
    description: 'Ingere posts e comentários do Reddit no Qdrant (poe_reddit collection)',
    mode: 'fire' as const,
    endpoint: '/knowledge/reddit/ingest',
    configFields: [
      { key: 'minScore', label: 'Score minimo', type: 'number', default: 5 },
      { key: 'limit', label: 'Max posts', type: 'number', default: 500 },
    ],
  },
  {
    id: 'youtube-qdrant',
    name: 'YouTube → Qdrant',
    description: 'Ingere vídeos e keywords do YouTube no Qdrant (poe_youtube_trends collection)',
    mode: 'fire' as const,
    endpoint: '/knowledge/youtube/ingest',
    configFields: [
      { key: 'minViews', label: 'Views minimas', type: 'number', default: 100 },
    ],
  },
  {
    id: 'keyword-dedup',
    name: 'Keyword Dedup + Cleanup',
    description: 'Remove duplicate keywords (semantic similarity), outdated versions (<3.28), and PoE2 when focus is PoE1',
    mode: 'fire' as const,
    endpoint: '/seo/keywords/dedup',
    configFields: [
      { key: 'similarity', label: 'Min similarity (0-1)', type: 'number', default: 0.92 },
      { key: 'dryRun', label: 'Dry run (just report)', type: 'boolean', default: false },
    ],
  },
  {
    id: 'daily-cron',
    name: 'Daily Pipeline (Cron)',
    description: 'Reddit 24h + YouTube 24h + Full keyword pipeline. Roda automaticamente as 06:00 UTC.',
    mode: 'fire' as const,
    endpoint: '/seo/cron/daily',
    configFields: [],
  },
  {
    id: 'gsc-sync',
    name: 'Google Search Console Sync',
    description: 'Importa dados de queries, impressoes, clicks e posicoes do GSC',
    mode: 'fire' as const,
    endpoint: '/seo/gsc/sync',
    configFields: [
      { key: 'days', label: 'Dias', type: 'number', default: 28 },
    ],
  },
];

const STEP_COLORS: Record<string, string> = {
  fetch: 'text-blue-400',
  classify: 'text-cyan-400',
  transcripts: 'text-purple-400',
  keywords: 'text-yellow-400',
  ingest: 'text-orange-400',
  validate: 'text-pink-400',
  scoring: 'text-green-400',
  report: 'text-emerald-400',
  done: 'text-green-300',
  start: 'text-muted-foreground',
  loading: 'text-blue-400',
  extracting: 'text-yellow-400',
  importing: 'text-cyan-400',
  error: 'text-red-400',
};

interface PipelineCosts {
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byNode: Array<{ nodeName: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  byDay: Array<{ date: string; calls: number; costUsd: number }>;
}

function PipelineCostsCard() {
  const [costs, setCosts] = useState<PipelineCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/seo/pipeline/costs?days=30`)
      .then(r => r.json())
      .then(data => { setCosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground mb-4">Loading costs...</div>;
  if (!costs) return null;

  const avgCost = costs.total.calls > 0 ? costs.total.costUsd / costs.total.calls : 0;

  return (
    <div className="mb-6">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pipeline Costs (30d)</div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Cost</div>
          <div className="text-lg font-bold text-foreground">${costs.total.costUsd.toFixed(4)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Calls</div>
          <div className="text-lg font-bold text-foreground">{costs.total.calls}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Cost/Call</div>
          <div className="text-lg font-bold text-foreground">${avgCost.toFixed(5)}</div>
        </div>
      </div>
      {costs.byNode.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Node</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {costs.byNode.map(node => (
                <tr key={node.nodeName} className="border-b border-border/50">
                  <td className="px-3 py-1.5 text-foreground font-mono">{node.nodeName}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{node.calls}</td>
                  <td className="px-3 py-1.5 text-right text-foreground">${node.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PipelineStatusBadge({ status }: { status: PipelineState['status'] }) {
  const styles: Record<string, string> = {
    idle: 'bg-foreground/5 text-muted-foreground',
    running: 'bg-blue-500/10 text-blue-400 animate-pulse',
    done: 'bg-green-500/10 text-green-400',
    error: 'bg-red-500/10 text-red-400',
  };
  const labels: Record<string, string> = {
    idle: 'idle',
    running: 'running',
    done: 'done',
    error: 'error',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PipelineResultSummary({ pipelineId, result }: { pipelineId: string; result: any }) {
  const [expanded, setExpanded] = useState(false);

  // Build stats based on pipeline type
  const stats: Array<{ label: string; value: string }> = [];

  if (pipelineId === 'youtube-smart-scan') {
    if (result.poe_videos !== undefined) stats.push({ label: 'PoE Videos', value: String(result.poe_videos) });
    if (result.channels_checked !== undefined) stats.push({ label: 'Channels', value: String(result.channels_checked) });
    if (result.trending_keywords?.length !== undefined) stats.push({ label: 'Keywords', value: String(result.trending_keywords.length) });
    if (result.transcripts_fetched !== undefined) stats.push({ label: 'Transcripts', value: String(result.transcripts_fetched) });
    if (result.chunks_upserted !== undefined) stats.push({ label: 'Chunks', value: String(result.chunks_upserted) });
    if (result.slang_candidates?.length) stats.push({ label: 'Slang', value: String(result.slang_candidates.length) });
    if (result.llm_usage) {
      stats.push({ label: 'LLM Calls', value: String(result.llm_usage.calls) });
      stats.push({ label: 'LLM Cost', value: `$${result.llm_usage.cost_usd?.toFixed(4) || '0'}` });
    }
  } else if (pipelineId === 'reddit-keywords') {
    if (result.keywordsFound !== undefined) stats.push({ label: 'Keywords', value: String(result.keywordsFound) });
    if (result.newKeywords !== undefined) stats.push({ label: 'Novos', value: String(result.newKeywords) });
    if (result.rejected !== undefined) stats.push({ label: 'Rejeitados', value: String(result.rejected) });
    if (result.durationMs !== undefined) stats.push({ label: 'Duracao', value: `${(result.durationMs / 1000).toFixed(1)}s` });
  } else if (pipelineId === 'ninja-validation') {
    if (result.total !== undefined) stats.push({ label: 'Total', value: String(result.total) });
    if (result.matched !== undefined) stats.push({ label: 'Matched', value: String(result.matched) });
    if (result.updated !== undefined) stats.push({ label: 'Updated', value: String(result.updated) });
    if (result.skipped !== undefined) stats.push({ label: 'Sem match', value: String(result.skipped) });
    if (result.durationMs !== undefined) stats.push({ label: 'Duracao', value: `${(result.durationMs / 1000).toFixed(1)}s` });
  } else {
    // Generic: show all top-level non-object keys
    Object.entries(result).forEach(([key, val]) => {
      if (typeof val !== 'object' || val === null) {
        stats.push({ label: key, value: String(val) });
      }
    });
  }

  return (
    <div className="border-t border-border">
      {stats.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-3">
          {stats.slice(0, 8).map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className="text-sm font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center py-1.5 text-[10px] text-muted-foreground hover:text-foreground border-t border-border"
      >
        {expanded ? 'Ocultar JSON' : 'Ver JSON completo'}
      </button>
      {expanded && (
        <pre className="p-3 text-[10px] text-foreground/70 font-mono max-h-64 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function PipelinesTab() {
  const [states, setStates] = useState<Record<string, PipelineState>>({});
  const [configs, setConfigs] = useState<Record<string, Record<string, any>>>({});
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [, setTick] = useState(0);

  // Live timer: force re-render every second while any pipeline is running
  useEffect(() => {
    const hasRunning = Object.values(states).some(s => s.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [states]);

  const getState = (id: string): PipelineState =>
    states[id] || { status: 'idle', logs: [] };

  const getConfig = (id: string, pipeline: typeof PIPELINES[number]) => {
    if (configs[id]) return configs[id];
    const defaults: Record<string, any> = {};
    pipeline.configFields.forEach((f) => { defaults[f.key] = f.default; });
    return defaults;
  };

  const updateConfig = (id: string, key: string, value: any) => {
    setConfigs((prev) => ({
      ...prev,
      [id]: { ...getConfig(id, PIPELINES.find((p) => p.id === id)!), [key]: value },
    }));
  };

  const addLog = useCallback((id: string, step: string, message: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setStates((prev) => {
      const cur = prev[id] || { status: 'running', logs: [] };
      return {
        ...prev,
        [id]: { ...cur, logs: [...cur.logs, { time, step, message }], step },
      };
    });
    // Auto-scroll
    setTimeout(() => {
      logEndRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  const updateState = useCallback((id: string, patch: Partial<PipelineState>) => {
    setStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { status: 'idle', logs: [] }), ...patch },
    }));
  }, []);

  // Clean up polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  const runPipeline = async (pipeline: typeof PIPELINES[number]) => {
    const id = pipeline.id;
    const cfg = getConfig(id, pipeline);

    updateState(id, { status: 'running', logs: [], startedAt: Date.now(), finishedAt: undefined, result: undefined, error: undefined, progress: 0 });

    if (pipeline.mode === 'sse') {
      // SSE streaming — YouTube Smart Scan
      try {
        const body: Record<string, any> = {};
        pipeline.configFields.forEach((f) => {
          body[f.key] = f.type === 'number' ? Number(cfg[f.key]) : cfg[f.key];
        });

        const response = await fetch(`${API}${pipeline.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'log';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === 'log') {
                  addLog(id, data.step || 'info', data.message || JSON.stringify(data));
                } else if (currentEvent === 'result') {
                  const elapsed = Date.now() - (states[id]?.startedAt || Date.now());
                  updateState(id, {
                    status: 'done',
                    finishedAt: Date.now(),
                    result: data,
                  });
                  addLog(id, 'done', `Concluido em ${(elapsed / 1000).toFixed(1)}s`);
                } else if (currentEvent === 'error') {
                  updateState(id, { status: 'error', error: data.message, finishedAt: Date.now() });
                  addLog(id, 'error', data.message);
                }
              } catch { /* skip malformed JSON */ }
            }
          }
        }

        // If still running after stream ends, mark done
        setStates((prev) => {
          const cur = prev[id];
          if (cur?.status === 'running') {
            return { ...prev, [id]: { ...cur, status: 'done', finishedAt: Date.now() } };
          }
          return prev;
        });
      } catch (e: any) {
        updateState(id, { status: 'error', error: e.message, finishedAt: Date.now() });
        addLog(id, 'error', e.message);
      }
    } else if (pipeline.mode === 'poll') {
      // Fire + poll status
      try {
        const body: Record<string, any> = {};
        pipeline.configFields.forEach((f) => {
          if (f.type === 'number') body[f.key] = Number(cfg[f.key]);
          else if (f.type === 'boolean') body[f.key] = Boolean(cfg[f.key]);
          else body[f.key] = cfg[f.key];
        });

        const res = await fetch(`${API}${pipeline.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        addLog(id, 'start', 'Pipeline iniciado');

        // Poll status
        let lastLogCount = 0;
        const statusUrl = `${API}${pipeline.statusEndpoint}`;
        pollingRef.current[id] = setInterval(async () => {
          try {
            const sr = await fetch(statusUrl);
            const status = await sr.json();

            // Add new logs
            if (status.logs && status.logs.length > lastLogCount) {
              for (let i = lastLogCount; i < status.logs.length; i++) {
                addLog(id, status.step || 'info', status.logs[i]);
              }
              lastLogCount = status.logs.length;
            }

            updateState(id, { progress: status.progress || 0, step: status.step });

            if (!status.running) {
              clearInterval(pollingRef.current[id]);
              delete pollingRef.current[id];
              const elapsed = Date.now() - (states[id]?.startedAt || Date.now());
              updateState(id, {
                status: status.result ? 'done' : 'error',
                finishedAt: Date.now(),
                result: status.result,
              });
              addLog(id, 'done', `Concluido em ${(elapsed / 1000).toFixed(1)}s`);
            }
          } catch { /* ignore poll errors */ }
        }, 1500);
      } catch (e: any) {
        updateState(id, { status: 'error', error: e.message, finishedAt: Date.now() });
        addLog(id, 'error', e.message);
      }
    } else {
      // Fire-and-forget
      try {
        const body: Record<string, any> = { ...((pipeline as any).body || {}) };
        pipeline.configFields.forEach((f) => {
          if (f.type === 'number') body[f.key] = Number(cfg[f.key]);
          else if (f.type === 'text' && f.key === 'seeds') {
            body[f.key] = String(cfg[f.key]).split(',').map((s: string) => s.trim()).filter(Boolean);
          } else body[f.key] = cfg[f.key];
        });

        const res = await fetch(`${API}${pipeline.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        addLog(id, 'start', 'Pipeline disparado');
        if (data.error) {
          updateState(id, { status: 'error', error: data.error, finishedAt: Date.now() });
          addLog(id, 'error', data.error);
        } else {
          addLog(id, 'info', `Resposta: ${JSON.stringify(data)}`);
          updateState(id, { status: 'done', finishedAt: Date.now(), result: data });
          addLog(id, 'done', 'Pipeline iniciado em background (sem log em tempo real)');
        }
      } catch (e: any) {
        updateState(id, { status: 'error', error: e.message, finishedAt: Date.now() });
        addLog(id, 'error', e.message);
      }
    }
  };

  return (
    <div>
      <PipelineCostsCard />

      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Pipeline Runner</h2>
        <p className="text-xs text-muted-foreground">Dispare pipelines e acompanhe logs e performance em tempo real</p>
      </div>

      <div className="space-y-4">
        {PIPELINES.map((pipeline) => {
          const state = getState(pipeline.id);
          const cfg = getConfig(pipeline.id, pipeline);
          const elapsed = state.startedAt
            ? ((state.finishedAt || Date.now()) - state.startedAt) / 1000
            : 0;

          return (
            <div key={pipeline.id} className="bg-surface border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-foreground">{pipeline.name}</h3>
                    <PipelineStatusBadge status={state.status} />
                    {state.status === 'running' && state.step && (
                      <span className="text-[10px] text-muted-foreground font-mono">{state.step}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {elapsed > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {elapsed < 60 ? `${elapsed.toFixed(1)}s` : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`}
                      </span>
                    )}
                    <button
                      onClick={() => runPipeline(pipeline)}
                      disabled={state.status === 'running'}
                      className="px-3 py-1.5 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {state.status === 'running' ? 'Executando...' : 'Executar'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{pipeline.description}</p>

                {/* Config fields */}
                {pipeline.configFields.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {pipeline.configFields.map((f) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</label>
                        {f.type === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={!!cfg[f.key]}
                            onChange={(e) => updateConfig(pipeline.id, f.key, e.target.checked)}
                            disabled={state.status === 'running'}
                            className="accent-foreground"
                          />
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={cfg[f.key] ?? f.default}
                            onChange={(e) => updateConfig(pipeline.id, f.key, e.target.value)}
                            disabled={state.status === 'running'}
                            className="w-auto min-w-[80px] bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress bar for poll-mode */}
                {state.status === 'running' && state.progress !== undefined && state.progress > 0 && (
                  <div className="mt-3 w-full bg-background rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, state.progress)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Log viewer */}
              {state.logs.length > 0 && (
                <div className="border-t border-border bg-background/50">
                  <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-5 p-3">
                    {state.logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">{log.time}</span>
                        <span className={`shrink-0 w-20 text-right ${STEP_COLORS[log.step] || 'text-muted-foreground'}`}>
                          [{log.step}]
                        </span>
                        <span className="text-foreground/80 break-all">{log.message}</span>
                      </div>
                    ))}
                    <div ref={(el) => { logEndRefs.current[pipeline.id] = el; }} />
                  </div>
                </div>
              )}

              {/* Result summary */}
              {state.status === 'done' && state.result && (
                <PipelineResultSummary pipelineId={pipeline.id} result={state.result} />
              )}

              {/* Error */}
              {state.status === 'error' && state.error && (
                <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2">
                  <span className="text-xs text-red-400">{state.error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
