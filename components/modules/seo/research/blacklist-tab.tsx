'use client';

// Blacklist tab — user-defined terms to exclude from keyword discovery.
// Add via input, remove via × button. Built-in patterns (buy/sell, minecraft, etc.)
// are always active in the engine — only custom terms appear here.

import React from 'react';
import { StatCard } from '../shared/seo-primitives';

interface BlacklistTabProps {
  terms: string[];
  newTerm: string;
  loading: boolean;
  onNewTermChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (term: string) => void;
}

export function BlacklistTab({ terms, newTerm, loading, onNewTermChange, onAdd, onRemove }: BlacklistTabProps) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Custom Blacklist Terms" value={terms.length} sub="user-defined terms" />
      </div>

      {/* Add term */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          Add Blacklist Term
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => onNewTermChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
            placeholder="e.g., minecraft, fortnite, buy cheap..."
            className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
          />
          <button
            onClick={onAdd}
            disabled={loading || !newTerm.trim()}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
          >
            {loading ? 'Adding...' : 'Add to Blacklist'}
          </button>
        </div>
      </div>

      {/* Terms list */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          Blacklisted Terms
        </div>
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No custom blacklist terms. Built-in patterns (buy/sell, hack, minecraft, etc.) are always active.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {terms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-sm"
              >
                {term}
                <button
                  onClick={() => onRemove(term)}
                  className="hover:text-red-100 transition-colors text-red-400"
                  title={`Remove "${term}"`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
