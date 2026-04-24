'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const tabLoading = () => (
  <div className="py-8 text-center text-muted-foreground">Carregando...</div>
);

const WeightsPanel = dynamic(() => import('./tabs/weights-tab'), { loading: tabLoading });
const RoutingPanel = dynamic(() => import('./tabs/routing-tab'), { loading: tabLoading });
const LlmPanel = dynamic(() => import('./tabs/llm-tab'), { loading: tabLoading });
const BudgetPanel = dynamic(() => import('./tabs/budget-tab'), { loading: tabLoading });
const StylePanel = dynamic(() => import('./tabs/style-tab'), { loading: tabLoading });
const IdeationPanel = dynamic(() => import('./tabs/ideation-tab'), { loading: tabLoading });
const CompetitorsPanel = dynamic(() => import('./tabs/competitors-tab'), { loading: tabLoading });
const PlaygroundPanel = dynamic(() => import('./tabs/playground-tab'), { loading: tabLoading });
const PipelinesPanel = dynamic(() => import('./tabs/pipelines-tab'), { loading: tabLoading });
const KeybertPanel = dynamic(() => import('./keybert-tab'), { loading: tabLoading });

const API = '/api/engine';

// ─── Types ─────────────────────────────────────────────────────────

interface AllConfig {
  collectionWeights: Record<string, number>;
  tokenBudget: Record<string, number>;
  llm: { default: LlmNode; nodes: Record<string, LlmNode> };
  queryRouting: Record<string, QueryRoute>;
  styleGuide: {
    voice: { tone: string; persona: string; language: string };
    rules: string[];
    banned_phrases: string[];
    formatting: string[];
  };
}

interface LlmNode {
  model: string;
}

interface QueryRoute {
  description: string;
  layers: string[];
  chunk_limit: number;
  collections: string[];
  example: string;
}

type Tab = 'weights' | 'routing' | 'llm' | 'budget' | 'style' | 'ideation' | 'competitors' | 'playground' | 'pipelines' | 'keybert';

const TABS: { key: Tab; label: string }[] = [
  { key: 'weights', label: 'Collection Weights' },
  { key: 'routing', label: 'Query Routing' },
  { key: 'llm', label: 'LLM Nodes' },
  { key: 'budget', label: 'Token Budget' },
  { key: 'style', label: 'Style Guide' },
  { key: 'ideation', label: 'Ideation Prompt' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'playground', label: 'RAG Playground' },
  { key: 'pipelines', label: 'Pipelines' },
  { key: 'keybert', label: 'KeyBERT' },
];

// ─── Main page ─────────────────────────────────────────────────────

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('weights');
  const [config, setConfig] = useState<AllConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    fetch(`${API}/config/all`)
      .then((r) => r.json())
      .then((data) => { setConfig(data); setLoading(false); })
      .catch(() => { setLoading(false); showToast('Erro ao carregar config'); });
  }, [showToast]);

  const saveSection = async (endpoint: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/config/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      showToast('Salvo!');
    } catch {
      showToast('Erro ao salvar');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando config...</div>;
  if (!config) return <div className="p-8 text-red-400">Falha ao carregar config</div>;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold text-foreground mb-1">Engine Config</h1>
      <p className="text-sm text-muted-foreground mb-5">Alteracoes aplicam imediatamente (hot-reload YAML)</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-[1px] ${
              tab === t.key
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'weights' && (
        <WeightsPanel
          weights={config.collectionWeights}
          onChange={(w) => setConfig({ ...config, collectionWeights: w })}
          onSave={() => saveSection('collection-weights', config.collectionWeights)}
          saving={saving}
        />
      )}
      {tab === 'routing' && (
        <RoutingPanel
          routing={config.queryRouting}
          onChange={(r) => setConfig({ ...config, queryRouting: r })}
          onSave={() => saveSection('query-routing', config.queryRouting)}
          saving={saving}
        />
      )}
      {tab === 'llm' && (
        <LlmPanel
          llm={config.llm}
          onChange={(l) => setConfig({ ...config, llm: l })}
          onSave={() => saveSection('llm-nodes', config.llm)}
          saving={saving}
        />
      )}
      {tab === 'budget' && (
        <BudgetPanel
          budget={config.tokenBudget}
          onChange={(b) => setConfig({ ...config, tokenBudget: b })}
          onSave={() => saveSection('token-budget', config.tokenBudget)}
          saving={saving}
        />
      )}
      {tab === 'style' && (
        <StylePanel
          guide={config.styleGuide}
          onChange={(g) => setConfig({ ...config, styleGuide: g })}
          onSave={() => saveSection('style-guide', config.styleGuide)}
          saving={saving}
        />
      )}
      {tab === 'ideation' && <IdeationPanel />}
      {tab === 'competitors' && <CompetitorsPanel />}
      {tab === 'playground' && <PlaygroundPanel />}
      {tab === 'pipelines' && <PipelinesPanel />}
      {tab === 'keybert' && <KeybertPanel />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-lg px-4 py-2 text-sm text-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
