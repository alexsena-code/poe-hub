'use client';

// Edits ideation system prompt and qdrant research config via
// GET/PUT /api/engine/config/ideation

import { useEffect, useState } from 'react';

const API = '/api/engine';

export default function IdeationTab() {
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
