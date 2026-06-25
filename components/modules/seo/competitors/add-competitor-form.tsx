'use client';

// AddCompetitorForm — form panel for POST /seo/competitors.
// Categories are optional (v1): enter as "pattern: category" lines, one per line.
// Mirrors the visual style of ManageChannelsTab's add-channel panel.

import { useState } from 'react';
import type { AddCompetitorPayload } from './types';

interface AddCompetitorFormProps {
  onAdd: (payload: AddCompetitorPayload) => Promise<void>;
  adding: boolean;
}

// Parses a textarea of "pattern: category" lines into a Record.
// Lines without a colon separator are silently skipped.
function parseCategoryLines(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const sep = line.indexOf(':');
    if (sep <= 0) continue;
    const pattern = line.slice(0, sep).trim();
    const category = line.slice(sep + 1).trim();
    if (pattern && category) result[pattern] = category;
  }
  return result;
}

export function AddCompetitorForm({ onAdd, adding }: AddCompetitorFormProps) {
  const [domain, setDomain] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [catText, setCatText] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  async function handleSubmit() {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) return;

    const payload: AddCompetitorPayload = {
      domain: trimmedDomain,
    };
    if (sitemapUrl.trim()) payload.sitemapUrl = sitemapUrl.trim();
    if (pathFilter.trim()) payload.pathFilter = pathFilter.trim();
    if (catText.trim()) payload.categories = parseCategoryLines(catText);

    await onAdd(payload);
    setDomain('');
    setSitemapUrl('');
    setPathFilter('');
    setCatText('');
    setShowCategories(false);
  }

  const canSubmit = domain.trim().length > 0 && !adding;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        Adicionar concorrente
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">
            Domínio <span className="text-destructive">*</span>
          </label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
            placeholder="maxroll.gg"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground block mb-1">
            Sitemap URL (opcional)
          </label>
          <input
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="https://dominio/sitemap.xml"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">
            Path Filter regex (opcional, default <code className="text-[10px]">.+</code>)
          </label>
          <input
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="/poe/(builds|guides)"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
        >
          {adding ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowCategories((v) => !v)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCategories ? '▾ Ocultar categorias' : '▸ Definir categorias (opcional)'}
        </button>
        {showCategories && (
          <div className="mt-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Categorias (pattern: category, uma por linha)
            </label>
            <textarea
              value={catText}
              onChange={(e) => setCatText(e.target.value)}
              rows={3}
              placeholder={'builds: build_guide\nguides: mechanic_guide'}
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground font-mono resize-y placeholder:text-muted-foreground/50"
            />
          </div>
        )}
      </div>
    </div>
  );
}
