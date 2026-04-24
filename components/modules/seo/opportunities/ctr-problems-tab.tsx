'use client';

// CTR Problems tab — keywords with high impressions but low click-through rate.
// Action: "Fix CTR" = optimize title/meta description for the page.

import React from 'react';
import { SortHeader, useSort } from '../shared/seo-primitives';
import type { StrikingKeyword } from '../shared/types';

interface CtrProblemsTabProps {
  data: StrikingKeyword[];
  loading: boolean;
}

export function CtrProblemsTab({ data, loading }: CtrProblemsTabProps) {
  const { sorted, sortKey, sortDir, toggle } = useSort<StrikingKeyword>(data, 'impressions', 'desc');

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading CTR problems...</div>;
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="px-3 py-2" />
            <SortHeader label="Position" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => toggle('position')} className="px-3 py-2 w-20 text-right" />
            <SortHeader label="Impressions" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => toggle('impressions')} className="px-3 py-2 w-24 text-right" />
            <SortHeader label="Clicks" active={sortKey === 'clicks'} dir={sortKey === 'clicks' ? sortDir : null} onToggle={() => toggle('clicks')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => toggle('ctr')} className="px-3 py-2 w-16 text-right" tip="Below 2% at position <10 = title/meta description problem" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No CTR problems found. Import GSC data first.
              </td>
            </tr>
          ) : (
            sorted.map((kw, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                <td className="px-3 py-2 text-foreground">{kw.keyword}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">
                  {kw.position.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-foreground font-medium">
                  {kw.impressions.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                  {kw.clicks}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-red-400">
                  {(kw.ctr * 100).toFixed(2)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
