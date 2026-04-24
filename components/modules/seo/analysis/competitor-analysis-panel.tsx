'use client';

// Competitor Analysis panel — migrated from the old "analyze" tab in /seo/research.
// Shows: summary stats + gap analysis + recommendations + SERP table + per-page details.
// Fetched via GET /api/engine/seo/analyze/keyword (CompetitorAnalyzerService).

import React from 'react';
import { SeoBadge, StatCard } from '../shared/seo-primitives';
import type { CompetitorAnalysis } from '../shared/types';

interface CompetitorAnalysisPanelProps {
  result: CompetitorAnalysis;
}

export function CompetitorAnalysisPanel({ result }: CompetitorAnalysisPanelProps) {
  if (result.error) {
    return <div className="text-center text-red-400 py-8">{result.error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Our Position"
          value={result.ourPosition ?? 'Not ranking'}
          tip="Our current Google ranking for this keyword"
        />
        <StatCard
          label="SERP Results"
          value={result.serpResults?.length ?? 0}
          tip="Number of search results analyzed from Google"
        />
        <StatCard
          label="Avg Word Count"
          value={result.avgWordCount ?? 0}
          sub="competitor pages"
          tip="Average word count of competitor pages ranking for this keyword"
        />
        <StatCard
          label="Avg H2 Headings"
          value={result.avgHeadings ?? 0}
          sub="competitor pages"
          tip="Average number of H2 headings on competitor pages"
        />
      </div>

      {/* Gap & Recommendations */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Gap Analysis</div>
        <p className="text-sm text-foreground mb-3">{result.gap}</p>
        {result.recommendations?.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recommendations</div>
            <ul className="text-sm text-foreground space-y-1">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-400 shrink-0">-</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* SERP Results table */}
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
            {result.serpResults?.map((r) => (
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

      {/* Per-page detail cards */}
      {result.pageAnalyses?.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Competitor Page Details</div>
          {result.pageAnalyses.map((p, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-medium text-foreground">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.domain} — {p.wordCount.toLocaleString()} words
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {p.hasSchema && <SeoBadge className="bg-emerald-900/40 text-emerald-300">Schema</SeoBadge>}
                  <span>{p.images} imgs</span>
                  <span>{p.internalLinks} int. links</span>
                </div>
              </div>
              {p.metaDescription && (
                <p className="text-xs text-muted-foreground italic mb-2">
                  "{p.metaDescription.slice(0, 160)}"
                </p>
              )}
              {p.h2.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase">H2 Headings: </span>
                  <span className="text-xs text-foreground">{p.h2.join(' | ')}</span>
                </div>
              )}
              {Object.keys(p.keywordDensity).length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Top Phrases: </span>
                  <span className="text-xs text-foreground">
                    {Object.entries(p.keywordDensity)
                      .slice(0, 8)
                      .map(([phrase, count]) => `${phrase} (${count})`)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
