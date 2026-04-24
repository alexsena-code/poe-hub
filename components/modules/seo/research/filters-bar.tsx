'use client';

// Keyword filter dropdown — source / cluster / game / longTailOnly toggles.
// Renders as a floating panel triggered by a funnel icon button.

import React, { useState } from 'react';
import { CLUSTERS, SOURCES, GAMES, clusterLabel } from '../shared/helpers';
import type { ResearchFilters } from './use-research-state';

interface FiltersBarProps {
  filters: ResearchFilters;
  onChange: (partial: Partial<ResearchFilters>) => void;
}

const hasActiveFilter = (f: ResearchFilters) =>
  f.source !== 'all' || f.cluster !== 'all' || f.game !== 'all' || f.longTailOnly;

export function FiltersBar({ filters, onChange }: FiltersBarProps) {
  const [open, setOpen] = useState(false);
  const active = hasActiveFilter(filters);

  function clearAll() {
    onChange({ source: 'all', cluster: 'all', game: 'all', longTailOnly: false });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-1.5 rounded transition-colors ${
          open || active
            ? 'bg-foreground/15 text-foreground'
            : 'bg-foreground/5 text-muted-foreground hover:text-foreground'
        }`}
        title="Filters"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground">Filters</span>
            {active && (
              <button
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Source
              </label>
              <select
                value={filters.source}
                onChange={(e) => onChange({ source: e.target.value })}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All Sources' : s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Cluster
              </label>
              <select
                value={filters.cluster}
                onChange={(e) => onChange({ cluster: e.target.value })}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
              >
                {CLUSTERS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All Clusters' : clusterLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Game
              </label>
              <select
                value={filters.game}
                onChange={(e) => onChange({ game: e.target.value })}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
              >
                {GAMES.map((g) => (
                  <option key={g} value={g}>
                    {g === 'all' ? 'All Games' : g === 'poe1' ? 'PoE 1' : g === 'poe2' ? 'PoE 2' : 'Both'}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground pt-1 border-t border-border">
              <input
                type="checkbox"
                checked={filters.longTailOnly}
                onChange={(e) => onChange({ longTailOnly: e.target.checked })}
                className="rounded border-border"
              />
              Long-tail only
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
