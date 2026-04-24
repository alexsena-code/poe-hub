'use client';

// Header action buttons for /seo/research:
// "Run Suggest Scan" (with seeds + game selector), "Crawl Competitors", "Import Gaps".
// Kept separate so the orchestrator page stays thin.

import React from 'react';

interface ScanActionsProps {
  suggestSeeds: string;
  suggestGame: string;
  actionLoading: string | null;
  actionResult: string | null;
  onSeedsChange: (v: string) => void;
  onGameChange: (v: string) => void;
  onSuggestScan: () => void;
  onCompetitorCrawl: () => void;
  onImportGaps: () => void;
}

const GAME_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'poe1', label: 'PoE 1' },
  { value: 'poe2', label: 'PoE 2' },
  { value: 'both', label: 'Both' },
];

export function ScanActions({
  suggestSeeds,
  suggestGame,
  actionLoading,
  actionResult,
  onSeedsChange,
  onGameChange,
  onSuggestScan,
  onCompetitorCrawl,
  onImportGaps,
}: ScanActionsProps) {
  return (
    <div className="space-y-3">
      {/* Suggest Scan row */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={suggestSeeds}
          onChange={(e) => onSeedsChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSuggestScan(); }}
          placeholder="seed1, seed2, seed3..."
          className="flex-1 min-w-[200px] bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
        />
        <select
          value={suggestGame}
          onChange={(e) => onGameChange(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground"
        >
          {GAME_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <button
          onClick={onSuggestScan}
          disabled={actionLoading === 'suggest' || !suggestSeeds.trim()}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
        >
          {actionLoading === 'suggest' ? 'Starting...' : 'Run Suggest Scan'}
        </button>
        <button
          onClick={onCompetitorCrawl}
          disabled={actionLoading === 'competitors'}
          className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
        >
          {actionLoading === 'competitors' ? 'Crawling...' : 'Crawl Competitors'}
        </button>
        <button
          onClick={onImportGaps}
          disabled={actionLoading === 'gaps'}
          className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
        >
          {actionLoading === 'gaps' ? 'Importing...' : 'Import Gaps'}
        </button>
      </div>

      {actionResult && (
        <p className="text-xs text-emerald-400">{actionResult}</p>
      )}
    </div>
  );
}
