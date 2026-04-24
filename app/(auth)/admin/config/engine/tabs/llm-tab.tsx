'use client';

// Edits LLM node model assignments via PUT /api/engine/config/llm-nodes
// Loads available models from GET /api/engine/config/openrouter-models

import { useEffect, useState } from 'react';

const API = '/api/engine';

interface LlmNode {
  model: string;
}

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

export default function LlmTab({
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
