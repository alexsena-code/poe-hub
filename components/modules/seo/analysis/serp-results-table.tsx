'use client';

// SERP Results table — top 10 URLs from engine SERP snapshot.
// Highlights our domain (emerald) and tracked competitors (amber).

import React from 'react';
import { SeoBadge } from '../shared/seo-primitives';
import type { SerpSnapshot } from '../shared/types';

interface SerpResultsTableProps {
  snapshot: SerpSnapshot;
}

export function SerpResultsTable({ snapshot }: SerpResultsTableProps) {
  if (!snapshot.found || !snapshot.analysis) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No SERP snapshot found for this keyword. Click "Fetch SERP" to trigger a fresh analysis.
      </div>
    );
  }

  const { analysis } = snapshot;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">SERP Results</span>
        <span className="text-[10px] text-muted-foreground">
          Captured {new Date(analysis.capturedAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2 w-36">Domain</th>
            </tr>
          </thead>
          <tbody>
            {analysis.serpResults.map((r) => (
              <tr
                key={r.position}
                className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${
                  r.isUs ? 'bg-emerald-950/20' : r.isCompetitor ? 'bg-amber-950/10' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.position}</td>
                <td className="px-3 py-2 text-foreground">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <SeoBadge
                    className={
                      r.isUs
                        ? 'bg-emerald-900/40 text-emerald-300'
                        : r.isCompetitor
                        ? 'bg-amber-900/40 text-amber-300'
                        : 'bg-surface text-muted-foreground'
                    }
                  >
                    {r.domain}
                  </SeoBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
