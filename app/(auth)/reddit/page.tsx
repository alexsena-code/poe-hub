'use client';

import React, { useState, useEffect } from 'react';

const API_URL = '/api/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopComment {
  body: string;
  score: number;
  author: string;
}

interface RedditPostRaw {
  [key: string]: any;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  flair: string;
  author: string;
  subreddit: string;
  permalink: string;
  url: string;
  created_utc: string;
  is_self: boolean;
  pob_links: string[];
  upvote_ratio: number;
  top_comments: TopComment[];
}

function normalizePost(raw: RedditPostRaw): RedditPost {
  return {
    id: raw.id ?? raw.postId ?? '',
    title: raw.title ?? '',
    selftext: raw.selftext ?? '',
    score: raw.score ?? 0,
    num_comments: raw.num_comments ?? raw.numComments ?? 0,
    flair: raw.flair ?? raw.link_flair_text ?? '',
    author: raw.author ?? '',
    subreddit: raw.subreddit ?? '',
    permalink: raw.permalink ?? '',
    url: raw.url ?? '',
    created_utc: raw.created_utc ?? raw.createdUtc ?? '',
    is_self: raw.is_self ?? false,
    pob_links: raw.pob_links ?? raw.pobLinks ?? [],
    upvote_ratio: raw.upvote_ratio ?? raw.upvoteRatio ?? 0,
    top_comments: raw.top_comments ?? raw.topComments ?? [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

function subredditColor(sub: string): string {
  const map: Record<string, string> = {
    pathofexile: 'bg-orange-900/40 text-orange-300',
    PathOfExileBuilds: 'bg-amber-900/40 text-amber-300',
    PathOfExile2: 'bg-red-900/40 text-red-300',
  };
  return map[sub] ?? 'bg-zinc-800 text-zinc-300';
}

function flairColor(flair: string): string {
  const map: Record<string, string> = {
    'Build': 'bg-emerald-900/40 text-emerald-300',
    'Build Showcase': 'bg-emerald-900/40 text-emerald-300',
    'Build Feedback': 'bg-emerald-900/40 text-emerald-300',
    'Build Request': 'bg-teal-900/40 text-teal-300',
    'Paint Build': 'bg-emerald-900/40 text-emerald-300',
    'Atlas Tree': 'bg-emerald-900/40 text-emerald-300',
    'GGG': 'bg-red-900/40 text-red-300',
    'Game Feedback': 'bg-amber-900/40 text-amber-300',
    'Tool': 'bg-blue-900/40 text-blue-300',
    'Information': 'bg-cyan-900/40 text-cyan-300',
    'Discussion': 'bg-purple-900/40 text-purple-300',
    'Crafting Showcase': 'bg-pink-900/40 text-pink-300',
    'Crafting': 'bg-pink-900/40 text-pink-300',
    'Lucky (Non-Crafted) Showcase': 'bg-yellow-900/40 text-yellow-300',
    'Lucky Drop Showcase': 'bg-yellow-900/40 text-yellow-300',
    'Question': 'bg-indigo-900/40 text-indigo-300',
    'Question | Answered': 'bg-indigo-900/40 text-indigo-300',
    'Help Needed': 'bg-indigo-900/40 text-indigo-300',
    'Cautionary Tale': 'bg-rose-900/40 text-rose-300',
    'Theory': 'bg-violet-900/40 text-violet-300',
  };
  return map[flair] ?? 'bg-zinc-800 text-zinc-300';
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, tip }: { label: string; value: string | number; sub?: string; tip?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        {tip ? <Tip text={tip}>{label}</Tip> : label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = React.useRef<HTMLSpanElement>(null);

  function handleEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  }

  return (
    <span
      ref={ref}
      className="cursor-help border-b border-dotted border-muted/40"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="fixed z-[9999] px-2 py-1 bg-black/80 text-white/70 text-[9px] leading-snug rounded pointer-events-none max-w-xs text-center normal-case tracking-normal"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

type SortDir = 'asc' | 'desc' | null;

function SortHeader({ label, active, dir, onToggle, className, tip }: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
  className?: string;
  tip?: string;
}) {
  const arrow = active ? (dir === 'asc' ? '\u2191' : '\u2193') : '';
  const content = (
    <span
      onClick={onToggle}
      className={`cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${active ? 'text-foreground' : ''}`}
    >
      {label}{arrow && <span className="text-[8px] ml-0.5 opacity-60">{arrow}</span>}
    </span>
  );
  return (
    <th className={className}>
      {tip ? <Tip text={tip}>{content}</Tip> : content}
    </th>
  );
}

function useSort<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: keyof T) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return { sorted, sortKey, sortDir, toggle };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'recent' | 'top-posts' | 'trending-topics' | 'build-posts';

const TABS: { key: Tab; label: string }[] = [
  { key: 'recent', label: 'Recent (24h)' },
  { key: 'top-posts', label: 'Top Posts' },
  { key: 'trending-topics', label: 'Trending Topics' },
  { key: 'build-posts', label: 'Build Posts' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RedditDashboardPage() {
  const [tab, setTab] = useState<Tab>('recent');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ step: string; progress: number; logs: string[] } | null>(null);

  // Filters
  const [filterSubreddit, setFilterSubreddit] = useState<string>('all');
  const [filterFlair, setFilterFlair] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Server-side sorting & pagination
  const [page, setPage] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [sortBy, setSortBy] = useState('createdUtc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const PAGE_SIZE = 50;

  // Global stats from DB (not page-level)
  const [globalStats, setGlobalStats] = useState<{
    totalPosts: number;
    buildPosts: number;
    avgScore: number;
    subreddits: { name: string; count: number }[];
  } | null>(null);

  // Expanded row for comments
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------

  // Map frontend field names to backend Prisma field names
  const SORT_FIELD_MAP: Record<string, string> = {
    score: 'score',
    num_comments: 'numComments',
    created_utc: 'createdUtc',
    upvote_ratio: 'upvoteRatio',
    title: 'title',
    author: 'author',
    subreddit: 'subreddit',
  };

  function getDateFrom(period: string): string | undefined {
    if (period === 'all') return undefined;
    const now = new Date();
    const map: Record<string, number> = {
      '24h': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30,
    };
    const days = map[period];
    if (!days) return undefined;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  async function fetchPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      // Recent tab: force sort by date desc, last 48h
      if (tab === 'recent') {
        params.set('sortBy', 'createdUtc');
        params.set('sortDir', 'desc');
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        params.set('dateFrom', since);
      } else {
        params.set('sortBy', SORT_FIELD_MAP[sortBy] || sortBy);
        params.set('sortDir', sortDir);
        const dateFrom = getDateFrom(filterPeriod);
        if (dateFrom) params.set('dateFrom', dateFrom);
      }
      if (filterSubreddit !== 'all') params.set('subreddit', filterSubreddit);
      if (filterFlair !== 'all') params.set('flair', filterFlair);

      const res = await fetch(`${API_URL}/seo/reddit/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPosts(data.map(normalizePost));
      }

      // Also fetch total count for pagination + global stats
      const countParams = new URLSearchParams();
      if (filterSubreddit !== 'all') countParams.set('subreddit', filterSubreddit);
      if (filterFlair !== 'all') countParams.set('flair', filterFlair);
      if (tab === 'recent') {
        countParams.set('dateFrom', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
      } else {
        const dateFrom = getDateFrom(filterPeriod);
        if (dateFrom) countParams.set('dateFrom', dateFrom);
      }
      const [countRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/seo/reddit/posts/count?${countParams}`),
        fetch(`${API_URL}/seo/reddit/stats`),
      ]);
      if (countRes.ok) setTotalPosts(await countRes.json());
      if (statsRes.ok) setGlobalStats(await statsRes.json());
    } catch { /* API offline */ }
    setLoading(false);
  }

  useEffect(() => { fetchPosts(); }, [tab, page, sortBy, sortDir, filterSubreddit, filterFlair, filterPeriod]);

  async function scanRedditKeywords() {
    setScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      await fetch(`${API_URL}/seo/scan/reddit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minScore: 50 }),
      });
      // Poll status every 2 seconds
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/seo/scan/reddit/status`);
          if (res.ok) {
            const status = await res.json();
            setScanProgress({ step: status.step, progress: status.progress, logs: status.logs });
            if (!status.running && status.progress >= 100) {
              clearInterval(poll);
              setScanning(false);
              const r = status.result;
              if (r) {
                setScanResult(`Done: ${r.newKeywords} keywords imported, ${r.rejected} rejected, ${r.postsAnalyzed} posts analyzed`);
              }
            }
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch {
      setScanResult('Failed to connect to API');
      setScanning(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();
  const flairs = [...new Set(posts.map(p => p.flair).filter(Boolean))].sort();

  const buildPosts = posts.filter(p => (p.pob_links ?? []).length > 0);
  const avgScore = posts.length > 0 ? Math.round(posts.reduce((s, p) => s + p.score, 0) / posts.length) : 0;
  const totalComments = posts.reduce((s, p) => s + p.num_comments, 0);

  // Trending topics: group by flair and extract common words from titles
  const topicsByFlair = React.useMemo(() => {
    const groups: Record<string, { flair: string; count: number; totalScore: number; avgScore: number; topPosts: RedditPost[] }> = {};
    for (const p of posts) {
      const flair = p.flair || 'Unflaired';
      if (!groups[flair]) groups[flair] = { flair, count: 0, totalScore: 0, avgScore: 0, topPosts: [] };
      groups[flair].count++;
      groups[flair].totalScore += p.score;
      groups[flair].topPosts.push(p);
    }
    for (const g of Object.values(groups)) {
      g.avgScore = Math.round(g.totalScore / g.count);
      g.topPosts.sort((a, b) => b.score - a.score);
      g.topPosts = g.topPosts.slice(0, 5);
    }
    return Object.values(groups).sort((a, b) => b.totalScore - a.totalScore);
  }, [posts]);

  // Extract trending words from titles (2-3 word phrases)
  const trendingPhrases = React.useMemo(() => {
    const stopwords = new Set(['the', 'a', 'an', 'is', 'it', 'to', 'in', 'of', 'for', 'and', 'or', 'on', 'with', 'my', 'i', 'me',
      'this', 'that', 'be', 'are', 'was', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'at', 'by', 'from', 'not', 'you',
      'your', 'we', 'they', 'all', 'can', 'will', 'just', 'so', 'if', 'as', 'no', 'up', 'out', 'about', 'what', 'how', 'when',
      'there', 'would', 'been', 'than', 'its', 'one', 'more', 'too', 'very', 'should', 'now', 'after', 'before', 'into',
      'get', 'got', 'like', 'new', 'way', 'even', 'also', 'any', 'make', 'don', 'why', 'who', 'which', 'being', 'am']);
    const counts: Record<string, { count: number; totalScore: number }> = {};
    for (const p of posts) {
      const words = p.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
      // Single important words
      for (const w of words) {
        counts[w] = counts[w] || { count: 0, totalScore: 0 };
        counts[w].count++;
        counts[w].totalScore += p.score;
      }
      // Bigrams
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        counts[bigram] = counts[bigram] || { count: 0, totalScore: 0 };
        counts[bigram].count++;
        counts[bigram].totalScore += p.score;
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v.count >= 3)
      .map(([phrase, v]) => ({ phrase, ...v }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50);
  }, [posts]);

  // ---------------------------------------------------------------------------
  // Sort hooks
  // ---------------------------------------------------------------------------

  // Server-side sort toggle for top-posts tab
  function toggleSort(key: string) {
    if (sortBy === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  // Client-side sort for build-posts tab (smaller dataset)
  const { sorted: sortedBuilds, sortKey: buildSortKey, sortDir: buildSortDir, toggle: buildToggle } = useSort(buildPosts, 'score');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
      {/* Header + Actions */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reddit Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Top posts, trending topics, and build discussions</p>
        </div>
        <div />
      </div>

      {/* Stats bar + Actions */}
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
            <div className="text-lg font-bold text-foreground">{globalStats?.subreddits?.length ?? subreddits.length}</div>
          </div>
        </div>
        <div />
      </div>
      {scanResult && <span className="text-xs text-emerald-400 mb-2 block">{scanResult}</span>}

      {/* Scan Progress */}
      {scanProgress && (
        <div className="mb-3 bg-surface border border-border rounded-lg p-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">{scanning ? scanProgress.step : 'Complete'}</span>
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

      {/* Tabs + Filter icon + Refresh */}
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
        <div className="ml-auto flex items-center gap-2 pb-1.5 relative">
          <span className="text-xs text-muted-foreground">{totalPosts} posts</span>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`p-1.5 rounded-md border transition-colors ${
              filterSubreddit !== 'all' || filterFlair !== 'all' || filterPeriod !== 'all'
                ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
                : 'bg-surface border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
          <button
            onClick={scanRedditKeywords}
            disabled={scanning}
            className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
          >
            {scanning ? 'Scanning...' : 'Scan Keywords'}
          </button>
          <button
            onClick={fetchPosts}
            disabled={loading}
            className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {/* Filter dropdown popover */}
          {showFilters && (
            <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Filters</span>
                {(filterSubreddit !== 'all' || filterFlair !== 'all' || filterPeriod !== 'all') && (
                  <button
                    onClick={() => {
                      setFilterSubreddit('all');
                      setFilterFlair('all');
                      setFilterPeriod('all');
                      setPage(0);
                    }}
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
                    onChange={e => { setFilterSubreddit(e.target.value); setPage(0); }}
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
                    onChange={e => { setFilterFlair(e.target.value); setPage(0); }}
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
                    onChange={e => {
                      setFilterPeriod(e.target.value);
                      setPage(0);
                      if (e.target.value !== 'all') { setSortBy('score'); setSortDir('desc'); }
                    }}
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
      </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">Loading Reddit data...</div>
      )}

      {/* Tab: Recent + Top Posts (shared table) */}
      {!loading && (tab === 'top-posts' || tab === 'recent') && (<>
        <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <SortHeader label="Title" active={sortBy === 'title'} dir={sortBy === 'title' ? sortDir : null} onToggle={() => toggleSort('title')} className="py-2 pr-3" />
                <SortHeader label="Subreddit" active={sortBy === 'subreddit'} dir={sortBy === 'subreddit' ? sortDir : null} onToggle={() => toggleSort('subreddit')} className="py-2 pr-3" />
                <SortHeader label="Score" active={sortBy === 'score'} dir={sortBy === 'score' ? sortDir : null} onToggle={() => toggleSort('score')} className="py-2 pr-3 text-right" tip="Reddit upvote score" />
                <SortHeader label="Comments" active={sortBy === 'num_comments'} dir={sortBy === 'num_comments' ? sortDir : null} onToggle={() => toggleSort('num_comments')} className="py-2 pr-3 text-right" />
                <th className="py-2 pr-3">Flair</th>
                <SortHeader label="Author" active={sortBy === 'author'} dir={sortBy === 'author' ? sortDir : null} onToggle={() => toggleSort('author')} className="py-2 pr-3" />
                <SortHeader label="Time" active={sortBy === 'created_utc' || sortBy === 'createdUtc'} dir={sortBy === 'created_utc' || sortBy === 'createdUtc' ? sortDir : null} onToggle={() => toggleSort('created_utc')} className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <React.Fragment key={post.id}>
                  <tr
                    className="border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                  >
                    <td className="py-2 pr-3 max-w-md">
                      <a
                        href={`https://www.reddit.com${post.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-300 hover:text-orange-200 hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {post.title.length > 90 ? post.title.slice(0, 90) + '...' : post.title}
                      </a>
                      {(post.pob_links ?? []).length > 0 && (
                        <Badge className="ml-2 bg-emerald-900/40 text-emerald-300">PoB</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={subredditColor(post.subreddit)}>r/{post.subreddit}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-foreground">{formatNumber(post.score)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{post.num_comments}</td>
                    <td className="py-2 pr-3">
                      {post.flair && <Badge className={flairColor(post.flair)}>{post.flair}</Badge>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{post.author}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs whitespace-nowrap">{timeAgo(post.created_utc)}</td>
                  </tr>
                  {expandedPost === post.id && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={7} className="py-3 px-4">
                        <div className="grid gap-3">
                          {/* Post meta */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Upvote ratio: {(post.upvote_ratio * 100).toFixed(0)}%</span>
                            <span>{post.is_self ? 'Self post' : 'Link post'}</span>
                            {(post.pob_links ?? []).length > 0 && <span>PoB links: {(post.pob_links ?? []).length}</span>}
                            <a
                              href={`https://www.reddit.com${post.permalink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-400 hover:underline"
                            >
                              Open on Reddit
                            </a>
                          </div>
                          {/* Selftext preview */}
                          {post.selftext && (
                            <div className="text-xs text-muted-foreground/80 bg-black/20 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {post.selftext.slice(0, 500)}{post.selftext.length > 500 ? '...' : ''}
                            </div>
                          )}
                          {/* Top comments */}
                          {post.top_comments.length > 0 && (
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top Comments</div>
                              <div className="space-y-1">
                                {post.top_comments.slice(0, 5).map((c, i) => (
                                  <div key={i} className="flex gap-2 text-xs">
                                    <span className="text-orange-400/70 font-mono shrink-0 w-8 text-right">{formatNumber(c.score)}</span>
                                    <span className="text-muted-foreground/60 shrink-0">{c.author}:</span>
                                    <span className="text-muted-foreground/80">{c.body.slice(0, 200)}{c.body.length > 200 ? '...' : ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination controls — fixed footer */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border bg-background">
          <span className="text-xs text-muted-foreground">
            Showing {totalPosts > 0 ? page * PAGE_SIZE + 1 : 0}-{Math.min((page + 1) * PAGE_SIZE, totalPosts)} of {totalPosts}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-white/[0.04]"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs text-muted-foreground">
              Page {page + 1} of {Math.max(1, Math.ceil(totalPosts / PAGE_SIZE))}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalPosts}
              className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-white/[0.04]"
            >
              Next
            </button>
          </div>
        </div>
      </>)}

      {/* Tab: Trending Topics */}
      {!loading && tab === 'trending-topics' && (
        <div className="grid gap-6">
          {/* Trending phrases */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Trending Phrases (from titles)</h2>
            <div className="flex flex-wrap gap-2">
              {trendingPhrases.slice(0, 40).map(({ phrase, count, totalScore }) => (
                <div
                  key={phrase}
                  className="px-3 py-1.5 rounded-md bg-orange-900/20 border border-orange-800/30 text-orange-200 text-xs"
                  title={`${count} posts, total score: ${formatNumber(totalScore)}`}
                >
                  <span className="font-medium">{phrase}</span>
                  <span className="ml-1.5 text-orange-400/60">{count}x</span>
                  <span className="ml-1 text-orange-400/40">{formatNumber(totalScore)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By flair */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Posts by Flair</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="py-2 pr-3">Flair</th>
                    <th className="py-2 pr-3 text-right">Posts</th>
                    <th className="py-2 pr-3 text-right">Total Score</th>
                    <th className="py-2 pr-3 text-right">Avg Score</th>
                    <th className="py-2 pr-3">Top Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {topicsByFlair.map(group => (
                    <tr key={group.flair} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="py-2 pr-3">
                        <Badge className={flairColor(group.flair)}>{group.flair}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-foreground">{group.count}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{formatNumber(group.totalScore)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{group.avgScore}</td>
                      <td className="py-2 pr-3">
                        <div className="space-y-0.5">
                          {group.topPosts.slice(0, 3).map(p => (
                            <div key={p.id} className="text-xs text-muted-foreground/80 truncate max-w-lg">
                              <span className="text-orange-400/60 font-mono mr-1">{formatNumber(p.score)}</span>
                              <a
                                href={`https://www.reddit.com${p.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-orange-300 hover:underline"
                              >
                                {p.title.slice(0, 60)}{p.title.length > 60 ? '...' : ''}
                              </a>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Build Posts */}
      {!loading && tab === 'build-posts' && (
        <div>
          {buildPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No build posts with PoB links found in the current dataset.
              <br />
              <span className="text-xs">Build posts are identified by the presence of Path of Building pastebin links.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                    <SortHeader label="Title" active={buildSortKey === 'title'} dir={buildSortKey === 'title' ? buildSortDir : null} onToggle={() => buildToggle('title')} className="py-2 pr-3" />
                    <SortHeader label="Score" active={buildSortKey === 'score'} dir={buildSortKey === 'score' ? buildSortDir : null} onToggle={() => buildToggle('score')} className="py-2 pr-3 text-right" />
                    <SortHeader label="Comments" active={buildSortKey === 'num_comments'} dir={buildSortKey === 'num_comments' ? buildSortDir : null} onToggle={() => buildToggle('num_comments')} className="py-2 pr-3 text-right" />
                    <th className="py-2 pr-3">Flair</th>
                    <th className="py-2 pr-3">PoB Links</th>
                    <SortHeader label="Author" active={buildSortKey === 'author'} dir={buildSortKey === 'author' ? buildSortDir : null} onToggle={() => buildToggle('author')} className="py-2 pr-3" />
                    <SortHeader label="Time" active={buildSortKey === 'created_utc'} dir={buildSortKey === 'created_utc' ? buildSortDir : null} onToggle={() => buildToggle('created_utc')} className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedBuilds.map(post => (
                    <tr key={post.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 max-w-md">
                        <a
                          href={`https://www.reddit.com${post.permalink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-300 hover:text-orange-200 hover:underline"
                        >
                          {post.title.length > 80 ? post.title.slice(0, 80) + '...' : post.title}
                        </a>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-foreground">{formatNumber(post.score)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{post.num_comments}</td>
                      <td className="py-2 pr-3">
                        {post.flair && <Badge className={flairColor(post.flair)}>{post.flair}</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="space-y-0.5">
                          {(post.pob_links ?? []).slice(0, 2).map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[10px] text-emerald-400 hover:underline truncate max-w-[200px]"
                            >
                              {link}
                            </a>
                          ))}
                          {(post.pob_links ?? []).length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{(post.pob_links ?? []).length - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">{post.author}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs whitespace-nowrap">{timeAgo(post.created_utc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
