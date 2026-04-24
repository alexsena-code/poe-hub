'use client';

// ---------------------------------------------------------------------------
// SubredditFilter — popover filter panel (subreddit, flair, period)
// ---------------------------------------------------------------------------

interface SubredditFilterProps {
  subreddits: string[];
  flairs: string[];
  filterSubreddit: string;
  filterFlair: string;
  filterPeriod: string;
  showFilters: boolean;
  onToggleFilters: () => void;
  onSubredditChange: (value: string) => void;
  onFlairChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onClearAll: () => void;
}

export function SubredditFilter({
  subreddits,
  flairs,
  filterSubreddit,
  filterFlair,
  filterPeriod,
  showFilters,
  onToggleFilters,
  onSubredditChange,
  onFlairChange,
  onPeriodChange,
  onClearAll,
}: SubredditFilterProps) {
  const hasActiveFilters = filterSubreddit !== 'all' || filterFlair !== 'all' || filterPeriod !== 'all';

  return (
    <div className="relative">
      <button
        onClick={onToggleFilters}
        className={`p-1.5 rounded-md border transition-colors ${
          hasActiveFilters
            ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
            : 'bg-surface border-border text-muted-foreground hover:text-foreground'
        }`}
        title="Filters"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {showFilters && (
        <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Subreddit</label>
              <select
                value={filterSubreddit}
                onChange={e => onSubredditChange(e.target.value)}
                className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value="all">All subs</option>
                {subreddits.map(s => (
                  <option key={s} value={s}>r/{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Flair</label>
              <select
                value={filterFlair}
                onChange={e => onFlairChange(e.target.value)}
                className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value="all">All flairs</option>
                {flairs.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Period</label>
              <select
                value={filterPeriod}
                onChange={e => onPeriodChange(e.target.value)}
                className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value="all">All time</option>
                <option value="24h">24h</option>
                <option value="3d">3d</option>
                <option value="7d">7d</option>
                <option value="14d">14d</option>
                <option value="30d">30d</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
