'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const KeybertPanel = dynamic(() => import('./keybert-tab'), { loading: () => <div className="py-8 text-center text-muted-foreground">Carregando...</div> });

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

const COLLECTION_LABELS: Record<string, string> = {
  poe_wiki: 'Wiki (verified data)',
  poe_builds: 'Builds (poe.ninja)',
  poe_patch_notes: 'Patch Notes (GGG)',
  poe_ggg_news: 'GGG News',
  poe_transcripts: 'YouTube Transcripts',
  poe_reddit: 'Reddit Posts',
  poe_meta: 'Summaries (auto)',
  poe_youtube_trends: 'YouTube Trends',
};

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

// ─── Save button ───────────────────────────────────────────────────

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {saving ? 'Salvando...' : 'Salvar'}
    </button>
  );
}

// ─── Collection Weights ────────────────────────────────────────────

function WeightsPanel({
  weights, onChange, onSave, saving,
}: {
  weights: Record<string, number>;
  onChange: (w: Record<string, number>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (key: string, val: number) => {
    onChange({ ...weights, [key]: Math.round(val * 100) / 100 });
  };

  const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collection Weights</h2>
          <p className="text-xs text-muted-foreground">Multiplicador aplicado ao score de similaridade do Qdrant. Wiki = baseline 1.0</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-3">
        {sorted.map(([key, value]) => (
          <div key={key} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{COLLECTION_LABELS[key] || ''}</span>
              </div>
              <span className="text-sm font-mono text-foreground">{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={value}
              onChange={(e) => update(key, parseFloat(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0.0 (ignorar)</span>
              <span>0.5</span>
              <span>1.0 (full trust)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Query Routing ─────────────────────────────────────────────────

const ALL_COLLECTIONS = [
  'poe_wiki', 'poe_builds', 'poe_patch_notes', 'poe_ggg_news',
  'poe_transcripts', 'poe_reddit', 'poe_meta', 'poe_youtube_trends',
];

const ALL_LAYERS = ['exact_data', 'chunks', 'summary', 'build_meta'];

function RoutingPanel({
  routing, onChange, onSave, saving,
}: {
  routing: Record<string, QueryRoute>;
  onChange: (r: Record<string, QueryRoute>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateRoute = (key: string, patch: Partial<QueryRoute>) => {
    onChange({ ...routing, [key]: { ...routing[key], ...patch } });
  };

  const toggleCollection = (routeKey: string, col: string) => {
    const route = routing[routeKey];
    const cols = route.collections || [];
    const next = cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col];
    updateRoute(routeKey, { collections: next });
  };

  const toggleLayer = (routeKey: string, layer: string) => {
    const route = routing[routeKey];
    const layers = route.layers || [];
    const next = layers.includes(layer) ? layers.filter((l) => l !== layer) : [...layers, layer];
    updateRoute(routeKey, { layers: next });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Query Routing</h2>
          <p className="text-xs text-muted-foreground">Define quais layers e collections cada tipo de query usa</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-2">
        {Object.entries(routing).map(([key, route]) => (
          <div key={key} className="bg-surface border border-border rounded-lg">
            <button
              onClick={() => setExpanded(expanded === key ? null : key)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{route.description}</span>
              </div>
              <span className="text-muted-foreground text-xs">{expanded === key ? 'v' : '>'}</span>
            </button>

            {expanded === key && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Chunk limit</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={route.chunk_limit}
                    onChange={(e) => updateRoute(key, { chunk_limit: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Layers</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_LAYERS.map((layer) => (
                      <button
                        key={layer}
                        onClick={() => toggleLayer(key, layer)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          (route.layers || []).includes(layer)
                            ? 'bg-foreground/10 border-foreground/30 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {layer}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Collections</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COLLECTIONS.map((col) => (
                      <button
                        key={col}
                        onClick={() => toggleCollection(key, col)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          (route.collections || []).includes(col)
                            ? 'bg-foreground/10 border-foreground/30 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {col.replace('poe_', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Exemplo</label>
                  <input
                    value={route.example || ''}
                    onChange={(e) => updateRoute(key, { example: e.target.value })}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LLM Nodes ─────────────────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  pricing: { input: number; output: number };
}

function groupModels(models: OpenRouterModel[]): { group: string; models: OpenRouterModel[] }[] {
  const groups: Record<string, OpenRouterModel[]> = {};
  for (const m of models) {
    const provider = m.id.split('/')[0] || 'other';
    if (!groups[provider]) groups[provider] = [];
    groups[provider].push(m);
  }
  const order = ['google', 'anthropic', 'openai', 'x-ai', 'deepseek', 'meta-llama', 'mistralai'];
  const sorted = order.filter((k) => groups[k]).concat(Object.keys(groups).filter((k) => !order.includes(k)).sort());
  return sorted.map((key) => ({ group: key, models: groups[key] }));
}

function ModelSelect({ value, onChange, models, className }: {
  value: string;
  onChange: (model: string) => void;
  models: OpenRouterModel[];
  className?: string;
}) {
  const grouped = groupModels(models);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || 'bg-background border border-border rounded px-2 py-1 text-sm text-foreground flex-1'}
    >
      {grouped.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ${m.pricing.input.toFixed(2)}/$M in
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function LlmPanel({
  llm, onChange, onSave, saving,
}: {
  llm: { default: LlmNode; nodes: Record<string, LlmNode> };
  onChange: (l: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);

  useEffect(() => {
    fetch(`${API}/config/openrouter-models`)
      .then((r) => r.json())
      .then((data) => setModels(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const updateNode = (nodeName: string, model: string) => {
    onChange({ ...llm, nodes: { ...llm.nodes, [nodeName]: { model } } });
  };

  const updateDefault = (model: string) => {
    onChange({ ...llm, default: { model } });
  };

  const nodeNames = Object.keys(llm.nodes || {});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">LLM por Node</h2>
          <p className="text-xs text-muted-foreground">
            Cada node do pipeline pode usar um modelo diferente (via OpenRouter)
            {models.length > 0 && <span className="ml-1">— {models.length} modelos</span>}
          </p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      {models.length === 0 && (
        <div className="text-xs text-muted-foreground mb-3">Carregando modelos do OpenRouter...</div>
      )}

      {/* Default */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-3">
        <div className="text-sm font-medium text-foreground mb-2">default (fallback)</div>
        <ModelSelect
          value={llm.default?.model || 'google/gemini-2.5-flash-lite'}
          onChange={updateDefault}
          models={models}
        />
      </div>

      {/* Per-node */}
      <div className="space-y-2">
        {nodeNames.map((name) => {
          const node = llm.nodes[name] || llm.default;
          return (
            <div key={name} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {node.model}
                </span>
              </div>
              <ModelSelect
                value={node.model}
                onChange={(model) => updateNode(name, model)}
                models={models}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Token Budget ──────────────────────────────────────────────────

const BUDGET_LABELS: Record<string, string> = {
  exact_data_max: 'PostgreSQL (dados exatos)',
  chunks_max: 'Qdrant chunks (apos reranking)',
  summary_max: 'poe_meta summary',
  total_context_max: 'Total context (excl. system prompt)',
};

function BudgetPanel({
  budget, onChange, onSave, saving,
}: {
  budget: Record<string, number>;
  onChange: (b: Record<string, number>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Token Budget</h2>
          <p className="text-xs text-muted-foreground">Limite de tokens por layer no context assembly</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      <div className="space-y-3">
        {Object.entries(budget).map(([key, value]) => (
          <div key={key} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">{key}</span>
                <span className="text-xs text-muted-foreground ml-2">{BUDGET_LABELS[key] || ''}</span>
              </div>
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                value={value}
                onChange={(e) => onChange({ ...budget, [key]: parseInt(e.target.value) || 0 })}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-foreground text-right font-mono"
              />
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-foreground/30 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (value / 1500) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Style Guide ───────────────────────────────────────────────────

function StylePanel({
  guide, onChange, onSave, saving,
}: {
  guide: AllConfig['styleGuide'];
  onChange: (g: AllConfig['styleGuide']) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newRule, setNewRule] = useState('');
  const [newFormatting, setNewFormatting] = useState('');

  const addPhrase = () => {
    const trimmed = newPhrase.trim().toLowerCase();
    if (trimmed && !guide.banned_phrases.includes(trimmed)) {
      onChange({ ...guide, banned_phrases: [...guide.banned_phrases, trimmed] });
      setNewPhrase('');
    }
  };

  const removePhrase = (phrase: string) => {
    onChange({ ...guide, banned_phrases: guide.banned_phrases.filter((p) => p !== phrase) });
  };

  const addRule = () => {
    const trimmed = newRule.trim();
    if (trimmed) {
      onChange({ ...guide, rules: [...guide.rules, trimmed] });
      setNewRule('');
    }
  };

  const removeRule = (idx: number) => {
    onChange({ ...guide, rules: guide.rules.filter((_, i) => i !== idx) });
  };

  const addFormatting = () => {
    const trimmed = newFormatting.trim();
    if (trimmed) {
      onChange({ ...guide, formatting: [...(guide.formatting || []), trimmed] });
      setNewFormatting('');
    }
  };

  const removeFormatting = (idx: number) => {
    onChange({ ...guide, formatting: (guide.formatting || []).filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Style Guide</h2>
          <p className="text-xs text-muted-foreground">Voice, regras e banned phrases injetados no system prompt</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      {/* Voice */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Voice</h3>
        <div className="space-y-2">
          {(['tone', 'persona', 'language'] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground block mb-1">{field}</label>
              <input
                value={guide.voice?.[field] || ''}
                onChange={(e) => onChange({
                  ...guide,
                  voice: { ...guide.voice, [field]: e.target.value },
                })}
                className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Banned Phrases */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Banned Phrases
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.banned_phrases?.length || 0})</span>
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {(guide.banned_phrases || []).map((phrase) => (
            <span
              key={phrase}
              className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400"
            >
              &quot;{phrase}&quot;
              <button onClick={() => removePhrase(phrase)} className="hover:text-red-300 ml-1">x</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
            placeholder="Adicionar frase banida..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addPhrase}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Rules
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.rules?.length || 0})</span>
        </h3>
        <div className="space-y-2 mb-3">
          {(guide.rules || []).map((rule, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-background rounded p-2">
              <span className="text-xs text-muted-foreground mt-0.5 shrink-0">{idx + 1}.</span>
              <span className="text-xs text-foreground flex-1">{typeof rule === 'string' ? rule : JSON.stringify(rule)}</span>
              <button
                onClick={() => removeRule(idx)}
                className="text-muted-foreground hover:text-red-400 text-xs shrink-0"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Adicionar regra..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addRule}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>

      {/* Formatting */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Formatting Rules
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.formatting?.length || 0})</span>
        </h3>
        <div className="space-y-2 mb-3">
          {(guide.formatting || []).map((rule, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-background rounded p-2">
              <span className="text-xs text-foreground flex-1">{rule}</span>
              <button
                onClick={() => removeFormatting(idx)}
                className="text-muted-foreground hover:text-red-400 text-xs shrink-0"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newFormatting}
            onChange={(e) => setNewFormatting(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFormatting()}
            placeholder="Adicionar regra de formatação..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addFormatting}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ideation Prompt Panel ─────────────────────────────────────────

function IdeationPanel() {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/config/ideation`).then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await fetch(`${API}/config/ideation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setMsg('Saved');
      setTimeout(() => setMsg(null), 2000);
    } catch { setMsg('Failed'); }
    setSaving(false);
  }

  if (!config) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Ideation System Prompt</h2>
          <p className="text-xs text-muted-foreground">Prompt enviado ao LLM para gerar content briefs</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-emerald-400">{msg}</span>}
          <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded text-xs font-medium transition-colors disabled:opacity-40">
            {saving ? 'Saving...' : 'Salvar'}
          </button>
        </div>
      </div>

      <textarea
        value={config.system_prompt || ''}
        onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
        rows={20}
        className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground font-mono leading-relaxed resize-y"
        placeholder="System prompt for ideation..."
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Qdrant Research</label>
          <select
            value={config.qdrant_research?.enabled !== false ? 'true' : 'false'}
            onChange={e => setConfig({
              ...config,
              qdrant_research: { ...config.qdrant_research, enabled: e.target.value === 'true' },
            })}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Top Keywords</label>
          <input
            type="number"
            value={config.qdrant_research?.top_keywords ?? 20}
            onChange={e => setConfig({
              ...config,
              qdrant_research: { ...config.qdrant_research, top_keywords: Number(e.target.value) },
            })}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Chunks/Keyword</label>
          <input
            type="number"
            value={config.qdrant_research?.chunks_per_keyword ?? 3}
            onChange={e => setConfig({
              ...config,
              qdrant_research: { ...config.qdrant_research, chunks_per_keyword: Number(e.target.value) },
            })}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Competitors Panel ────────────────────────────────────────────

function CompetitorsPanel() {
  const [competitors, setCompetitors] = useState<Array<{ domain: string; sitemapUrl: string; pathFilter: string; categories: Record<string, string> }>>([]);
  const [catTexts, setCatTexts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/config/competitors`).then(r => r.json()).then(data => {
      const arr = Array.isArray(data) ? data : [];
      setCompetitors(arr);
      const texts: Record<number, string> = {};
      arr.forEach((c: any, i: number) => {
        texts[i] = Object.entries(c.categories || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      });
      setCatTexts(texts);
    }).catch(() => {});
  }, []);

  function buildCompetitorsWithCats(): typeof competitors {
    return competitors.map((c, i) => {
      const cats: Record<string, string> = {};
      (catTexts[i] || '').split('\n').filter(Boolean).forEach(line => {
        const sep = line.indexOf(':');
        if (sep > 0) {
          cats[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
        }
      });
      return { ...c, categories: cats };
    });
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`${API}/config/competitors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCompetitorsWithCats()),
      });
      setMsg('Saved');
      setTimeout(() => setMsg(null), 2000);
    } catch { setMsg('Failed'); }
    setSaving(false);
  }

  function addCompetitor() {
    const newIdx = competitors.length;
    setCompetitors([...competitors, { domain: '', sitemapUrl: '', pathFilter: '/', categories: {} }]);
    setCatTexts({ ...catTexts, [newIdx]: 'default: mechanic_guide' });
  }

  function removeCompetitor(i: number) {
    setCompetitors(competitors.filter((_, idx) => idx !== i));
    const newTexts: Record<number, string> = {};
    Object.entries(catTexts).forEach(([k, v]) => {
      const idx = Number(k);
      if (idx < i) newTexts[idx] = v;
      else if (idx > i) newTexts[idx - 1] = v;
    });
    setCatTexts(newTexts);
  }

  function updateField(i: number, field: string, value: string) {
    const copy = [...competitors];
    (copy[i] as any)[field] = value;
    setCompetitors(copy);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Competitors</h2>
          <p className="text-xs text-muted-foreground">Sites concorrentes para gap analysis via sitemap crawl</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-emerald-400">{msg}</span>}
          <button onClick={addCompetitor} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors">
            + Add
          </button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 text-foreground rounded text-xs font-medium transition-colors disabled:opacity-40">
            {saving ? 'Saving...' : 'Salvar'}
          </button>
        </div>
      </div>

      {competitors.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No competitors configured.</div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">{c.domain || 'New competitor'}</span>
                <button onClick={() => removeCompetitor(i)} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Domain</label>
                  <input
                    value={c.domain}
                    onChange={e => updateField(i, 'domain', e.target.value)}
                    placeholder="maxroll.gg"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Sitemap URL</label>
                  <input
                    value={c.sitemapUrl}
                    onChange={e => updateField(i, 'sitemapUrl', e.target.value)}
                    placeholder="https://maxroll.gg/poe/sitemap.xml"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Path Filter (regex)</label>
                  <input
                    value={c.pathFilter}
                    onChange={e => updateField(i, 'pathFilter', e.target.value)}
                    placeholder="/poe/(builds|guides)"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Categories (pattern: category, one per line)</label>
                <textarea
                  value={catTexts[i] ?? Object.entries(c.categories || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}
                  onChange={e => setCatTexts({ ...catTexts, [i]: e.target.value })}
                  rows={3}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono resize-y"
                  placeholder="builds: build_guide&#10;guides: mechanic_guide"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RAG Playground ────────────────────────────────────────────────

function PlaygroundPanel() {
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

// ─── Pipelines Runner ─────────────────────────────────────────────

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

function PipelinesPanel() {
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

// ─── Small components ──────────────────────────────────────────────

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
