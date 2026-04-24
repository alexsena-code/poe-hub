'use client';

// Striking Distance tab — keywords ranked 4-20 in Google, close to page 1.
// Client-side sort only (dataset is small — typically <200 rows from the engine).

import React from 'react';
import { SortHeader, useSort } from '../shared/seo-primitives';
import { actionBadge } from '../shared/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StrikingKeyword } from '../shared/types';

interface StrikingDistanceTabProps {
  data: StrikingKeyword[];
  loading: boolean;
}

export function StrikingDistanceTab({ data, loading }: StrikingDistanceTabProps) {
  const { sorted, sortKey, sortDir, toggle } = useSort<StrikingKeyword>(data, 'opportunityScore', 'desc');

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading striking distance keywords...</div>;
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="px-3 py-2" />
            <SortHeader label="Position" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => toggle('position')} className="px-3 py-2 w-20 text-right" tip="Average Google position. 4-20 = striking distance" />
            <SortHeader label="Impressions" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => toggle('impressions')} className="px-3 py-2 w-24 text-right" />
            <SortHeader label="Clicks" active={sortKey === 'clicks'} dir={sortKey === 'clicks' ? sortDir : null} onToggle={() => toggle('clicks')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => toggle('ctr')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="Opp. Score" active={sortKey === 'opportunityScore'} dir={sortKey === 'opportunityScore' ? sortDir : null} onToggle={() => toggle('opportunityScore')} className="px-3 py-2 w-24 text-right" tip="impressions x (20 - position). Higher = more valuable" />
            <SortHeader label="Action" active={sortKey === 'action'} dir={sortKey === 'action' ? sortDir : null} onToggle={() => toggle('action')} className="px-3 py-2 w-28" tip="Fix CTR (title/meta), Push Top 5 (add content), Create Content (new page)" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                No striking distance keywords. Import GSC data first.
              </td>
            </tr>
          ) : (
            sorted.map((kw, i) => {
              const badge = actionBadge(kw.action);
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-3 py-2 text-foreground">{kw.keyword}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">
                    {kw.position.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.impressions.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.clicks}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {(kw.ctr * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-foreground">
                    {kw.opportunityScore.toFixed(0)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
