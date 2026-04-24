'use client';

// Edits competitor list (domain / sitemap / path filter / categories) via
// GET/PUT /api/engine/config/competitors

import { useEffect, useState } from 'react';

const API = '/api/engine';

export default function CompetitorsTab() {
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
