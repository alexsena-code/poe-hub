'use client';

// Ramping tab — keywords with significant VICE score change over a lookback window.
// Shows direction (up/down), current vs previous VICE, YouTube views.
// Controls: period selector (3/7/14/30d) + min delta threshold.

import React from 'react';
import { sourceVariant, clusterLabel, viceColor } from '../shared/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { RampingEntry } from '../shared/types';

interface RampingTabProps {
  data: RampingEntry[];
  loading: boolean;
  days: number;
  minDelta: number;
  onDaysChange: (d: number) => void;
  onMinDeltaChange: (d: number) => void;
  onRefresh: () => void;
}

const PERIOD_OPTIONS = [3, 7, 14, 30];

export function RampingTab({ data, loading, days, minDelta, onDaysChange, onMinDeltaChange, onRefresh }: RampingTabProps) {
  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Period</span>
          {PERIOD_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                days === d
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Min Delta</span>
          <input
            type="number"
            value={minDelta}
            onChange={(e) => onMinDeltaChange(Number(e.target.value))}
            className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
            min={0}
            step={1}
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      {loading && data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading ramping data...</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No ramping keywords found for the selected criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Keyword</th>
                <th className="py-2 pr-4 text-right">VICE Score</th>
                <th className="py-2 pr-4 text-right">Delta</th>
                <th className="py-2 pr-4 text-right">YouTube Views</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2">Cluster</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="py-2 pr-4 text-foreground font-medium">{row.keyword}</td>
                  <td className={`py-2 pr-4 text-right ${viceColor(row.currentVice)}`}>
                    {(row.currentVice ?? 0).toFixed(1)}
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono ${(row.delta ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(row.delta ?? 0) > 0 ? '↑' : '↓'} {Math.abs(row.delta ?? 0).toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">
                    {row.youtubeViews != null ? row.youtubeViews.toLocaleString() : '-'}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge variant={sourceVariant(row.source)}>{row.source}</StatusBadge>
                  </td>
                  <td className="py-2">
                    <span className="text-xs text-muted-foreground">{clusterLabel(row.cluster)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
