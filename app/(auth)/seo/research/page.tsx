'use client';

// /seo/research — keyword discovery & pipeline
// Tabs: All Keywords | Scan History | Blacklist
// Actions header: suggest scan, competitor crawl, import gaps
// Stats bar: totalKeywords + strikingDistance count + ctrProblems count + competitors count
// Striking Distance / CTR Problems / Ramping / Competitor Analysis have moved to /seo/opportunities and /seo/analysis.

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useResearchState } from '@/components/modules/seo/research/use-research-state';
import { FiltersBar } from '@/components/modules/seo/research/filters-bar';
import { ScanActions } from '@/components/modules/seo/research/scan-actions';
import { KeywordsTab } from '@/components/modules/seo/research/keywords-tab';
import { ScanHistoryTab } from '@/components/modules/seo/research/scan-history-tab';
import { BlacklistTab } from '@/components/modules/seo/research/blacklist-tab';
import { Tip } from '@/components/modules/seo/shared/seo-primitives';

type ResearchTab = 'keywords' | 'scans' | 'blacklist';

const TABS: { id: ResearchTab; label: string }[] = [
  { id: 'keywords', label: 'All Keywords' },
  { id: 'scans', label: 'Scan History' },
  { id: 'blacklist', label: 'Blacklist' },
];

export default function SeoResearchPage() {
  const [tab, setTab] = useState<ResearchTab>('keywords');
  const state = useResearchState();

  // Always load dashboard + keywords on mount
  useEffect(() => { state.fetchDashboard(); }, [state.fetchDashboard]);
  useEffect(() => { state.fetchKeywords(); }, [state.fetchKeywords]);

  // Lazy-load tab-specific data
  useEffect(() => {
    if (tab === 'scans') state.fetchScans();
    if (tab === 'blacklist') state.fetchBlacklist();
  }, [tab, state.fetchScans, state.fetchBlacklist]);

  function handleSort(key: string) {
    if (key === state.sortBy) {
      state.setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      state.setSortBy(key);
      state.setSortDir('desc');
    }
    state.setPage(0);
  }

  const dash = state.dashboard;

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        <PageHeader
          title="SEO Keyword Research"
          description="Discover, classify, and curate keywords from GSC, Google Suggest, YouTube, and competitors"
          accent="var(--color-seo)"
          className="mb-4"
        />

        {/* Scan action inputs */}
        <div className="mb-4">
          <ScanActions
            suggestSeeds={state.suggestSeeds}
            suggestGame={state.suggestGame}
            actionLoading={state.actionLoading}
            actionResult={state.actionResult}
            onSeedsChange={state.setSuggestSeeds}
            onGameChange={state.setSuggestGame}
            onSuggestScan={state.runSuggestScan}
            onCompetitorCrawl={state.runCompetitorCrawl}
            onImportGaps={state.importGaps}
          />
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="All keywords discovered across GSC, Google Suggest, YouTube, and competitors">
                Total Keywords
              </Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.totalKeywords ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="Keywords ranking 4-20 in Google — view in /seo/opportunities">Striking Distance</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.strikingDistance.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="High impressions, low CTR — view in /seo/opportunities">CTR Problems</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.ctrProblems.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="Competitor domains being tracked for content gap analysis">Competitors</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.competitors.length ?? 0}</div>
          </div>
        </div>

        {/* Tab bar + filters */}
        <div className="flex items-center gap-4 border-b border-border">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-emerald-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'keywords' && (
            <div className="flex items-center gap-3 ml-auto">
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.showWithoutSignals}
                  onChange={(e) => state.setShowWithoutSignals(e.target.checked)}
                  className="accent-emerald-500"
                />
                <Tip text="When ON, the table includes keywords without GSC/Reddit/YouTube signals (freshly imported). Turn OFF to inspect only signal-bearing rows.">
                  Show without signals
                </Tip>
              </label>
              <FiltersBar filters={state.filters} onChange={state.setFilters} />
              <button
                onClick={() => { state.fetchDashboard(); state.fetchKeywords(); }}
                className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {tab === 'keywords' && (
          <KeywordsTab
            keywords={state.keywords}
            loading={state.loading}
            sortKey={state.sortBy}
            sortDir={state.sortDir}
            onSort={handleSort}
            keywordsError={state.keywordsError}
            totalKeywords={state.totalKeywords}
            dashboardTotal={dash?.totalKeywords ?? null}
            showWithoutSignals={state.showWithoutSignals}
          />
        )}
        {tab === 'scans' && <ScanHistoryTab scans={state.scans} />}
        {tab === 'blacklist' && (
          <BlacklistTab
            terms={state.blacklistTerms}
            newTerm={state.newBlacklistTerm}
            loading={state.blacklistLoading}
            onNewTermChange={state.setNewBlacklistTerm}
            onAdd={state.addBlacklistTerm}
            onRemove={state.removeBlacklistTerm}
          />
        )}
      </div>

      {/* Fixed pagination footer — keywords tab only */}
      {tab === 'keywords' && state.totalKeywords > state.PAGE_SIZE && (
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {state.page * state.PAGE_SIZE + 1}–{Math.min((state.page + 1) * state.PAGE_SIZE, state.totalKeywords)} of{' '}
            {state.totalKeywords}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => state.setPage((p) => Math.max(0, p - 1))}
              disabled={state.page === 0}
              className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-surface-hover"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs text-muted-foreground">
              Page {state.page + 1} of {Math.ceil(state.totalKeywords / state.PAGE_SIZE)}
            </span>
            <button
              onClick={() => state.setPage((p) => p + 1)}
              disabled={(state.page + 1) * state.PAGE_SIZE >= state.totalKeywords}
              className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-surface-hover"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
