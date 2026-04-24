'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/ui/page-header";

const API_URL = '/api/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeywordOpportunity {
  id: number;
  keyword: string;
  source: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  searchVolume: number | null;
  wordCount: number;
  intent: string | null;
  cluster: string | null;
  viceScore: number | null;
  isLongTail: boolean;
  status: string;
  parentKeyword: string | null;
  competitorDomain: string | null;
  youtubeViews: number | null;
  youtubeCount: number | null;
  trendingScore: number | null;
  ninjaMatchName: string | null;
  ninjaPopularity: number | null;
  ninjaBuilds: number | null;
  discoveredAt: string;
}

interface StrikingKeyword {
  keyword: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  opportunityScore: number;
  action: string;
}

interface DashboardData {
  totalKeywords: number;
  strikingDistance: { count: number; top5: StrikingKeyword[] };
  ctrProblems: { count: number; top5: StrikingKeyword[] };
  topLongTail: KeywordOpportunity[];
  competitors: Array<{ domain: string; totalPages: number; categories: Record<string, number>; lastCrawled: string | null }>;
}

interface ScanResult {
  id: number;
  scanType: string;
  keywordsFound: number;
  newKeywords: number;
  rejected: number;
  durationMs: number | null;
  runAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLUSTERS = ['all', 'build_guide', 'crafting', 'currency_guide', 'tier_list', 'atlas_guide', 'league_start', 'mechanic_guide', 'general'] as const;
const SOURCES = ['all', 'gsc', 'suggest', 'youtube', 'competitor'] as const;
const GAMES = ['all', 'poe1', 'poe2', 'both'] as const;
const INTENTS = ['all', 'informational', 'commercial', 'transactional', 'navigational'] as const;

function clusterLabel(c: string | null | undefined): string {
  if (!c) return '-';
  return c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function intentColor(intent: string | null): string {
  switch (intent) {
    case 'informational': return 'text-sky-400';
    case 'commercial': return 'text-amber-400';
    case 'transactional': return 'text-red-400';
    case 'navigational': return 'text-purple-400';
    default: return 'text-muted-foreground';
  }
}

function sourceColor(source: string): string {
  switch (source) {
    case 'gsc': return 'bg-blue-900/40 text-blue-300';
    case 'suggest': return 'bg-emerald-900/40 text-emerald-300';
    case 'youtube': return 'bg-red-900/40 text-red-300';
    case 'competitor': return 'bg-amber-900/40 text-amber-300';
    default: return 'bg-surface text-muted-foreground';
  }
}

function actionBadge(action: string): { label: string; color: string } {
  switch (action) {
    case 'optimize_ctr': return { label: 'Fix CTR', color: 'bg-amber-900/40 text-amber-300' };
    case 'push_to_top5': return { label: 'Push Top 5', color: 'bg-emerald-900/40 text-emerald-300' };
    case 'create_content': return { label: 'Create Content', color: 'bg-sky-900/40 text-sky-300' };
    default: return { label: action, color: 'bg-surface text-muted-foreground' };
  }
}

function viceColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-400 font-bold';
  if (score >= 60) return 'text-emerald-300';
  if (score >= 40) return 'text-amber-300';
  return 'text-red-300';
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
  const [show, setShow] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
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
  const [sortKey, setSortKey] = React.useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = React.useState<SortDir>(defaultDir);

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
// Main Page
// ---------------------------------------------------------------------------

export default function SeoKeywordsPage() {
  // Dashboard summary
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Keywords table
  const [keywords, setKeywords] = useState<KeywordOpportunity[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [source, setSource] = useState<string>('all');
  const [cluster, setCluster] = useState<string>('all');
  const [intent, setIntent] = useState<string>('all');
  const [game, setGame] = useState<string>('all');
  const [longTailOnly, setLongTailOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(50);

  // Active tab
  const [tab, setTab] = useState<'keywords' | 'striking' | 'ctr' | 'scans' | 'analyze' | 'blacklist' | 'ramping'>('keywords');

  // Striking distance & CTR
  const [striking, setStriking] = useState<StrikingKeyword[]>([]);
  const [ctrProblems, setCtrProblems] = useState<StrikingKeyword[]>([]);

  // Scans
  const [scans, setScans] = useState<ScanResult[]>([]);

  // Competitor analysis
  const [analyzeKeyword, setAnalyzeKeyword] = useState('');
  const [analyzeLocale, setAnalyzeLocale] = useState('en/us');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Blacklist
  const [blacklistTerms, setBlacklistTerms] = useState<string[]>([]);
  const [newBlacklistTerm, setNewBlacklistTerm] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  // Ramping
  const [rampingData, setRampingData] = useState<Array<{
    keyword: string; currentVice: number; previousVice: number; delta: number;
    direction: string; youtubeViews: number; source: string; cluster: string;
  }>>([]);
  const [rampingDays, setRampingDays] = useState(7);
  const [rampingMinDelta, setRampingMinDelta] = useState(3);
  const [rampingLoading, setRampingLoading] = useState(false);

  // Server-side sort & pagination
  const [sortBy, setSortBy] = useState<string>('viceScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [totalKeywords, setTotalKeywords] = useState(0);
  const PAGE_SIZE = 50;

  // Actions
  const [suggestSeeds, setSuggestSeeds] = useState('');
  const [suggestGame, setSuggestGame] = useState<string>('auto');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/dashboard`);
      if (res.ok) setDashboard(await res.json());
    } catch { /* API offline */ }
  }, []);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (source !== 'all') params.set('source', source);
      if (cluster !== 'all') params.set('cluster', cluster);
      if (game !== 'all') params.set('game', game);
      if (longTailOnly) params.set('longTailOnly', 'true');
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      const res = await fetch(`${API_URL}/seo/keywords?${params}`);
      if (res.ok) setKeywords(await res.json());

      // Fetch count for pagination
      const countParams = new URLSearchParams();
      if (source !== 'all') countParams.set('source', source);
      if (cluster !== 'all') countParams.set('cluster', cluster);
      if (game !== 'all') countParams.set('game', game);
      if (longTailOnly) countParams.set('longTailOnly', 'true');
      const countRes = await fetch(`${API_URL}/seo/keywords/count?${countParams}`);
      if (countRes.ok) setTotalKeywords(await countRes.json());
    } catch { /* API offline */ }
    setLoading(false);
  }, [source, cluster, game, longTailOnly, page, sortBy, sortDir]);

  const fetchStriking = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/striking-distance`);
      if (res.ok) setStriking(await res.json());
    } catch { /* */ }
  }, []);

  const fetchCtrProblems = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/ctr-problems`);
      if (res.ok) setCtrProblems(await res.json());
    } catch { /* */ }
  }, []);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/scans?limit=20`);
      if (res.ok) setScans(await res.json());
    } catch { /* */ }
  }, []);

  const fetchBlacklist = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/blacklist`);
      if (res.ok) {
        const data = await res.json();
        setBlacklistTerms(data.terms ?? []);
      }
    } catch { /* API offline */ }
  }, []);

  async function addBlacklistTerm() {
    const term = newBlacklistTerm.trim().toLowerCase();
    if (!term) return;
    setBlacklistLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      if (res.ok) {
        setNewBlacklistTerm('');
        fetchBlacklist();
      }
    } catch { /* */ }
    setBlacklistLoading(false);
  }

  const fetchRamping = useCallback(async () => {
    setRampingLoading(true);
    try {
      const params = new URLSearchParams({ days: String(rampingDays), minDelta: String(rampingMinDelta) });
      const res = await fetch(`${API_URL}/seo/keywords/ramping?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRampingData(Array.isArray(data) ? data : data.ramping ?? []);
      }
    } catch { /* API offline */ }
    setRampingLoading(false);
  }, [rampingDays, rampingMinDelta]);

  async function removeBlacklistTerm(term: string) {
    try {
      await fetch(`${API_URL}/seo/blacklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      fetchBlacklist();
    } catch { /* */ }
  }

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);
  useEffect(() => {
    if (tab === 'striking') fetchStriking();
    if (tab === 'ctr') fetchCtrProblems();
    if (tab === 'scans') fetchScans();
    if (tab === 'blacklist') fetchBlacklist();
    if (tab === 'ramping') fetchRamping();
  }, [tab, fetchStriking, fetchCtrProblems, fetchScans, fetchBlacklist, fetchRamping]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function runSuggestScan() {
    const seeds = suggestSeeds.split(',').map(s => s.trim()).filter(Boolean);
    if (!seeds.length) return;
    setActionLoading('suggest');
    setActionResult(null);
    try {
      const payload: any = { seeds };
      if (suggestGame !== 'auto') payload.game = suggestGame;
      const res = await fetch(`${API_URL}/seo/scan/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setActionResult(`Suggest scan started for ${seeds.length} seed(s) (${suggestGame === 'auto' ? 'auto-detect' : suggestGame}). Keywords will appear in ~40s.`);
    } catch {
      setActionResult('Failed to start suggest scan');
    }
    setActionLoading(null);
  }

  async function runCompetitorCrawl() {
    setActionLoading('competitors');
    setActionResult(null);
    try {
      await fetch(`${API_URL}/seo/competitors/crawl`, { method: 'POST' });
      setActionResult('Competitor crawl started. Check stats in ~30s.');
    } catch {
      setActionResult('Failed to start competitor crawl');
    }
    setActionLoading(null);
  }

  async function importGaps() {
    setActionLoading('gaps');
    setActionResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/competitors/import-gaps`, { method: 'POST' });
      const data = await res.json();
      setActionResult(`Imported ${data.imported} gaps, skipped ${data.skipped}`);
      fetchKeywords();
    } catch {
      setActionResult('Failed to import gaps');
    }
    setActionLoading(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
      {/* Header */}
      <PageHeader
        title="SEO Keyword Research"
        description="Discover, classify, and prioritize keywords from GSC, Google Suggest, YouTube, and competitors"
        accent="var(--color-seo)"
        className="mb-4"
      />

      {/* Stats bar + Actions */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="All keywords discovered across GSC, Google Suggest, YouTube, and competitors">Total Keywords</Tip></div>
            <div className="text-lg font-bold text-foreground">{dashboard?.totalKeywords ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Keywords ranking position 4-20 in Google — close to page 1, worth optimizing">Striking Distance</Tip></div>
            <div className="text-lg font-bold text-foreground">{dashboard?.strikingDistance.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Keywords with high impressions but low click-through rate — improve title/meta description">CTR Problems</Tip></div>
            <div className="text-lg font-bold text-foreground">{dashboard?.ctrProblems.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Competitor domains being tracked for content gap analysis">Competitors</Tip></div>
            <div className="text-lg font-bold text-foreground">{dashboard?.competitors.length ?? 0}</div>
          </div>
        </div>
      </div>
      {actionResult && <div className="mb-2 text-xs text-emerald-400">{actionResult}</div>}

      {/* Tabs + Filters */}
      <div className="flex items-center gap-4 border-b border-border">
        <div className="flex gap-1">
          {(['keywords', 'striking', 'ctr', 'analyze', 'scans', 'blacklist', 'ramping'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-emerald-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'keywords' ? 'All Keywords' : t === 'striking' ? 'Striking Distance' : t === 'ctr' ? 'CTR Problems' : t === 'analyze' ? 'Competitor Analysis' : t === 'scans' ? 'Scan History' : t === 'blacklist' ? 'Blacklist' : 'Ramping'}
            </button>
          ))}
        </div>
        {tab === 'keywords' && (
          <div className="flex items-center gap-2 ml-auto">

            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`p-1.5 rounded transition-colors ${showFilters || source !== 'all' || cluster !== 'all' || game !== 'all' || longTailOnly ? 'bg-foreground/15 text-foreground' : 'bg-foreground/5 text-muted-foreground hover:text-foreground'}`}
                title="Filters"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              </button>
              {showFilters && (
                <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground">Filters</span>
                    {(source !== 'all' || cluster !== 'all' || game !== 'all' || longTailOnly) && (
                      <button
                        onClick={() => { setSource('all'); setCluster('all'); setGame('all'); setLongTailOnly(false); setPage(0); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Source</label>
                      <select
                        value={source}
                        onChange={e => { setSource(e.target.value); setPage(0); }}
                        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
                      >
                        {SOURCES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sources' : s.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Cluster</label>
                      <select
                        value={cluster}
                        onChange={e => { setCluster(e.target.value); setPage(0); }}
                        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
                      >
                        {CLUSTERS.map(c => <option key={c} value={c}>{c === 'all' ? 'All Clusters' : clusterLabel(c)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Game</label>
                      <select
                        value={game}
                        onChange={e => { setGame(e.target.value); setPage(0); }}
                        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full"
                      >
                        {GAMES.map(g => <option key={g} value={g}>{g === 'all' ? 'All Games' : g === 'poe1' ? 'PoE 1' : g === 'poe2' ? 'PoE 2' : 'Both'}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground pt-1 border-t border-border">
                      <input type="checkbox" checked={longTailOnly} onChange={e => { setLongTailOnly(e.target.checked); setPage(0); }} className="rounded border-border" />
                      Long-tail only
                    </label>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => { fetchDashboard(); fetchKeywords(); }}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
      {/* Tab: Keywords */}
      {tab === 'keywords' && (
        <>
          {/* Keywords Table */}
          <KeywordsTable keywords={keywords} loading={loading} sortKey={sortBy} sortDir={sortDir} onSort={(key: string) => {
            if (key === sortBy) {
              setSortDir(d => d === 'desc' ? 'asc' : 'desc');
            } else {
              setSortBy(key);
              setSortDir('desc');
            }
            setPage(0);
          }} />
        </>
      )}

      {/* Tab: Striking Distance */}
      {tab === 'striking' && (
        <StrikingTable data={striking} />
      )}

      {/* Tab: CTR Problems */}
      {tab === 'ctr' && (
        <CtrTable data={ctrProblems} />
      )}

      {/* Tab: Competitor Analysis */}
      {tab === 'analyze' && (
        <div>
          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={runCompetitorCrawl}
              disabled={actionLoading === 'competitors'}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
            >
              {actionLoading === 'competitors' ? 'Crawling...' : 'Crawl Competitors'}
            </button>
            <button
              onClick={importGaps}
              disabled={actionLoading === 'gaps'}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
            >
              {actionLoading === 'gaps' ? 'Importing...' : 'Import Gaps'}
            </button>
          </div>
          {/* Search input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={analyzeKeyword}
              onChange={e => setAnalyzeKeyword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && analyzeKeyword.trim()) {
                  setAnalysisLoading(true);
                  setAnalysisResult(null);
                  const [hl, gl] = analyzeLocale.split('/');
                  fetch(`${API_URL}/seo/analyze/keyword?keyword=${encodeURIComponent(analyzeKeyword.trim())}&hl=${hl}&gl=${gl}`)
                    .then(r => r.json())
                    .then(data => { setAnalysisResult(data); setAnalysisLoading(false); })
                    .catch(() => setAnalysisLoading(false));
                }
              }}
              placeholder="Enter keyword to analyze competitors (e.g., poe righteous fire build guide)"
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
            <select
              value={analyzeLocale}
              onChange={e => setAnalyzeLocale(e.target.value)}
              className="bg-background border border-border rounded px-2 py-2 text-sm text-foreground"
            >
              <option value="en/us">EN (US)</option>
              <option value="en/gb">EN (UK)</option>
              <option value="pt/br">PT (BR)</option>
              <option value="pt/pt">PT (PT)</option>
              <option value="es/es">ES (Spain)</option>
              <option value="de/de">DE (Germany)</option>
              <option value="fr/fr">FR (France)</option>
              <option value="ru/ru">RU (Russia)</option>
            </select>
            <button
              onClick={() => {
                if (!analyzeKeyword.trim()) return;
                setAnalysisLoading(true);
                setAnalysisResult(null);
                const [hl, gl] = analyzeLocale.split('/');
                fetch(`${API_URL}/seo/analyze/keyword?keyword=${encodeURIComponent(analyzeKeyword.trim())}&hl=${hl}&gl=${gl}`)
                  .then(r => r.json())
                  .then(data => { setAnalysisResult(data); setAnalysisLoading(false); })
                  .catch(() => setAnalysisLoading(false));
              }}
              disabled={analysisLoading || !analyzeKeyword.trim()}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
            >
              {analysisLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {analysisLoading && (
            <div className="text-center text-muted-foreground py-8">
              Searching Google and analyzing competitor pages... This takes ~15 seconds.
            </div>
          )}

          {analysisResult && !analysisResult.error && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Our Position" value={analysisResult.ourPosition ?? 'Not ranking'} tip="Our current Google ranking for this keyword" />
                <StatCard label="SERP Results" value={analysisResult.serpResults?.length ?? 0} tip="Number of search results analyzed from Google" />
                <StatCard label="Avg Word Count" value={analysisResult.avgWordCount ?? 0} sub="competitor pages" tip="Average word count of competitor pages ranking for this keyword" />
                <StatCard label="Avg H2 Headings" value={analysisResult.avgHeadings ?? 0} sub="competitor pages" tip="Average number of H2 headings on competitor pages" />
              </div>

              {/* Gap & Recommendations */}
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Gap Analysis</div>
                <p className="text-sm text-foreground mb-3">{analysisResult.gap}</p>
                {analysisResult.recommendations?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recommendations</div>
                    <ul className="text-sm text-foreground space-y-1">
                      {analysisResult.recommendations.map((r: string, i: number) => (
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
                    {analysisResult.serpResults?.map((r: any) => (
                      <tr key={r.position} className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${r.isUs ? 'bg-emerald-950/20' : r.isCompetitor ? 'bg-amber-950/10' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.position}</td>
                        <td className="px-3 py-2 text-foreground">
                          <a href={r.url} target="_blank" rel="noopener" className="hover:underline">{r.title}</a>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={r.isUs ? 'bg-emerald-900/40 text-emerald-300' : r.isCompetitor ? 'bg-amber-900/40 text-amber-300' : 'bg-surface text-muted-foreground'}>
                            {r.domain}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Page Analyses */}
              {analysisResult.pageAnalyses?.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Competitor Page Details</div>
                  {analysisResult.pageAnalyses.map((p: any, i: number) => (
                    <div key={i} className="bg-surface border border-border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.domain} — {p.wordCount.toLocaleString()} words</div>
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {p.hasSchema && <Badge className="bg-emerald-900/40 text-emerald-300">Schema</Badge>}
                          <span>{p.images} imgs</span>
                          <span>{p.internalLinks} int. links</span>
                        </div>
                      </div>
                      {p.metaDescription && (
                        <p className="text-xs text-muted-foreground italic mb-2">"{p.metaDescription.slice(0, 160)}"</p>
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
                            {Object.entries(p.keywordDensity).slice(0, 8).map(([phrase, count]) => `${phrase} (${count})`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {analysisResult?.error && (
            <div className="text-center text-red-400 py-8">{analysisResult.error}</div>
          )}

          {!analysisResult && !analysisLoading && (
            <div className="text-center text-muted-foreground py-8">
              Enter a keyword above to analyze who ranks for it and what their pages look like.
            </div>
          )}
        </div>
      )}

      {/* Tab: Scan History */}
      {tab === 'scans' && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 w-20 text-right">Found</th>
                <th className="px-3 py-2 w-20 text-right">New</th>
                <th className="px-3 py-2 w-20 text-right">Rejected</th>
                <th className="px-3 py-2 w-20 text-right">Duration</th>
                <th className="px-3 py-2 w-40">Date</th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No scans yet.</td></tr>
              ) : (
                scans.map(scan => (
                  <tr key={scan.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-3 py-2">
                      <Badge className={sourceColor(scan.scanType.split('_')[0])}>{scan.scanType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-foreground">{scan.keywordsFound}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400">{scan.newKeywords}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{scan.rejected}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(scan.runAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Blacklist */}
      {tab === 'blacklist' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Custom Blacklist Terms" value={blacklistTerms.length} sub="user-defined terms" />
          </div>

          {/* Add term input */}
          <div className="bg-surface border border-border rounded-lg p-4 mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add Blacklist Term</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlacklistTerm}
                onChange={e => setNewBlacklistTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addBlacklistTerm(); }}
                placeholder="e.g., minecraft, fortnite, buy cheap..."
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
              <button
                onClick={addBlacklistTerm}
                disabled={blacklistLoading || !newBlacklistTerm.trim()}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
              >
                {blacklistLoading ? 'Adding...' : 'Add to Blacklist'}
              </button>
            </div>
          </div>

          {/* Terms list */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Blacklisted Terms</div>
            {blacklistTerms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No custom blacklist terms. Built-in patterns (buy/sell, hack, minecraft, etc.) are always active.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blacklistTerms.map(term => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-sm"
                  >
                    {term}
                    <button
                      onClick={() => removeBlacklistTerm(term)}
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
      )}

      {/* Tab: Ramping */}
      {tab === 'ramping' && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Period</span>
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setRampingDays(d)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    rampingDays === d
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
                value={rampingMinDelta}
                onChange={e => setRampingMinDelta(Number(e.target.value))}
                className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
                min={0}
                step={1}
              />
            </div>
            <button
              onClick={fetchRamping}
              disabled={rampingLoading}
              className="px-4 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors disabled:opacity-50"
            >
              {rampingLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Table */}
          {rampingLoading && rampingData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading ramping data...</div>
          ) : rampingData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No ramping keywords found for the selected criteria.</div>
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
                  {rampingData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                      <td className="py-2 pr-4 text-foreground font-medium">{row.keyword}</td>
                      <td className={`py-2 pr-4 text-right ${viceColor(row.currentVice)}`}>
                        {(row.currentVice ?? 0).toFixed(1)}
                      </td>
                      <td className={`py-2 pr-4 text-right font-mono ${(row.delta ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(row.delta ?? 0) > 0 ? '\u2191' : '\u2193'} {Math.abs(row.delta ?? 0).toFixed(1)}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {row.youtubeViews != null ? row.youtubeViews.toLocaleString() : '-'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className={sourceColor(row.source)}>{row.source}</Badge>
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
      )}
      </div>

      {/* Fixed footer: Pagination (keywords tab only) */}
      {tab === 'keywords' && totalKeywords > PAGE_SIZE && (
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalKeywords)} of {totalKeywords}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-surface-hover"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs text-muted-foreground">
              Page {page + 1} of {Math.ceil(totalKeywords / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalKeywords}
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

// ---------------------------------------------------------------------------
// VICE Breakdown Bar + Detail Panel
// ---------------------------------------------------------------------------

function ViceBar({ label, score, weight, color, detail }: { label: string; score: number; weight: number; color: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground shrink-0">{label} ({(weight * 100).toFixed(0)}%)</span>
      <div className="flex-1 h-3 bg-black/30 rounded overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-muted-foreground">{score.toFixed(0)}</span>
      <span className="text-[10px] text-muted-foreground/60 w-48 truncate" title={detail}>{detail}</span>
    </div>
  );
}

function KeywordDetailPanel({ kwId }: { kwId: number }) {
  const [details, setDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/seo/keywords/${kwId}/details`)
      .then(r => r.json())
      .then(d => { setDetails(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kwId]);

  if (loading) return <div className="px-4 py-3 text-xs text-muted-foreground">Loading details...</div>;
  if (!details) return <div className="px-4 py-3 text-xs text-red-400">Failed to load details</div>;

  const b = details.viceBreakdown;
  const evidence = details.semanticEvidence as Record<string, Array<{ score: number; title: string; source_score?: number }>> | null;

  return (
    <div className="px-4 py-3 bg-black/20 border-t border-border/30 space-y-3">
      {/* VICE Breakdown */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">VICE Breakdown (final: {b.final})</div>
        <div className="space-y-1">
          <ViceBar label="V - Volume" score={b.volume.score} weight={b.volume.weight} color="bg-blue-500" detail={`${b.volume.source}${b.volume.trendingBoost ? ` +trend:${b.volume.trendingBoost}` : ''}${b.volume.sourceAdj ? ` src:${b.volume.sourceAdj > 0 ? '+' : ''}${b.volume.sourceAdj}` : ''}${b.volume.ninjaAdj ? ` ninja:${b.volume.ninjaAdj > 0 ? '+' : ''}${b.volume.ninjaAdj}` : ''}`} />
          <ViceBar label="I - Intent" score={b.intent.score} weight={b.intent.weight} color="bg-amber-500" detail={b.intent.value} />
          <ViceBar label="C - Competition" score={b.competition.score} weight={b.competition.weight} color="bg-emerald-500" detail={`${b.competition.wordCount} words${b.competition.positionBonus ? ` +pos:${b.competition.positionBonus}` : ''}`} />
          <ViceBar label="E - Effort" score={b.effort.score} weight={b.effort.weight} color="bg-purple-500" detail={b.effort.cluster} />
        </div>
      </div>

      {/* Semantic Evidence */}
      {evidence && Object.keys(evidence).length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Semantic Evidence</div>
          {Object.entries(evidence).map(([collection, hits]) => (
            <div key={collection} className="mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">{collection}:</span>
              <ul className="ml-3">
                {hits.map((h: any, i: number) => (
                  <li key={i} className="text-[10px] text-muted-foreground/80">
                    <span className="font-mono text-sky-400/80">{h.score.toFixed(3)}</span>
                    {' '}{h.title}
                    {h.source_score != null && <span className="text-muted-foreground/50 ml-1">(score: {h.source_score})</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Source & Ninja info */}
      <div className="flex gap-6 text-[10px] text-muted-foreground/70 flex-wrap">
        <span>Source: <span className="text-muted-foreground">{details.source}</span></span>
        {details.parentKeyword && <span>Parent: <span className="text-muted-foreground">{details.parentKeyword}</span></span>}
        {details.ninjaMatchName && <span>Ninja match: <span className="text-muted-foreground">{details.ninjaMatchName}</span> ({details.ninjaPopularity?.toFixed(2)})</span>}
        <span>Discovered: <span className="text-muted-foreground">{new Date(details.discoveredAt).toLocaleDateString('pt-BR')}</span></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable: Keywords Table
// ---------------------------------------------------------------------------

function KeywordsTable({ keywords, loading, sortKey, sortDir, onSort }: {
  keywords: KeywordOpportunity[];
  loading: boolean;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const sorted = keywords;
  const toggle = onSort;
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="px-3 py-2" />
            <SortHeader label="VICE" active={sortKey === 'viceScore'} dir={sortKey === 'viceScore' ? sortDir : null} onToggle={() => toggle('viceScore')} className="px-3 py-2 w-16" tip="Volume 20% + Intent 30% + Competition 30% + Effort 20%. Higher = better opportunity" />
            <SortHeader label="Source" active={sortKey === 'source'} dir={sortKey === 'source' ? sortDir : null} onToggle={() => toggle('source')} className="px-3 py-2 w-20" tip="Where discovered: GSC, Suggest, YouTube, or Competitor" />
            <SortHeader label="Intent" active={sortKey === 'intent'} dir={sortKey === 'intent' ? sortDir : null} onToggle={() => toggle('intent')} className="px-3 py-2 w-24" tip="informational (how-to), commercial (best/compare), transactional (buy/sell), navigational" />
            <SortHeader label="Cluster" active={sortKey === 'cluster'} dir={sortKey === 'cluster' ? sortDir : null} onToggle={() => toggle('cluster')} className="px-3 py-2 w-28" tip="Content category: build guide, crafting, currency, tier list, atlas, league start, mechanic" />
            <SortHeader label="Imp" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => toggle('impressions')} className="px-3 py-2 w-16 text-right" tip="GSC impressions: how often this keyword appeared in Google search results" />
            <SortHeader label="Pos" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => toggle('position')} className="px-3 py-2 w-14 text-right" tip="Average Google position (1-100). Lower = better. 4-20 = striking distance" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => toggle('ctr')} className="px-3 py-2 w-14 text-right" tip="clicks / impressions. Low CTR + high impressions = optimize title/meta" />
            <SortHeader label="YT Views" active={sortKey === 'youtubeViews'} dir={sortKey === 'youtubeViews' ? sortDir : null} onToggle={() => toggle('youtubeViews')} className="px-3 py-2 w-20 text-right" tip="Total YouTube views for videos about this topic" />
            <SortHeader label="Ninja" active={sortKey === 'ninjaPopularity'} dir={sortKey === 'ninjaPopularity' ? sortDir : null} onToggle={() => toggle('ninjaPopularity')} className="px-3 py-2 w-24" tip="poe.ninja build popularity (0-1). Higher = more builds use this skill/class" />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No keywords yet. Run a suggest scan or import GSC data.</td></tr>
          ) : (
            sorted.map(kw => (
              <React.Fragment key={kw.id}>
                <tr
                  className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${expandedId === kw.id ? 'bg-surface-hover' : ''}`}
                  onClick={() => setExpandedId(expandedId === kw.id ? null : kw.id)}
                >
                  <td className="px-3 py-2">
                    <span className="text-foreground">{kw.keyword}</span>
                    {kw.isLongTail && <span className="ml-1.5 text-[9px] text-emerald-400 font-medium">LT</span>}
                    {kw.parentKeyword && (
                      <span className="block text-[10px] text-muted-foreground">from: {kw.parentKeyword}</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs ${viceColor(kw.viceScore)}`}>
                    {kw.viceScore != null ? kw.viceScore.toFixed(0) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={sourceColor(kw.source)}>{kw.source}</Badge>
                  </td>
                  <td className={`px-3 py-2 text-xs ${intentColor(kw.intent)}`}>
                    {kw.intent ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {kw.cluster ? clusterLabel(kw.cluster) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.impressions?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.position?.toFixed(1) ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.ctr != null ? `${(kw.ctr * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.youtubeViews?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {kw.ninjaPopularity != null ? (
                      <span className="flex items-center gap-1">
                        <span className={`font-mono ${kw.ninjaPopularity >= 0.7 ? 'text-green-400' : kw.ninjaPopularity >= 0.3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                          {kw.ninjaPopularity.toFixed(2)}
                        </span>
                        {kw.ninjaMatchName && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={kw.ninjaMatchName}>{kw.ninjaMatchName}</span>
                        )}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
                {expandedId === kw.id && (
                  <tr><td colSpan={10} className="p-0"><KeywordDetailPanel kwId={kw.id} /></td></tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable: Striking Distance Table
// ---------------------------------------------------------------------------

function StrikingTable({ data }: { data: StrikingKeyword[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSort<StrikingKeyword>(data, 'opportunityScore', 'desc');

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="px-3 py-2" />
            <SortHeader label="Position" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => toggle('position')} className="px-3 py-2 w-20 text-right" tip="Average Google position. 4-20 = striking distance" />
            <SortHeader label="Impressions" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => toggle('impressions')} className="px-3 py-2 w-20 text-right" />
            <SortHeader label="Clicks" active={sortKey === 'clicks'} dir={sortKey === 'clicks' ? sortDir : null} onToggle={() => toggle('clicks')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => toggle('ctr')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="Opp. Score" active={sortKey === 'opportunityScore'} dir={sortKey === 'opportunityScore' ? sortDir : null} onToggle={() => toggle('opportunityScore')} className="px-3 py-2 w-24 text-right" tip="impressions x (20 - position). Higher = more valuable" />
            <SortHeader label="Action" active={sortKey === 'action'} dir={sortKey === 'action' ? sortDir : null} onToggle={() => toggle('action')} className="px-3 py-2 w-28" tip="Fix CTR (title/meta), Push Top 5 (add content), Create Content (new page)" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No striking distance keywords. Import GSC data first.</td></tr>
          ) : (
            sorted.map((kw, i) => {
              const badge = actionBadge(kw.action);
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-3 py-2 text-foreground">{kw.keyword}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">{kw.position.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{kw.impressions.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{kw.clicks}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{(kw.ctr * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-foreground">{kw.opportunityScore.toFixed(0)}</td>
                  <td className="px-3 py-2"><Badge className={badge.color}>{badge.label}</Badge></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable: CTR Problems Table
// ---------------------------------------------------------------------------

function CtrTable({ data }: { data: StrikingKeyword[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSort<StrikingKeyword>(data, 'impressions', 'desc');

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="px-3 py-2" />
            <SortHeader label="Position" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => toggle('position')} className="px-3 py-2 w-20 text-right" />
            <SortHeader label="Impressions" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => toggle('impressions')} className="px-3 py-2 w-20 text-right" />
            <SortHeader label="Clicks" active={sortKey === 'clicks'} dir={sortKey === 'clicks' ? sortDir : null} onToggle={() => toggle('clicks')} className="px-3 py-2 w-16 text-right" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => toggle('ctr')} className="px-3 py-2 w-16 text-right" tip="Below 2% at position <10 = title/meta description problem" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No CTR problems found. Import GSC data first.</td></tr>
          ) : (
            sorted.map((kw, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                <td className="px-3 py-2 text-foreground">{kw.keyword}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">{kw.position.toFixed(1)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-foreground font-medium">{kw.impressions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{kw.clicks}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-red-400">{(kw.ctr * 100).toFixed(2)}%</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
