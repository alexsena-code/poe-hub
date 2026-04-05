'use client';

import { useState, useEffect, useCallback } from 'react';

const API = '/api/engine';

const ALL_MODULES = [
  { id: 'keyword_extractor', label: 'Keyword Extractor', desc: 'Extract keywords from Reddit + YouTube transcripts' },
  { id: 'competitor_keywords', label: 'Competitor Keywords', desc: 'Extract keywords from competitor pages' },
  { id: 'patch_keywords', label: 'Patch Keywords', desc: 'Extract keywords from patch notes (Qdrant)' },
  { id: 'content_coverage', label: 'Content Coverage', desc: 'Validate generated posts cover target keywords' },
  { id: 'internal_links', label: 'Internal Links', desc: 'Suggest semantic internal links between posts' },
];

interface TaskEntry {
  task: { id: string; modules: string[] };
  result?: { summary: Record<string, unknown>; error?: string; durationMs?: number };
  dispatchedAt: string;
  completedAt?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function KeybertTab() {
  const [online, setOnline] = useState(false);
  const [history, setHistory] = useState<TaskEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(ALL_MODULES.map((m) => m.id));
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seo/keybert/status`);
      const data = await res.json();
      setOnline(data.workerOnline);
      setHistory(data.taskHistory ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10_000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  async function handleDispatch() {
    if (selectedModules.length === 0) return;
    setDispatching(true);
    try {
      const res = await fetch(`${API}/seo/keybert/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: selectedModules }),
      });
      const data = await res.json();
      if (data.dispatched) {
        showToast('Task enviada ao worker');
      } else {
        showToast('Worker offline — task nao enviada');
      }
      await loadStatus();
    } catch {
      showToast('Erro ao enviar task');
    } finally {
      setDispatching(false);
    }
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-surface border border-border px-4 py-2 text-sm text-foreground shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">KeyBERT Worker</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-foreground font-medium">
            {online ? 'Worker Online' : 'Worker Offline'}
          </span>
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {/* Module Selector */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Modules</h2>
        <div className="grid grid-cols-1 gap-2">
          {ALL_MODULES.map((mod) => (
            <label
              key={mod.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedModules.includes(mod.id)
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-border bg-surface'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(mod.id)}
                onChange={() => toggleModule(mod.id)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <div className="text-sm font-medium text-foreground">{mod.label}</div>
                <div className="text-xs text-muted-foreground">{mod.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleDispatch}
          disabled={dispatching || selectedModules.length === 0}
          className="mt-4 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dispatching ? 'Enviando...' : `Executar ${selectedModules.length} module(s)`}
        </button>
      </section>

      {/* Task History */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Task History ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma task registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...history].reverse().map((entry) => (
              <div
                key={entry.task.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">#{entry.task.id}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.dispatchedAt)}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {entry.result?.error ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">Erro</span>
                  ) : entry.completedAt ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Concluido</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">Em execucao</span>
                  )}
                  {entry.result?.durationMs && (
                    <span className="text-xs text-muted-foreground">{(entry.result.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {entry.task.modules.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded bg-foreground/5 text-xs text-muted-foreground">
                      {m}
                    </span>
                  ))}
                </div>

                {entry.result?.summary && (
                  <pre className="text-xs text-muted-foreground bg-background rounded p-2 overflow-x-auto">
                    {JSON.stringify(entry.result.summary, null, 2)}
                  </pre>
                )}

                {entry.result?.error && (
                  <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 mt-1">
                    {entry.result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
