'use client';

// ---------------------------------------------------------------------------
// Reddit Dashboard — orchestrator page
// Sub-components live in components/modules/seo/reddit/
// ---------------------------------------------------------------------------

import { PageHeader } from '@/components/ui/page-header';
import { TABS } from '@/components/modules/seo/reddit/types';
import { useRedditState } from '@/components/modules/seo/reddit/use-reddit-state';
import { ScanControls } from '@/components/modules/seo/reddit/scan-controls';
import { SubredditFilter } from '@/components/modules/seo/reddit/subreddit-filter';
import { PostsList } from '@/components/modules/seo/reddit/posts-list';
import { TrendingKeywordsTab } from '@/components/modules/seo/reddit/trending-keywords-tab';
import { BuildPostsTab } from '@/components/modules/seo/reddit/build-posts-tab';

export default function RedditDashboardPage() {
  const state = useRedditState();

  const {
    tab, setTab,
    posts, loading,
    scanning, scanResult, scanProgress,
    filterSubreddit, setFilterSubreddit,
    filterFlair, setFilterFlair,
    filterPeriod, setFilterPeriod,
    showFilters, setShowFilters,
    page, setPage,
    totalPosts,
    sortBy, sortDir, toggleSort,
    globalStats,
    expandedPost, setExpandedPost,
    fetchPosts,
    scanRedditKeywords,
    clearFilters,
    PAGE_SIZE,
  } = state;

  // ---------------------------------------------------------------------------
  // Derived data — kept in page since they feed multiple sibling sections
  // ---------------------------------------------------------------------------

  const buildPosts = posts.filter(p => (p.pob_links ?? []).length > 0);
  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + p.score, 0) / posts.length)
    : 0;

  // Unique subreddits / flairs from the current page of posts (for filter dropdowns)
  const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();
  const flairs = [...new Set(posts.map(p => p.flair).filter(Boolean))].sort();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        {/* Header */}
        <PageHeader
          title="Reddit Dashboard"
          description="Top posts, trending keywords, and build discussions"
          accent="var(--color-seo)"
          className="mb-4"
        />

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</div>
              <div className="text-lg font-bold text-foreground">{globalStats?.totalPosts ?? totalPosts}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Builds</div>
              <div className="text-lg font-bold text-foreground">{globalStats?.buildPosts ?? buildPosts.length}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Score</div>
              <div className="text-lg font-bold text-foreground">{globalStats?.avgScore ?? avgScore}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Subs</div>
              <div className="text-lg font-bold text-foreground">
                {globalStats?.subreddits?.length ?? subreddits.length}
              </div>
            </div>
          </div>
        </div>

        {/* Scan result message */}
        {scanResult && <span className="text-xs text-emerald-400 mb-2 block">{scanResult}</span>}

        {/* Scan progress bar */}
        {scanProgress && (
          <div className="mb-3 bg-surface border border-border rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground">
                {scanning ? scanProgress.step : 'Complete'}
              </span>
              <span className="text-[10px] text-muted-foreground">{scanProgress.progress}%</span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scanning ? 'bg-orange-500' : 'bg-emerald-500'}`}
                style={{ width: `${scanProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs + Filter + Actions row */}
        <div className="flex items-center border-b border-border">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-orange-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {t.key === 'build-posts' && buildPosts.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-orange-400">({buildPosts.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-2 pb-1.5">
            <span className="text-xs text-muted-foreground">{totalPosts} posts</span>
            <SubredditFilter
              subreddits={subreddits}
              flairs={flairs}
              filterSubreddit={filterSubreddit}
              filterFlair={filterFlair}
              filterPeriod={filterPeriod}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters(f => !f)}
              onSubredditChange={v => { setFilterSubreddit(v); setPage(() => 0); }}
              onFlairChange={v => { setFilterFlair(v); setPage(() => 0); }}
              onPeriodChange={v => {
                setFilterPeriod(v);
                setPage(() => 0);
              }}
              onClearAll={clearFilters}
            />
            <ScanControls
              scanning={scanning}
              loading={loading}
              onScan={scanRedditKeywords}
              onRefresh={fetchPosts}
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">Loading Reddit data...</div>
      )}

      {/* Tab: Recent + Top Posts (shared paginated table) */}
      {!loading && (tab === 'top-posts' || tab === 'recent') && (
        <PostsList
          posts={posts}
          totalPosts={totalPosts}
          page={page}
          sortBy={sortBy}
          sortDir={sortDir}
          expandedPost={expandedPost}
          onToggleSort={toggleSort}
          onToggleExpand={id => setExpandedPost(expandedPost === id ? null : id)}
          onPrevPage={() => setPage(p => Math.max(0, p - 1))}
          onNextPage={() => setPage(p => p + 1)}
        />
      )}

      {/* Tab: Trending Keywords (Reddit-sourced KeywordOpportunity rows) */}
      {!loading && tab === 'trending-keywords' && (
        <TrendingKeywordsTab />
      )}

      {/* Tab: Build Posts */}
      {!loading && tab === 'build-posts' && (
        <BuildPostsTab posts={buildPosts} />
      )}
    </div>
  );
}
