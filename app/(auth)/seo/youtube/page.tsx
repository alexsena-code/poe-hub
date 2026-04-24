'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { ScanProgress } from '@/components/modules/seo/youtube/scan-progress';
import { TrendingTab } from '@/components/modules/seo/youtube/trending-tab';
import { TopVideosTab } from '@/components/modules/seo/youtube/top-videos-tab';
import { ChannelsTab } from '@/components/modules/seo/youtube/channels-tab';
import { VideosTab } from '@/components/modules/seo/youtube/videos-tab';
import { NewUploadsTab } from '@/components/modules/seo/youtube/new-uploads-tab';
import { DbKeywordsTab } from '@/components/modules/seo/youtube/db-keywords-tab';
import { ScanHistoryTab } from '@/components/modules/seo/youtube/scan-history-tab';
import { ManageChannelsTab } from '@/components/modules/seo/youtube/manage-channels-tab';
import { Tip } from '@/components/modules/seo/youtube/primitives';
import type { YouTubeTrendsData, KeywordOpportunity, Tab } from '@/components/modules/seo/youtube/types';

const API_URL = '/api/engine';

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

export default function YouTubeTrendsPage() {
  const [tab, setTab] = useState<Tab>('trending');
  const [data, setData] = useState<YouTubeTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filter dropdown (shown inline above tab bar)
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
          setImportResult(
            `Scanned ${result.channels_checked} channels: ${result.poe_videos} PoE videos, ${result.trending_keywords?.length ?? 0} trending keywords`,
          );
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
  // Fetch DB keywords (YouTube source) — only when db-keywords tab is active
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
        setImportResult(
          `Imported ${result.imported ?? 0} keywords, skipped ${result.skipped ?? 0}`,
        );
      } else {
        setImportResult('Import failed: ' + (await res.text()));
      }
    } catch {
      setImportResult('Failed to connect to API');
    }
    setImportLoading(false);
  }

  function runSmartScan() {
    setScanning(true);
    setImportResult(null);
    setScanLogs([]);
    setScanStep('start');
    fetch(`${API_URL}/seo/youtube/smart-scan-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    })
      .then(async (res) => {
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
                if (currentEvent === 'log') {
                  setScanLogs((prev) => [...prev, payload]);
                  setScanStep(payload.step);
                } else if (currentEvent === 'result') {
                  setData(payload);
                  setImportResult(
                    `Smart scan: ${payload.poe_videos} PoE videos, ${payload.trending_keywords?.length ?? 0} keywords`,
                  );
                } else if (currentEvent === 'error') {
                  setImportResult(`Error: ${payload.message}`);
                }
              } catch { /* malformed SSE chunk — ignore */ }
            }
          }
        }
        setScanStep(null);
        setScanning(false);
      })
      .catch(() => {
        setImportResult('Smart scan failed');
        setScanStep(null);
        setScanning(false);
      });
  }

  // ---------------------------------------------------------------------------
  // Derived stats for the top bar
  // ---------------------------------------------------------------------------

  const channelsMonitored = data?.channels_checked ?? data?.active_channels?.length ?? '-';
  const videosAnalyzed = data?.total_videos ?? '-';
  const poeVideos = data?.poe_videos ?? '-';
  const trendingCount = data?.trending_keywords?.length ?? '-';

  // ---------------------------------------------------------------------------
  // Filter dropdown state
  // ---------------------------------------------------------------------------

  const hasActiveFilters =
    (tab === 'trending' && minMentions !== 1) ||
    (tab === 'top-videos' && (!hideLives || !hideShorts));
  const hasFiltersForTab = tab === 'trending' || tab === 'top-videos';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        <PageHeader
          title="YouTube Trends"
          description="Monitor PoE content creators and discover trending topics"
          accent="var(--color-seo)"
          className="mb-4"
        />

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                <Tip text="Number of PoE content creators being tracked by the scanner">Channels</Tip>
              </div>
              <div className="text-lg font-bold text-foreground">{channelsMonitored}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                <Tip text="Total videos checked across all monitored channels in the last 30 days">
                  Videos Analyzed
                </Tip>
              </div>
              <div className="text-lg font-bold text-foreground">{videosAnalyzed}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                <Tip text="Videos that matched PoE keywords in title or tags">PoE Videos</Tip>
              </div>
              <div className="text-lg font-bold text-foreground">{poeVideos}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                <Tip text="Unique keywords across all scans — aggregated with momentum tracking (rising/stable/declining)">
                  Trending KW
                </Tip>
              </div>
              <div className="text-lg font-bold text-foreground">{trendingCount}</div>
            </div>
          </div>
          <div />
        </div>

        {importResult && <div className="text-xs text-emerald-400 mb-2">{importResult}</div>}

        {/* Smart Scan streaming progress */}
        {scanLogs.length > 0 && (
          <ScanProgress step={scanStep} logs={scanLogs} running={scanning} />
        )}

        {loading && !data && (
          <div className="text-center py-8 text-muted-foreground">
            Loading latest scan data...
          </div>
        )}

        {/* Tab bar + filter icon + action buttons */}
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
                  onClick={() => setShowFilters((f) => !f)}
                  className={`p-1.5 rounded transition-colors ${
                    hasActiveFilters
                      ? 'bg-foreground/15 text-foreground'
                      : 'bg-foreground/5 text-muted-foreground hover:text-foreground'
                  }`}
                  title="Filters"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                </button>
                {showFilters && (
                  <div className="absolute top-full right-0 mt-2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[240px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-foreground">Filters</span>
                      {hasActiveFilters && (
                        <button
                          onClick={() => {
                            if (tab === 'trending') setMinMentions(1);
                            if (tab === 'top-videos') {
                              setHideLives(true);
                              setHideShorts(true);
                            }
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
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                            Min Mentions
                          </label>
                          <div className="flex gap-1">
                            {[1, 2, 3].map((n) => (
                              <button
                                key={n}
                                onClick={() => setMinMentions(n)}
                                className={`px-2 py-1 text-xs rounded ${
                                  minMentions === n
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                                }`}
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
                            <input
                              type="checkbox"
                              checked={hideLives}
                              onChange={(e) => setHideLives(e.target.checked)}
                              className="rounded border-border"
                            />
                            Hide livestreams/VODs
                          </label>
                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={hideShorts}
                              onChange={(e) => setHideShorts(e.target.checked)}
                              className="rounded border-border"
                            />
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
              onClick={runSmartScan}
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
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {tab === 'trending' && <TrendingTab minMentions={minMentions} />}
        {tab === 'top-videos' && (
          <TopVideosTab latestData={data} hideLives={hideLives} hideShorts={hideShorts} />
        )}
        {tab === 'channels' && (
          <ChannelsTab data={data} allKeywords={data?.trending_keywords ?? []} />
        )}
        {tab === 'videos' && <VideosTab data={data} />}
        {tab === 'new-uploads' && <NewUploadsTab />}
        {tab === 'db-keywords' && <DbKeywordsTab keywords={dbKeywords} loading={dbLoading} />}
        {tab === 'scan-history' && <ScanHistoryTab />}
        {tab === 'manage-channels' && <ManageChannelsTab />}
      </div>
    </div>
  );
}
