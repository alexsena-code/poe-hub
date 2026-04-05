'use client';

import React, { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendingKeyword {
  keyword: string;
  video_count: number;
  total_views: number;
  channels: string[];
  trending_score: number;
  qdrant_relevance?: number;
  from_transcript?: boolean;
}

interface AggregatedKeyword {
  keyword: string;
  total_mentions: number;
  total_views: number;
  video_count: number;
  max_trending_score: number;
  avg_trending_score: number;
  channels: string[];
  channel_count: number;
  momentum: string[];
  first_seen: string;
  last_seen: string;
  scan_count: number;
  from_transcript: boolean;
  confirmed: boolean;
  qdrant_relevance: number | null;
  pg_match: boolean | null;
  pg_type: string | null;
  score_history: Array<{ scanId: number; date: string; score: number }>;
}

interface AggregatedKeywordsResponse {
  keywords: AggregatedKeyword[];
  mode: 'aggregated' | 'single_scan';
  totalScans: number;
  totalUniqueKeywords?: number;
  scanId?: number;
}

interface ActiveChannel {
  channel: string;
  videos: number;
}

interface Video {
  id: string;
  title: string;
  channel: string;
  channel_id: string;
  views: number;
  published: string;
  url: string;
  is_live?: boolean;
  is_short?: boolean;
  duration?: number;
  tags?: string[];
}

interface YouTubeTrendsData {
  total_videos: number;
  poe_videos: number;
  channels_checked: number;
  trending_keywords: TrendingKeyword[];
  active_channels: ActiveChannel[];
  scan_timestamp: string;
  videos: Video[];
}

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
  youtubeViews: number | null;
  youtubeCount: number | null;
  trendingScore: number | null;
  discoveredAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 5000) return 'text-emerald-400 font-bold';
  if (score >= 1000) return 'text-emerald-300';
  if (score >= 500) return 'text-amber-300';
  if (score >= 100) return 'text-amber-400';
  return 'text-muted-foreground';
}

function channelColor(channel: string): string {
  // Deterministic color based on channel name
  const colors = [
    'bg-blue-900/40 text-blue-300',
    'bg-emerald-900/40 text-emerald-300',
    'bg-red-900/40 text-red-300',
    'bg-amber-900/40 text-amber-300',
    'bg-purple-900/40 text-purple-300',
    'bg-pink-900/40 text-pink-300',
    'bg-cyan-900/40 text-cyan-300',
    'bg-indigo-900/40 text-indigo-300',
  ];
  let hash = 0;
  for (let i = 0; i < channel.length; i++) {
    hash = channel.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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

type Tab = 'trending' | 'top-videos' | 'channels' | 'videos' | 'new-uploads' | 'db-keywords' | 'scan-history' | 'manage-channels';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: 'Trending Keywords' },
  { key: 'top-videos', label: 'Top Videos' },
  { key: 'channels', label: 'Active Channels' },
  { key: 'videos', label: 'Recent Videos' },
  { key: 'new-uploads', label: 'New Uploads' },
  { key: 'db-keywords', label: 'YouTube Keywords' },
  { key: 'scan-history', label: 'Scan History' },
  { key: 'manage-channels', label: 'Manage Channels' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function YouTubeTrendsPage() {
  const [tab, setTab] = useState<Tab>('trending');
  const [data, setData] = useState<YouTubeTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filter dropdown
  const [showFilters, setShowFilters] = useState(false);

  // Trending tab filters (lifted to page level for dropdown)
  const [minMentions, setMinMentions] = useState(1);

  // Top Videos tab filters (lifted to page level for dropdown)
  const [hideLives, setHideLives] = useState(true);
  const [hideShorts, setHideShorts] = useState(true);

  // DB keywords tab
  const [dbKeywords, setDbKeywords] = useState<KeywordOpportunity[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Smart scan streaming logs
  const [scanLogs, setScanLogs] = useState<Array<{ step: string; message: string }>>([]);
  const [scanStep, setScanStep] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auto-load latest data on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchLatest();
  }, []);

  async function fetchLatest() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/latest`);
      if (res.ok) {
        const result = await res.json();
        if (!result.error) setData(result);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }

  async function runScan() {
    setScanning(true);
    setImportResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      if (res.ok) {
        const result = await res.json();
        if (!result.error) {
          setData(result);
          setImportResult(`Scanned ${result.channels_checked} channels: ${result.poe_videos} PoE videos, ${result.trending_keywords?.length ?? 0} trending keywords`);
        } else {
          setImportResult(`Scan failed: ${result.error}`);
        }
      }
    } catch {
      setImportResult('Scan failed — check if Python crawler is accessible');
    }
    setScanning(false);
  }

  // ---------------------------------------------------------------------------
  // Fetch DB keywords (YouTube source)
  // ---------------------------------------------------------------------------

  const fetchDbKeywords = useCallback(async () => {
    setDbLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/keywords?source=youtube&limit=200`);
      if (res.ok) setDbKeywords(await res.json());
    } catch { /* API offline */ }
    setDbLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'db-keywords') fetchDbKeywords();
  }, [tab, fetchDbKeywords]);

  // ---------------------------------------------------------------------------
  // Import trending keywords to SEO DB
  // ---------------------------------------------------------------------------

  async function importToSeo() {
    if (!data) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/import/youtube-trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setImportResult(`Imported ${result.imported ?? 0} keywords, skipped ${result.skipped ?? 0}`);
      } else {
        setImportResult('Import failed: ' + (await res.text()));
      }
    } catch {
      setImportResult('Failed to connect to API');
    }
    setImportLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const channelsMonitored = data?.channels_checked ?? data?.active_channels?.length ?? '-';
  const videosAnalyzed = data?.total_videos ?? '-';
  const poeVideos = data?.poe_videos ?? '-';
  const trendingCount = data?.trending_keywords?.length ?? '-';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
      {/* Header + Stats + Actions */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">YouTube Trends</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor PoE content creators and discover trending topics
          </p>
        </div>
        <div />
      </div>

      {/* Stats bar + Actions */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Number of PoE content creators being tracked by the scanner">Channels</Tip></div>
            <div className="text-lg font-bold text-foreground">{channelsMonitored}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Total videos checked across all monitored channels in the last 30 days">Videos Analyzed</Tip></div>
            <div className="text-lg font-bold text-foreground">{videosAnalyzed}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Videos that matched PoE keywords in title or tags">PoE Videos</Tip></div>
            <div className="text-lg font-bold text-foreground">{poeVideos}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider"><Tip text="Unique keywords across all scans — aggregated with momentum tracking (rising/stable/declining)">Trending KW</Tip></div>
            <div className="text-lg font-bold text-foreground">{trendingCount}</div>
          </div>
        </div>
        <div />
      </div>

      {importResult && (
        <div className="text-xs text-emerald-400 mb-2">{importResult}</div>
      )}

      {/* Smart Scan Progress */}
      {scanLogs.length > 0 && (
        <ScanProgress step={scanStep} logs={scanLogs} running={scanning} />
      )}

      {loading && !data && (
        <div className="text-center py-8 text-muted-foreground">Loading latest scan data...</div>
      )}

      {/* Tabs + Filter icon + Refresh */}
      {(() => {
        const hasActiveFilters =
          (tab === 'trending' && minMentions !== 1) ||
          (tab === 'top-videos' && (!hideLives || !hideShorts));
        const hasFiltersForTab = tab === 'trending' || tab === 'top-videos';
        return (
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setShowFilters(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-emerald-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          {hasFiltersForTab && (
            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`p-1.5 rounded transition-colors ${hasActiveFilters ? 'bg-foreground/15 text-foreground' : 'bg-foreground/5 text-muted-foreground hover:text-foreground'}`}
                title="Filters"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              </button>
              {showFilters && (
                <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground">Filters</span>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          if (tab === 'trending') setMinMentions(1);
                          if (tab === 'top-videos') { setHideLives(true); setHideShorts(true); }
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {tab === 'trending' && (
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Min Mentions</label>
                        <div className="flex gap-1">
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              onClick={() => setMinMentions(n)}
                              className={`px-2 py-1 text-xs rounded ${minMentions === n ? 'bg-emerald-600 text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'}`}
                            >
                              {n}+
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {tab === 'top-videos' && (
                      <>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input type="checkbox" checked={hideLives} onChange={e => setHideLives(e.target.checked)} className="rounded border-border" />
                          Hide livestreams/VODs
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input type="checkbox" checked={hideShorts} onChange={e => setHideShorts(e.target.checked)} className="rounded border-border" />
                          Hide Shorts
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
          >
            {scanning ? '...' : 'Quick Scan'}
          </button>
          <button
            onClick={() => {
              setScanning(true);
              setImportResult(null);
              setScanLogs([]);
              setScanStep('start');
              fetch(`${API_URL}/seo/youtube/smart-scan-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: 30 }),
              }).then(async (res) => {
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) return;
                let buffer = '';
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';
                  let currentEvent = '';
                  for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7);
                    else if (line.startsWith('data: ')) {
                      try {
                        const payload = JSON.parse(line.slice(6));
                        if (currentEvent === 'log') { setScanLogs(prev => [...prev, payload]); setScanStep(payload.step); }
                        else if (currentEvent === 'result') { setData(payload); setImportResult(`Smart scan: ${payload.poe_videos} PoE videos, ${payload.trending_keywords?.length ?? 0} keywords`); }
                        else if (currentEvent === 'error') setImportResult(`Error: ${payload.message}`);
                      } catch {}
                    }
                  }
                }
                setScanStep(null); setScanning(false);
              }).catch(() => { setImportResult('Smart scan failed'); setScanStep(null); setScanning(false); });
            }}
            disabled={scanning}
            className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
          >
            {scanning ? '...' : 'Smart Scan'}
          </button>
          {data && (
            <button
              onClick={importToSeo}
              disabled={importLoading}
              className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
            >
              {importLoading ? '...' : 'Import SEO'}
            </button>
          )}
          <button
            onClick={fetchLatest}
            className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 rounded text-sm text-foreground transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
        );
      })()}
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
      {/* Tab Content */}
      {tab === 'trending' && <TrendingTab data={data} minMentions={minMentions} />}
      {tab === 'top-videos' && <TopVideosTab data={data} hideLives={hideLives} hideShorts={hideShorts} />}
      {tab === 'channels' && <ChannelsTab data={data} allKeywords={data?.trending_keywords ?? []} />}
      {tab === 'videos' && <VideosTab data={data} />}
      {tab === 'new-uploads' && <NewUploadsTab />}
      {tab === 'db-keywords' && <DbKeywordsTab keywords={dbKeywords} loading={dbLoading} />}
      {tab === 'scan-history' && <ScanHistoryTab />}
      {tab === 'manage-channels' && <ManageChannelsTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Scan Progress
// ---------------------------------------------------------------------------

const SCAN_STEPS = [
  { key: 'start', label: 'Starting' },
  { key: 'fetch', label: 'RSS Fetch' },
  { key: 'classify', label: 'AI Classification' },
  { key: 'transcripts', label: 'Transcripts' },
  { key: 'keywords', label: 'Keyword Extraction' },
  { key: 'ingest', label: 'Qdrant + Slang' },
  { key: 'validate', label: 'Cross-Validation' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'qdrant', label: 'DB Validation' },
  { key: 'done', label: 'Complete' },
];

function ScanProgress({ step, logs, running }: { step: string | null; logs: Array<{ step: string; message: string }>; running: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll log container to bottom as new logs arrive
  React.useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs.length, expanded]);

  // When expanding, scroll the whole page so the progress bar is visible
  React.useEffect(() => {
    if (expanded && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [expanded]);

  const currentIdx = SCAN_STEPS.findIndex(s => s.key === step);
  const progress = step === 'done' || !running ? 100 : Math.max(5, Math.round(((currentIdx + 1) / SCAN_STEPS.length) * 100));

  return (
    <div ref={containerRef} className="mb-4 bg-surface border border-border rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-muted-foreground">
            {running ? SCAN_STEPS.find(s => s.key === step)?.label || 'Processing...' : 'Scan complete'}
          </span>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${running ? 'bg-purple-500' : 'bg-emerald-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {SCAN_STEPS.filter(s => s.key !== 'start').map((s) => {
          const idx = SCAN_STEPS.findIndex(x => x.key === s.key);
          const isDone = currentIdx > idx || (!running && logs.length > 0);
          const isCurrent = s.key === step;
          return (
            <span
              key={s.key}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                isCurrent ? 'bg-purple-500/30 text-purple-300' :
                isDone ? 'bg-emerald-500/15 text-emerald-400' :
                'bg-foreground/5 text-muted-foreground/50'
              }`}
            >
              {s.label}
            </span>
          );
        })}
      </div>

      {/* Log viewer toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-1.5 text-[10px] text-muted-foreground hover:text-foreground border-t border-border/50 transition-colors text-left"
      >
        {expanded ? 'Hide logs' : `Show logs (${logs.length} lines)`}
      </button>

      {/* Log lines */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto bg-background px-4 py-2 border-t border-border/50 font-mono text-[10px] leading-relaxed">
          {logs.map((log, i) => (
            <div key={i} className={`${log.step === 'done' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {log.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable video list (for keyword detail rows)
// ---------------------------------------------------------------------------

function ExpandableVideoList({ videos }: { videos: Video[] }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 5;
  const visible = showAll ? videos : videos.slice(0, INITIAL);

  if (videos.length === 0) {
    return <p className="text-xs text-muted-foreground">No exact title matches — keyword was extracted from n-grams.</p>;
  }

  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Videos ({videos.length})</div>
      {visible.map(v => (
        <div key={v.id} className="py-1 flex justify-between items-center">
          <a href={v.url} target="_blank" rel="noopener" className="text-sm text-foreground hover:text-emerald-400 hover:underline">{v.title}</a>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">{v.channel} {v.views > 0 && `· ${formatNumber(v.views)}`}</span>
        </div>
      ))}
      {videos.length > INITIAL && (
        <div className="text-center mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded bg-foreground/5 hover:bg-foreground/10"
          >
            {showAll ? 'Show less' : `Show all ${videos.length} videos`}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Trending Keywords (aggregated across all scans)
// ---------------------------------------------------------------------------

const MOMENTUM_STYLE: Record<string, { label: string; className: string }> = {
  rising: { label: 'Rising', className: 'bg-emerald-900/40 text-emerald-300' },
  stable: { label: 'Stable', className: 'bg-blue-900/40 text-blue-300' },
  declining: { label: 'Declining', className: 'bg-red-900/40 text-red-300' },
  new: { label: 'New', className: 'bg-purple-900/40 text-purple-300' },
};

function TrendingTab({ data, minMentions }: { data: YouTubeTrendsData | null; minMentions: number }) {
  const [aggData, setAggData] = useState<AggregatedKeywordsResponse | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    fetchAggregated();
  }, [minMentions]);

  async function fetchAggregated() {
    setAggLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/trending-keywords?limit=500&minMentions=${minMentions}`);
      if (res.ok) {
        const result = await res.json();
        if (!result.error) setAggData(result);
      }
    } catch { /* API offline */ }
    setAggLoading(false);
  }

  const { sorted, sortKey, sortDir, toggle } = useSort<AggregatedKeyword>(
    aggData?.keywords ?? [], 'max_trending_score', 'desc'
  );
  const visible = sorted.slice(0, displayLimit);
  const hasMore = sorted.length > displayLimit;

  if (aggLoading) {
    return <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Loading trending keywords...</p></div>;
  }

  if (!aggData || aggData.keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No trending keywords yet. Run a Smart Scan first.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {aggData.totalUniqueKeywords} keywords across {aggData.totalScans} scan{aggData.totalScans !== 1 ? 's' : ''}
            {minMentions > 1 && ` (min ${minMentions}+ mentions)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Show:</span>
          {[50, 100, 200].map((n) => (
            <button
              key={n}
              onClick={() => setDisplayLimit(n)}
              className={`px-2 py-0.5 text-xs rounded ${displayLimit === n ? 'bg-emerald-600 text-white' : 'bg-surface-hover text-muted-foreground hover:text-foreground'}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setDisplayLimit(sorted.length)}
            className={`px-2 py-0.5 text-xs rounded ${displayLimit >= sorted.length ? 'bg-emerald-600 text-white' : 'bg-surface-hover text-muted-foreground hover:text-foreground'}`}
          >
            All
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="pb-2 pr-3 w-8">#</th>
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="pb-2 pr-3" tip="Trending topic extracted from video titles" />
            <SortHeader label="Score" active={sortKey === 'max_trending_score'} dir={sortKey === 'max_trending_score' ? sortDir : null} onToggle={() => toggle('max_trending_score')} className="pb-2 pr-3 text-right" tip="Peak trending score across all scans" />
            <SortHeader label="Videos" active={sortKey === 'video_count'} dir={sortKey === 'video_count' ? sortDir : null} onToggle={() => toggle('video_count')} className="pb-2 pr-3 text-right" tip="Total videos mentioning this topic" />
            <SortHeader label="Views" active={sortKey === 'total_views'} dir={sortKey === 'total_views' ? sortDir : null} onToggle={() => toggle('total_views')} className="pb-2 pr-3 text-right" tip="Total views across all videos" />
            <SortHeader label="Mentions" active={sortKey === 'total_mentions'} dir={sortKey === 'total_mentions' ? sortDir : null} onToggle={() => toggle('total_mentions')} className="pb-2 pr-3 text-right" tip="Number of scans where this keyword appeared" />
            <th className="pb-2 pr-3"><Tip text="Trend direction: Rising (score increasing), Stable, Declining, or New (first scan)">Trend</Tip></th>
            <SortHeader label="Channels" active={sortKey === 'channel_count'} dir={sortKey === 'channel_count' ? sortDir : null} onToggle={() => toggle('channel_count')} className="pb-2 pr-3 text-right" tip="Unique creators covering this topic" />
          </tr>
        </thead>
        <tbody>
          {visible.map((kw, i) => {
            return (
              <React.Fragment key={kw.keyword}>
              <tr
                className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${expanded === kw.keyword ? 'bg-foreground/5 border-border' : ''}`}
                onClick={() => setExpanded(expanded === kw.keyword ? null : kw.keyword)}
              >
                <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-foreground hover:text-emerald-400">
                  {kw.keyword}
                  {kw.from_transcript && <span className="ml-1.5 text-[8px] text-purple-400 opacity-70" title="From transcript">T</span>}
                  {kw.confirmed && <span className="ml-1 text-[8px] text-emerald-400 opacity-70" title="Confirmed by regex + AI">C</span>}
                  {(kw.qdrant_relevance ?? 0) > 0.3 && <span className="ml-1 text-[8px] text-sky-400 opacity-70" title={`Qdrant: ${kw.qdrant_relevance?.toFixed(2)}`}>Q</span>}
                  {kw.pg_match && <span className="ml-1 text-[8px] text-amber-400 opacity-70" title={`DB match: ${kw.pg_type}`}>PG</span>}
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.max_trending_score)}`}>
                  {kw.max_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.video_count}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{formatNumber(kw.total_views)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.total_mentions}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-1">
                    {kw.momentum.map(tag => {
                      const style = MOMENTUM_STYLE[tag] ?? MOMENTUM_STYLE.new;
                      return <span key={tag} className={`px-1.5 py-0.5 text-[10px] rounded ${style.className}`}>{style.label}</span>;
                    })}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.channel_count}</td>
              </tr>
              {expanded === kw.keyword && (
                <tr className="bg-foreground/[0.03] border-b border-border">
                  <td colSpan={8} className="px-4 py-3">
                    <div className="grid grid-cols-5 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground"><Tip text="Peak trending score">Max Score</Tip></div>
                        <div className="text-lg font-bold text-foreground">{kw.max_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground"><Tip text="Average trending score across scans">Avg Score</Tip></div>
                        <div className="text-lg font-bold text-foreground">{kw.avg_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground"><Tip text="Total videos mentioning this topic">Videos</Tip></div>
                        <div className="text-lg font-bold text-foreground">{kw.video_count}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground"><Tip text="Total views across all videos">Total Views</Tip></div>
                        <div className="text-lg font-bold text-foreground">{formatNumber(kw.total_views)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground"><Tip text="Appeared in N different scans">Scans</Tip></div>
                        <div className="text-lg font-bold text-foreground">{kw.scan_count}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                      <span>First seen: {new Date(kw.first_seen).toLocaleDateString()}</span>
                      <span>Last seen: {new Date(kw.last_seen).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {kw.channels.map(ch => (
                        <Badge key={ch} className={channelColor(ch)}>{ch}</Badge>
                      ))}
                    </div>
                    {kw.score_history.length > 1 && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Score History</div>
                        <div className="flex items-end gap-1 h-12">
                          {kw.score_history.map((h, idx) => {
                            const maxH = Math.max(...kw.score_history.map(s => s.score));
                            const pct = maxH > 0 ? (h.score / maxH) * 100 : 0;
                            return (
                              <div
                                key={idx}
                                className="bg-emerald-500/60 rounded-t min-w-[8px] flex-1"
                                style={{ height: `${Math.max(pct, 4)}%` }}
                                title={`Scan #${h.scanId}: ${h.score.toFixed(0)} (${new Date(h.date).toLocaleDateString()})`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {hasMore && (
        <div className="text-center py-3">
          <button
            onClick={() => setDisplayLimit((prev) => Math.min(prev + 50, sorted.length))}
            className="px-4 py-1.5 text-xs bg-surface-hover hover:bg-emerald-600/20 text-muted-foreground hover:text-emerald-400 rounded transition-colors"
          >
            Show 50 more ({sorted.length - displayLimit} remaining)
          </button>
        </div>
      )}
      {sorted.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">No trending keywords found. Run a Smart Scan first.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Top Videos (by views)
// ---------------------------------------------------------------------------

function TopVideosTab({ data: latestData, hideLives, hideShorts }: { data: YouTubeTrendsData | null; hideLives: boolean; hideShorts: boolean }) {
  const [scans, setScans] = useState<Array<{ id: number; totalVideos: number; createdAt: string }>>([]);
  const [selectedScan, setSelectedScan] = useState<string>('latest');
  const [scanData, setScanData] = useState<YouTubeTrendsData | null>(null);

  // Fetch scan list on mount
  useEffect(() => {
    fetch(`${API_URL}/seo/youtube/scans`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setScans(data); })
      .catch(() => {});
  }, []);

  // Fetch scan data when selection changes
  useEffect(() => {
    if (selectedScan === 'latest') {
      setScanData(null); // use latestData prop
    } else if (selectedScan === 'all') {
      // Merge videos from all scans (fetch each and combine)
      Promise.all(
        scans.map(s =>
          fetch(`${API_URL}/seo/youtube/scans/${s.id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      ).then(results => {
        const allVideos: Video[] = [];
        const seen = new Set<string>();
        for (const r of results) {
          if (r?.videos) {
            for (const v of r.videos) {
              if (!seen.has(v.id)) {
                seen.add(v.id);
                allVideos.push(v);
              }
            }
          }
        }
        setScanData({
          total_videos: allVideos.length,
          poe_videos: allVideos.length,
          channels_checked: scans.length > 0 ? (results[0]?.channels_checked ?? 0) : 0,
          trending_keywords: [],
          active_channels: [],
          scan_timestamp: new Date().toISOString(),
          videos: allVideos,
        } as YouTubeTrendsData);
      });
    } else {
      fetch(`${API_URL}/seo/youtube/scans/${selectedScan}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && !data.error) setScanData(data); })
        .catch(() => {});
    }
  }, [selectedScan, scans]);

  const data = selectedScan === 'latest' ? latestData : scanData;

  const LIVE_RE = /\[LIVE\]|\(LIVE\)|Livestream|![a-z]+\s+![a-z]+/i;
  const filtered = (data?.videos ?? []).filter(v => {
    if (hideLives && (v.is_live || LIVE_RE.test(v.title))) return false;
    if (hideShorts && (v.is_short || (v.duration && v.duration > 0 && v.duration < 120))) return false;
    return true;
  });
  const { sorted, sortKey, sortDir, toggle } = useSort<Video>(filtered, 'views', 'desc');

  if (!data || !data.videos) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">{selectedScan !== 'latest' && selectedScan !== 'all' ? 'Loading scan...' : 'No data yet. Run a scan first.'}</p>
      </div>
    );
  }

  const allVids = data?.videos ?? [];
  const liveCount = allVids.filter(v => v.is_live || LIVE_RE.test(v.title)).length;
  const shortCount = allVids.filter(v => v.is_short || (v.duration && v.duration > 0 && v.duration < 120)).length;
  const totalViews = filtered.reduce((sum, v) => sum + (v.views || 0), 0);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total Views" value={formatNumber(totalViews)} tip="Sum of all views across PoE videos in this scan period" />
        <StatCard label="PoE Videos" value={data?.poe_videos ?? allVids.length} tip="Videos classified as Path of Exile content" />
        <StatCard label="Avg Views" value={formatNumber(Math.round(totalViews / (allVids.length || 1)))} tip="Average views per PoE video" />
      </div>

      {/* Scan selector + Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Scan:</span>
          <select
            value={selectedScan}
            onChange={e => setSelectedScan(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-foreground"
          >
            <option value="latest">Latest scan</option>
            <option value="all">All scans</option>
            {scans.map(s => (
              <option key={s.id} value={String(s.id)}>
                #{s.id} — {s.totalVideos} videos ({new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {sorted.length} videos
          {(liveCount > 0 && hideLives) && <span className="text-muted-foreground/50"> ({liveCount} lives hidden)</span>}
          {(shortCount > 0 && hideShorts) && <span className="text-muted-foreground/50"> ({shortCount} shorts hidden)</span>}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-2 pr-3 w-8">#</th>
              <SortHeader label="Title" active={sortKey === 'title'} dir={sortKey === 'title' ? sortDir : null} onToggle={() => toggle('title')} className="pb-2 pr-3" />
              <SortHeader label="Channel" active={sortKey === 'channel'} dir={sortKey === 'channel' ? sortDir : null} onToggle={() => toggle('channel')} className="pb-2 pr-3" />
              <SortHeader label="Views" active={sortKey === 'views'} dir={sortKey === 'views' ? sortDir : null} onToggle={() => toggle('views')} className="pb-2 pr-3 text-right" />
              <SortHeader label="Duration" active={sortKey === 'duration'} dir={sortKey === 'duration' ? sortDir : null} onToggle={() => toggle('duration')} className="pb-2 pr-3 text-right" tip="Video length — lives are usually 2h+" />
              <SortHeader label="Published" active={sortKey === 'published'} dir={sortKey === 'published' ? sortDir : null} onToggle={() => toggle('published')} className="pb-2 pr-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => {
              const viewPct = totalViews > 0 ? (v.views / totalViews) * 100 : 0;
              return (
                <tr key={v.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-3 max-w-md">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-emerald-400 hover:underline line-clamp-1"
                        title={v.title}
                      >
                        {v.title}
                      </a>
                      {v.is_live && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400">LIVE</span>}
                      {(v.is_short || (v.duration && v.duration > 0 && v.duration < 120)) && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-yellow-900/30 text-yellow-400">SHORT</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={channelColor(v.channel)}>{v.channel}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${Math.min(viewPct * 3, 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-foreground font-medium">{formatNumber(v.views)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {v.is_live && <span className="text-red-400">{formatDuration(v.duration)}</span>}
                    {!v.is_live && formatDuration(v.duration)}
                  </td>
                  <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">{timeAgo(v.published)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Active Channels
// ---------------------------------------------------------------------------

function ChannelsTab({ data, allKeywords }: { data: YouTubeTrendsData | null; allKeywords: TrendingKeyword[] }) {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { sorted, sortKey, sortDir, toggle } = useSort<ActiveChannel>(
    data?.active_channels ?? [], 'videos', 'desc'
  );

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No data yet. Click &quot;Scan Channels&quot; to monitor PoE creators.</p>
      </div>
    );
  }

  // Build channel -> topics map
  const channelTopics: Record<string, string[]> = {};
  for (const kw of allKeywords) {
    for (const ch of kw.channels) {
      if (!channelTopics[ch]) channelTopics[ch] = [];
      if (channelTopics[ch].length < 5) channelTopics[ch].push(kw.keyword);
    }
  }

  // Get videos for selected channel
  const channelVideos = selectedChannel
    ? data.videos.filter(v => v.channel === selectedChannel).sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    : [];

  // Extract keywords per video
  function videoKeywords(title: string): string[] {
    const lower = title.toLowerCase();
    const found: string[] = [];
    const entities = [
      "righteous fire", "cyclone", "tornado shot", "lightning arrow", "lightning strike",
      "boneshatter", "spark", "arc", "ball lightning", "essence drain", "toxic rain",
      "detonate dead", "spectral helix", "flicker strike", "kinetic blast", "glacial cascade",
      "explosive arrow", "holy relic", "storm brand", "penance brand", "shock nova",
      "chieftain", "deadeye", "necromancer", "elementalist", "pathfinder", "juggernaut",
      "slayer", "gladiator", "champion", "assassin", "trickster", "inquisitor", "guardian",
      "hierophant", "berserker", "saboteur", "occultist",
      "atlas", "mapping", "crafting", "delve", "heist", "harvest", "ritual",
      "league start", "mirage", "currency", "bleed bow", "void shockwave",
    ];
    for (const e of entities) {
      if (lower.includes(e)) found.push(e);
    }
    return found;
  }

  return (
    <div className="flex gap-4">
      {/* Left: channel list */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <SortHeader label="Channel" active={sortKey === 'channel'} dir={sortKey === 'channel' ? sortDir : null} onToggle={() => toggle('channel')} className="pb-2 pr-3" />
              <SortHeader label="Videos (30d)" active={sortKey === 'videos'} dir={sortKey === 'videos' ? sortDir : null} onToggle={() => toggle('videos')} className="pb-2 pr-3 text-right" tip="Videos published in the last 30 days" />
              <th className="pb-2"><Tip text="Most common PoE topics in their recent videos">Top Topics</Tip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ch) => (
              <tr
                key={ch.channel}
                onClick={() => setSelectedChannel(selectedChannel === ch.channel ? null : ch.channel)}
                className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${selectedChannel === ch.channel ? 'bg-foreground/5 border-border' : ''}`}
              >
                <td className="py-2 pr-3">
                  <Badge className={channelColor(ch.channel)}>{ch.channel}</Badge>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium text-foreground">{ch.videos}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {(channelTopics[ch.channel] || []).map((topic) => (
                      <span key={topic} className="text-xs text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded">{topic}</span>
                    ))}
                    {!channelTopics[ch.channel]?.length && <span className="text-xs text-muted-foreground">-</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right: selected channel videos */}
      {selectedChannel && (
        <div className="w-[420px] shrink-0 bg-surface border border-border rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-foreground">{selectedChannel}</h3>
            <span className="text-xs text-muted-foreground">{channelVideos.length} videos</span>
          </div>
          {channelVideos.length === 0 && (
            <p className="text-xs text-muted-foreground">No PoE videos found for this channel.</p>
          )}
          {channelVideos.map(v => {
            const kws = videoKeywords(v.title);
            return (
              <div key={v.id} className="border-b border-border/50 py-3 last:border-0">
                <a href={v.url} target="_blank" rel="noopener" className="text-sm text-foreground hover:text-emerald-400 block mb-1">
                  {v.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span>{timeAgo(v.published)}</span>
                  {v.views > 0 && <span>{formatNumber(v.views)} views</span>}
                </div>
                {kws.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {kws.map(k => (
                      <span key={k} className="text-[10px] bg-emerald-900/30 text-emerald-300 px-1.5 py-0.5 rounded">{k}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Recent Videos
// ---------------------------------------------------------------------------

function VideosTab({ data }: { data: YouTubeTrendsData | null }) {
  const { sorted, sortKey, sortDir, toggle } = useSort<Video>(data?.videos ?? [], 'published', 'desc');

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No data yet. Click &quot;Scan Channels&quot; to monitor PoE creators.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-3">
        <span className="text-xs text-muted-foreground ml-auto">{sorted.length} videos</span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <SortHeader label="Title" active={sortKey === 'title'} dir={sortKey === 'title' ? sortDir : null} onToggle={() => toggle('title')} className="pb-2 pr-3" tip="Video title — click to open on YouTube" />
            <SortHeader label="Channel" active={sortKey === 'channel'} dir={sortKey === 'channel' ? sortDir : null} onToggle={() => toggle('channel')} className="pb-2 pr-3" tip="YouTube channel that published the video" />
            <SortHeader label="Published" active={sortKey === 'published'} dir={sortKey === 'published' ? sortDir : null} onToggle={() => toggle('published')} className="pb-2 pr-3 text-right" tip="When the video was published" />
            <SortHeader label="Views" active={sortKey === 'views'} dir={sortKey === 'views' ? sortDir : null} onToggle={() => toggle('views')} className="pb-2 text-right" tip="View count at time of last scan" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
              <td className="py-2 pr-3 max-w-md">
                <div className="flex items-center gap-1.5">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 hover:underline line-clamp-1"
                    title={v.title}
                  >
                    {v.title}
                  </a>
                  {v.is_live && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400">LIVE</span>}
                  {(v.is_short || (v.duration && v.duration > 0 && v.duration < 120)) && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-yellow-900/30 text-yellow-400">SHORT</span>}
                </div>
              </td>
              <td className="py-2 pr-3">
                <Badge className={channelColor(v.channel)}>{v.channel}</Badge>
              </td>
              <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">{timeAgo(v.published)}</td>
              <td className="py-2 text-right tabular-nums text-foreground">{formatNumber(v.views)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">No videos found.</p>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: YouTube Keywords (from DB)
// ---------------------------------------------------------------------------

function DbKeywordsTab({ keywords, loading }: { keywords: KeywordOpportunity[]; loading: boolean }) {
  const { sorted, sortKey, sortDir, toggle } = useSort<KeywordOpportunity>(keywords, 'trendingScore', 'desc');

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Loading keywords from database...</p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No YouTube keywords in database. Import trends data first or run a YouTube scan.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="pb-2 pr-3 w-8">#</th>
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => toggle('keyword')} className="pb-2 pr-3" tip="Keyword imported from YouTube trends scan" />
            <SortHeader label="Cluster" active={sortKey === 'cluster'} dir={sortKey === 'cluster' ? sortDir : null} onToggle={() => toggle('cluster')} className="pb-2 pr-3" tip="Topic group (e.g. builds, crafting, league)" />
            <SortHeader label="Intent" active={sortKey === 'intent'} dir={sortKey === 'intent' ? sortDir : null} onToggle={() => toggle('intent')} className="pb-2 pr-3" tip="informational (learn), commercial (compare), transactional (buy/trade), navigational (find page)" />
            <SortHeader label="YT Views" active={sortKey === 'youtubeViews'} dir={sortKey === 'youtubeViews' ? sortDir : null} onToggle={() => toggle('youtubeViews')} className="pb-2 pr-3 text-right" tip="Total YouTube views across all videos about this keyword" />
            <SortHeader label="YT Videos" active={sortKey === 'youtubeCount'} dir={sortKey === 'youtubeCount' ? sortDir : null} onToggle={() => toggle('youtubeCount')} className="pb-2 pr-3 text-right" tip="Number of YouTube videos covering this keyword" />
            <SortHeader label="Trending" active={sortKey === 'trendingScore'} dir={sortKey === 'trendingScore' ? sortDir : null} onToggle={() => toggle('trendingScore')} className="pb-2 pr-3 text-right" tip="views × channels × videos / 1000. Higher = hotter topic" />
            <SortHeader label="VICE" active={sortKey === 'viceScore'} dir={sortKey === 'viceScore' ? sortDir : null} onToggle={() => toggle('viceScore')} className="pb-2 pr-3 text-right" tip="Volume, Intent, Competition, Effort — composite (0-5). Higher = better opportunity" />
            <SortHeader label="Status" active={sortKey === 'status'} dir={sortKey === 'status' ? sortDir : null} onToggle={() => toggle('status')} className="pb-2 pr-3" tip="new → approved → published (or rejected)" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw, i) => (
            <tr key={kw.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
              <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
              <td className="py-2 pr-3">
                {kw.cluster ? (
                  <span className="text-xs text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded">
                    {kw.cluster.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {kw.intent ? (
                  <span className={`text-xs ${intentColor(kw.intent)}`}>{kw.intent}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {kw.youtubeViews != null ? formatNumber(kw.youtubeViews) : '-'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {kw.youtubeCount ?? '-'}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.trendingScore ?? 0)}`}>
                {kw.trendingScore != null ? kw.trendingScore.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '-'}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${viceColor(kw.viceScore)}`}>
                {kw.viceScore != null ? kw.viceScore.toFixed(0) : '-'}
              </td>
              <td className="py-2 pr-3">
                <Badge className={statusColor(kw.status)}>{kw.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extra helpers for DB keywords tab
// ---------------------------------------------------------------------------

function intentColor(intent: string | null): string {
  switch (intent) {
    case 'informational': return 'text-sky-400';
    case 'commercial': return 'text-amber-400';
    case 'transactional': return 'text-red-400';
    case 'navigational': return 'text-purple-400';
    default: return 'text-muted-foreground';
  }
}

function viceColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-400 font-bold';
  if (score >= 60) return 'text-emerald-300';
  if (score >= 40) return 'text-amber-300';
  return 'text-red-300';
}

function statusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-sky-900/40 text-sky-300';
    case 'approved': return 'bg-emerald-900/40 text-emerald-300';
    case 'rejected': return 'bg-red-900/40 text-red-300';
    case 'published': return 'bg-purple-900/40 text-purple-300';
    default: return 'bg-surface text-muted-foreground';
  }
}

// ---------------------------------------------------------------------------
// Tab: Scan History
// ---------------------------------------------------------------------------

interface ScanRecordRaw {
  id: number;
  scanType: string;
  createdAt: string;
  channelsChecked: number;
  totalVideos: number;
  poeVideos: number;
  transcriptsFetched: number;
  llmCostUsd: number | null;
  durationMs: number | null;
  _count: { videos: number; keywords: number };
}

interface ScanRecord {
  id: number;
  type: string;
  date: string;
  videos: number;
  keywords: number;
  llmCost: number | null;
  duration: number | null;
}

function mapScanRecord(raw: ScanRecordRaw): ScanRecord {
  return {
    id: raw.id,
    type: raw.scanType,
    date: raw.createdAt,
    videos: raw._count?.videos ?? raw.poeVideos ?? 0,
    keywords: raw._count?.keywords ?? 0,
    llmCost: raw.llmCostUsd,
    duration: raw.durationMs,
  };
}

interface CompareResult {
  rising: Array<{ keyword: string; delta: number; current: number; previous: number }>;
  declining: Array<{ keyword: string; delta: number; current: number; previous: number }>;
  newKeywords: Array<{ keyword: string; score: number }>;
}

function ScanHistoryTab() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const { sorted, sortKey, sortDir, toggle } = useSort<ScanRecord>(scans, 'date', 'desc');

  const fetchScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/scans`);
      if (res.ok) {
        const raw = await res.json();
        setScans(Array.isArray(raw) ? raw.map(mapScanRecord) : []);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          // Replace the oldest selected with the new one
          const first = next.values().next().value;
          if (first !== undefined) next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
    // Clear previous comparison when selection changes
    setCompareResult(null);
    setCompareError(null);
  }

  async function runCompare() {
    const ids = Array.from(selected);
    if (ids.length !== 2) return;
    setComparing(true);
    setCompareError(null);
    setCompareResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/compare?scan1=${ids[0]}&scan2=${ids[1]}`);
      if (res.ok) {
        setCompareResult(await res.json());
      } else {
        setCompareError('Compare failed: ' + (await res.text()));
      }
    } catch {
      setCompareError('Failed to connect to API');
    }
    setComparing(false);
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading scan history...</div>;
  }

  if (scans.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No scans yet. Run a Quick Scan or Smart Scan first.</p>
      </div>
    );
  }

  const selectedIds = Array.from(selected);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-muted-foreground">
          {selected.size === 0 && 'Select 2 scans to compare'}
          {selected.size === 1 && 'Select 1 more scan to compare'}
          {selected.size === 2 && 'Ready to compare'}
        </span>
        {selected.size === 2 && (
          <button
            onClick={runCompare}
            disabled={comparing}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
          >
            {comparing ? 'Comparing...' : 'Compare'}
          </button>
        )}
        {selected.size > 0 && (
          <button
            onClick={() => { setSelected(new Set()); setCompareResult(null); setCompareError(null); }}
            className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Scans table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-2 pr-3 w-8"></th>
              <SortHeader label="ID" active={sortKey === 'id'} dir={sortKey === 'id' ? sortDir : null} onToggle={() => toggle('id')} className="pb-2 pr-3" />
              <SortHeader label="Type" active={sortKey === 'type'} dir={sortKey === 'type' ? sortDir : null} onToggle={() => toggle('type')} className="pb-2 pr-3" tip="quick = RSS only, smart = AI classification + transcripts" />
              <SortHeader label="Date" active={sortKey === 'date'} dir={sortKey === 'date' ? sortDir : null} onToggle={() => toggle('date')} className="pb-2 pr-3" />
              <SortHeader label="Videos" active={sortKey === 'videos'} dir={sortKey === 'videos' ? sortDir : null} onToggle={() => toggle('videos')} className="pb-2 pr-3 text-right" tip="Number of PoE videos found in this scan" />
              <SortHeader label="Keywords" active={sortKey === 'keywords'} dir={sortKey === 'keywords' ? sortDir : null} onToggle={() => toggle('keywords')} className="pb-2 pr-3 text-right" tip="Trending keywords extracted" />
              <SortHeader label="LLM Cost" active={sortKey === 'llmCost'} dir={sortKey === 'llmCost' ? sortDir : null} onToggle={() => toggle('llmCost')} className="pb-2 pr-3 text-right" tip="API cost for AI classification + keyword extraction" />
              <SortHeader label="Duration" active={sortKey === 'duration'} dir={sortKey === 'duration' ? sortDir : null} onToggle={() => toggle('duration')} className="pb-2 pr-3 text-right" tip="Total scan time in seconds" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((scan) => {
              const isSelected = selected.has(scan.id);
              return (
                <tr
                  key={scan.id}
                  onClick={() => toggleSelect(scan.id)}
                  className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${isSelected ? 'bg-emerald-900/10 border-emerald-900/30' : ''}`}
                >
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(scan.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">{scan.id}</td>
                  <td className="py-2 pr-3">
                    <Badge className={scan.type === 'smart' ? 'bg-purple-900/40 text-purple-300' : 'bg-emerald-900/40 text-emerald-300'}>
                      {scan.type}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{timeAgo(scan.date)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{formatNumber(scan.videos)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{formatNumber(scan.keywords)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {scan.llmCost != null ? `$${scan.llmCost.toFixed(3)}` : '-'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {scan.duration != null ? `${scan.duration}s` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Compare error */}
      {compareError && (
        <div className="text-sm text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-3 mb-4">
          {compareError}
        </div>
      )}

      {/* Compare results */}
      {compareResult && (
        <CompareResults result={compareResult} scan1={selectedIds[0]} scan2={selectedIds[1]} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare Results Display
// ---------------------------------------------------------------------------

function CompareResults({ result, scan1, scan2 }: { result: CompareResult; scan1: number; scan2: number }) {
  const { rising, declining, newKeywords } = result;
  const risingSort = useSort<CompareResult['rising'][number]>(rising, 'delta', 'desc');
  const decliningSort = useSort<CompareResult['declining'][number]>(declining, 'delta', 'asc');

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        Comparing scan #{scan1} vs #{scan2}
      </div>

      {/* Rising keywords */}
      <div>
        <h3 className="text-sm font-bold text-emerald-400 mb-2">
          Rising ({rising.length})
        </h3>
        {rising.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rising keywords.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <SortHeader label="Keyword" active={risingSort.sortKey === 'keyword'} dir={risingSort.sortKey === 'keyword' ? risingSort.sortDir : null} onToggle={() => risingSort.toggle('keyword')} className="pb-2 pr-3" />
                  <SortHeader label="Delta" active={risingSort.sortKey === 'delta'} dir={risingSort.sortKey === 'delta' ? risingSort.sortDir : null} onToggle={() => risingSort.toggle('delta')} className="pb-2 pr-3 text-right" tip="Score change between scans" />
                  <SortHeader label="Current" active={risingSort.sortKey === 'current'} dir={risingSort.sortKey === 'current' ? risingSort.sortDir : null} onToggle={() => risingSort.toggle('current')} className="pb-2 pr-3 text-right" />
                  <SortHeader label="Previous" active={risingSort.sortKey === 'previous'} dir={risingSort.sortKey === 'previous' ? risingSort.sortDir : null} onToggle={() => risingSort.toggle('previous')} className="pb-2 pr-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {risingSort.sorted.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-400 font-medium">
                      +{kw.delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.current)}`}>
                      {kw.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {kw.previous.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New keywords */}
      <div>
        <h3 className="text-sm font-bold text-sky-400 mb-2">
          New ({newKeywords.length})
        </h3>
        {newKeywords.length === 0 ? (
          <p className="text-xs text-muted-foreground">No new keywords.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {newKeywords
              .sort((a, b) => b.score - a.score)
              .map((kw) => (
                <span
                  key={kw.keyword}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-900/20 border border-sky-900/30 text-sky-300 text-xs"
                >
                  {kw.keyword}
                  <span className={`tabular-nums text-[10px] ${scoreColor(kw.score)}`}>
                    {kw.score.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Declining keywords */}
      <div>
        <h3 className="text-sm font-bold text-red-400 mb-2">
          Declining ({declining.length})
        </h3>
        {declining.length === 0 ? (
          <p className="text-xs text-muted-foreground">No declining keywords.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <SortHeader label="Keyword" active={decliningSort.sortKey === 'keyword'} dir={decliningSort.sortKey === 'keyword' ? decliningSort.sortDir : null} onToggle={() => decliningSort.toggle('keyword')} className="pb-2 pr-3" />
                  <SortHeader label="Delta" active={decliningSort.sortKey === 'delta'} dir={decliningSort.sortKey === 'delta' ? decliningSort.sortDir : null} onToggle={() => decliningSort.toggle('delta')} className="pb-2 pr-3 text-right" tip="Score change between scans" />
                  <SortHeader label="Current" active={decliningSort.sortKey === 'current'} dir={decliningSort.sortKey === 'current' ? decliningSort.sortDir : null} onToggle={() => decliningSort.toggle('current')} className="pb-2 pr-3 text-right" />
                  <SortHeader label="Previous" active={decliningSort.sortKey === 'previous'} dir={decliningSort.sortKey === 'previous' ? decliningSort.sortDir : null} onToggle={() => decliningSort.toggle('previous')} className="pb-2 pr-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {decliningSort.sorted.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-red-400 font-medium">
                      {kw.delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.current)}`}>
                      {kw.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {kw.previous.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: New Uploads (card grid with thumbnails)
// ---------------------------------------------------------------------------

interface NewUploadVideo {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  views: number;
  published: string;
  url: string;
  is_live: boolean;
  duration: number | null;
  detectedAt: string;
}

type TimeRange = '24' | '48' | '168';

function NewUploadsTab() {
  const [allVideos, setAllVideos] = useState<NewUploadVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('48');
  const [hideShort, setHideShort] = useState(true);
  const [hideLives, setHideLives] = useState(true);

  const fetchUploads = useCallback(async (hours: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/new-uploads?hours=${hours}`);
      if (res.ok) {
        const data = await res.json();
        setAllVideos(data.videos ?? []);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUploads(range);
  }, [range, fetchUploads]);

  const MIN_DURATION = 120; // 2 minutes
  const LIVE_TITLE_RE = /\[LIVE\]|\(LIVE\)|Livestream|![a-z]+\s+![a-z]+/i;
  const isVideoLive = (v: NewUploadVideo) => v.is_live || LIVE_TITLE_RE.test(v.title);
  const isVideoShort = (v: NewUploadVideo) => v.duration != null && v.duration > 0 && v.duration < MIN_DURATION;

  const videos = allVideos.filter(v => {
    if (hideShort && isVideoShort(v)) return false;
    if (hideLives && isVideoLive(v)) return false;
    return true;
  });

  const shortCount = allVideos.filter(isVideoShort).length;
  const liveCount = allVideos.filter(isVideoLive).length;

  const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: '24', label: 'Last 24h' },
    { value: '48', label: 'Last 48h' },
    { value: '168', label: 'Last 7 days' },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                range === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-foreground/10 text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideShort} onChange={e => setHideShort(e.target.checked)} className="rounded" />
          Hide Shorts {shortCount > 0 && <span className="text-muted-foreground/50">({shortCount})</span>}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideLives} onChange={e => setHideLives(e.target.checked)} className="rounded" />
          Hide lives {liveCount > 0 && <span className="text-muted-foreground/50">({liveCount})</span>}
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {videos.length} of {allVideos.length} videos
        </span>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading new uploads...</div>
      )}

      {!loading && videos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No new uploads detected in this time range.</p>
          <p className="text-xs mt-1">The monitor checks every hour. Click &quot;Refresh&quot; or wait for the next cron.</p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="space-y-1">
          {videos.map((v) => (
            <div key={v.videoId} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-hover transition-colors">
              {/* Thumbnail */}
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative">
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/default.jpg`}
                  alt=""
                  width={120}
                  height={90}
                  className="w-[100px] h-[56px] object-cover rounded"
                  loading="lazy"
                />
                {v.duration != null && v.duration > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[8px] font-medium rounded">
                    {formatDuration(v.duration)}
                  </span>
                )}
              </a>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:text-emerald-400 transition-colors line-clamp-1"
                  title={v.title}
                >
                  {v.title}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={channelColor(v.channel)}>{v.channel}</Badge>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(v.published)}</span>
                  {v.views > 0 && <span className="text-[10px] text-muted-foreground">{formatNumber(v.views)} views</span>}
                  {v.is_live && <span className="text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400">LIVE</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Manage Channels
// ---------------------------------------------------------------------------

interface MonitoredChannel {
  id: number;
  name: string;
  channelId: string;
  channel_id?: string;
  youtubeUrl: string;
  youtube_url?: string;
  createdAt: string;
  added_at?: string;
}

function ManageChannelsTab() {
  const [channels, setChannels] = useState<MonitoredChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/youtube/channels`);
      if (res.ok) setChannels(await res.json());
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  async function handleAdd() {
    if (!name.trim() || !channelId.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), channel_id: channelId.trim(), youtube_url: url.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setMsg(`${name.trim()} added`);
        setName(''); setChannelId(''); setUrl('');
        fetchChannels();
      }
    } catch { setMsg('Failed to add channel'); }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`${API_URL}/seo/youtube/channels`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: id }),
      });
      setConfirmDelete(null);
      fetchChannels();
    } catch { /* */ }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Loading channels...</div>;
  }

  return (
    <div>
      {/* Add channel form */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add Channel</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="CuteDog"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block mb-1">
              <Tip text="The UC... ID from the channel URL: youtube.com/channel/UC...">Channel ID</Tip>
            </label>
            <input
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="UCkTd_0qajBqsLiVKzERtv1Q"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground block mb-1">YouTube URL (optional)</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/@CuteDog_"
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !name.trim() || !channelId.trim()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        {msg && <div className="text-xs text-emerald-400 mt-2">{msg}</div>}
      </div>

      {/* Channels list */}
      <div className="text-xs text-muted-foreground mb-2">{channels.length} channels monitored</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map(ch => (
          <div key={ch.channelId || ch.channelId || ch.channel_id || ch.name} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge className={channelColor(ch.name)}>{ch.name}</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">{ch.channelId || ch.channel_id}</div>
            </div>
            {confirmDelete === ch.channelId || ch.channel_id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => handleRemove(ch.channelId || ch.channel_id)}
                  className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-2 py-1 text-[10px] bg-surface-hover text-muted-foreground rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(ch.channelId || ch.channel_id)}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
