'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';

const API_URL = '/api/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MomentumItem {
  keyword: string;
  delta: number;
  score: number;
  prevScore: number;
}

interface NewKeyword {
  keyword: string;
  score: number;
  views?: number;
}

interface CompareResult {
  rising: MomentumItem[];
  declining: MomentumItem[];
  newKeywords: NewKeyword[];
}

interface ScanSummary {
  id: number;
  scanType: string;
  createdAt: string;
  _count?: { keywords: number; videos: number };
}

interface KeywordHistoryPoint {
  scanId: number;
  scanDate: string;
  score: number;
}

interface CrossSourceKeyword {
  keyword: string;
  source: string;
  trendingScore?: number | null;
  viceScore?: number | null;
  youtubeViews?: number | null;
}

interface GscKeyword {
  keyword: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  viceScore: number | null;
}

interface PipelineCosts {
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byDay: Record<string, { calls: number; costUsd: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, len: number) {
  return s.length > len ? s.slice(0, len) + '...' : s;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsTab() {
  // Momentum state
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [momentumError, setMomentumError] = useState<string | null>(null);
  const [momentumLoading, setMomentumLoading] = useState(true);

  // Keyword trend state
  const [trendKeywords, setTrendKeywords] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<Record<string, KeywordHistoryPoint[]>>({});
  const [trendLoading, setTrendLoading] = useState(false);

  // Cross-source state
  const [crossSource, setCrossSource] = useState<Map<string, Set<string>>>(new Map());
  const [crossSourceList, setCrossSourceList] = useState<{ keyword: string; sources: string[] }[]>([]);
  const [crossLoading, setCrossLoading] = useState(true);

  // GSC state
  const [gscKeywords, setGscKeywords] = useState<GscKeyword[]>([]);
  const [gscTotals, setGscTotals] = useState({ impressions: 0, clicks: 0, avgPos: 0, avgCtr: 0 });
  const [gscLoading, setGscLoading] = useState(true);

  // LLM costs state
  const [costs, setCosts] = useState<PipelineCosts | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch momentum (auto-compare last 2 scans)
  // ---------------------------------------------------------------------------

  const fetchMomentum = useCallback(async () => {
    setMomentumLoading(true);
    setMomentumError(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/scans?limit=10`);
      const scanList: ScanSummary[] = await res.json();
      setScans(scanList);

      if (scanList.length < 2) {
        setMomentumError('Need 2+ scans to show momentum. Run another Smart Scan.');
        setMomentumLoading(false);
        return;
      }

      const scan2 = scanList[0]; // latest
      const scan1 = scanList[1]; // previous
      const cmpRes = await fetch(
        `${API_URL}/seo/youtube/compare?scan1=${scan1.id}&scan2=${scan2.id}`,
      );
      const data: CompareResult = await cmpRes.json();
      setCompare(data);

      // Determine top 5 keywords for trend chart
      const topKws = data.rising
        .slice(0, 5)
        .map((r) => r.keyword);
      setTrendKeywords(topKws);
    } catch (e) {
      setMomentumError(`Failed to load: ${(e as Error).message}`);
    } finally {
      setMomentumLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch keyword trend history
  // ---------------------------------------------------------------------------

  const fetchTrends = useCallback(async (keywords: string[]) => {
    if (!keywords.length) return;
    setTrendLoading(true);
    const results: Record<string, KeywordHistoryPoint[]> = {};
    await Promise.all(
      keywords.map(async (kw) => {
        try {
          const res = await fetch(
            `${API_URL}/seo/youtube/keyword-history?keyword=${encodeURIComponent(kw)}`,
          );
          if (res.ok) {
            results[kw] = await res.json();
          }
        } catch { /* skip */ }
      }),
    );
    setTrendData(results);
    setTrendLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch cross-source keywords
  // ---------------------------------------------------------------------------

  const fetchCrossSource = useCallback(async () => {
    setCrossLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/keywords?limit=500`);
      const keywords: CrossSourceKeyword[] = await res.json();

      // Group by keyword, collect sources
      const map = new Map<string, Set<string>>();
      for (const kw of keywords) {
        const key = kw.keyword.toLowerCase();
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(kw.source);
      }
      setCrossSource(map);

      // Filter to multi-source only, sort by source count
      const multi = Array.from(map.entries())
        .filter(([, sources]) => sources.size > 1)
        .map(([keyword, sources]) => ({ keyword, sources: Array.from(sources) }))
        .sort((a, b) => b.sources.length - a.sources.length)
        .slice(0, 30);
      setCrossSourceList(multi);
    } catch { /* ignore */ }
    setCrossLoading(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  const fetchGsc = useCallback(async () => {
    setGscLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/keywords?source=gsc&limit=200&sortBy=impressions&sortDir=desc`);
      const keywords: GscKeyword[] = await res.json();
      const withData = keywords.filter((k) => k.impressions && k.impressions > 0);
      setGscKeywords(withData.slice(0, 30));
      const totalImpr = withData.reduce((s, k) => s + (k.impressions || 0), 0);
      const totalClicks = withData.reduce((s, k) => s + (k.clicks || 0), 0);
      const avgPos = withData.length > 0
        ? withData.reduce((s, k) => s + (k.position || 0), 0) / withData.length
        : 0;
      setGscTotals({
        impressions: totalImpr,
        clicks: totalClicks,
        avgPos: Math.round(avgPos * 10) / 10,
        avgCtr: totalImpr > 0 ? Math.round((totalClicks / totalImpr) * 10000) / 100 : 0,
      });
    } catch { /* ignore */ }
    setGscLoading(false);
  }, []);

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/pipeline/costs?days=30`);
      setCosts(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMomentum();
    fetchCrossSource();
    fetchGsc();
    fetchCosts();
  }, [fetchMomentum, fetchCrossSource, fetchGsc, fetchCosts]);

  useEffect(() => {
    if (trendKeywords.length > 0) {
      fetchTrends(trendKeywords);
    }
  }, [trendKeywords, fetchTrends]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const risingChartData = (compare?.rising ?? []).slice(0, 15).map((r) => ({
    keyword: truncate(r.keyword, 18),
    delta: r.delta,
  }));

  const decliningChartData = (compare?.declining ?? []).slice(0, 10).map((d) => ({
    keyword: truncate(d.keyword, 18),
    delta: Math.abs(d.delta),
  }));

  // Build line chart data: pivot scan dates as x-axis
  const lineChartData = (() => {
    const allDates = new Set<string>();
    for (const pts of Object.values(trendData)) {
      for (const p of pts) allDates.add(p.scanDate);
    }
    const sorted = Array.from(allDates).sort();
    return sorted.map((date) => {
      const row: Record<string, any> = { date: date.slice(0, 10) };
      for (const kw of trendKeywords) {
        const pt = trendData[kw]?.find((p) => p.scanDate === date);
        row[kw] = pt?.score ?? null;
      }
      return row;
    });
  })();

  const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Stat cards
  const biggestRiser = compare?.rising?.[0];
  const newCount = compare?.newKeywords?.length ?? 0;
  const decliningCount = compare?.declining?.length ?? 0;
  const totalTracked = scans[0]?._count?.keywords ?? 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-[1800px] space-y-8 mt-4">
      <div>
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
        </p>
      </div>
      </div>

      {/* Top Movers — stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Biggest Riser"
          value={biggestRiser ? truncate(biggestRiser.keyword, 20) : '--'}
          sub={biggestRiser ? `+${biggestRiser.delta.toFixed(0)} pts` : ''}
          color="text-emerald-400"
        />
        <StatCard
          label="New Keywords"
          value={String(newCount)}
          sub="since last scan"
          color="text-blue-400"
        />
        <StatCard
          label="Declining"
          value={String(decliningCount)}
          sub="lost momentum"
          color="text-red-400"
        />
        <StatCard
          label="Total Tracked"
          value={String(totalTracked)}
          sub="in latest scan"
          color="text-foreground"
        />
      </div>

      {/* Keyword Momentum */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Keyword Momentum
        </h2>
        {momentumLoading ? (
          <p className="text-muted-foreground text-sm">Loading scans...</p>
        ) : momentumError ? (
          <p className="text-amber-400 text-sm">{momentumError}</p>
        ) : (
          <div className="space-y-6">
            {/* Rising */}
            {risingChartData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-emerald-400 mb-2">
                  Rising ({compare!.rising.length} total)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={risingChartData} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#666" />
                    <YAxis
                      type="category"
                      dataKey="keyword"
                      tick={{ fill: '#aaa', fontSize: 12 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
                    />
                    <Bar dataKey="delta" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Declining */}
            {decliningChartData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">
                  Declining ({compare!.declining.length} total)
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={decliningChartData} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#666" />
                    <YAxis
                      type="category"
                      dataKey="keyword"
                      tick={{ fill: '#aaa', fontSize: 12 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
                    />
                    <Bar dataKey="delta" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* New keywords */}
            {(compare?.newKeywords?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-sm font-medium text-blue-400 mb-2">
                  New Keywords ({compare!.newKeywords.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {compare!.newKeywords.slice(0, 20).map((nk) => (
                    <span
                      key={nk.keyword}
                      className="px-2 py-1 text-xs rounded bg-blue-900/30 text-blue-300 border border-blue-800/40"
                    >
                      {nk.keyword}{' '}
                      <span className="text-blue-500">({nk.score.toFixed(0)})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Keyword Trend Over Time */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Keyword Trend Over Time
        </h2>
        {trendLoading ? (
          <p className="text-muted-foreground text-sm">Loading trend data...</p>
        ) : lineChartData.length < 2 ? (
          <p className="text-muted-foreground text-sm">
            Need 2+ scans with keyword history to chart trends.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11, fill: '#aaa' }} />
              <YAxis stroke="#666" tick={{ fontSize: 11, fill: '#aaa' }} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
              {trendKeywords.map((kw, i) => (
                <Line
                  key={kw}
                  type="monotone"
                  dataKey={kw}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* GSC Performance */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Google Search Console
        </h2>
        {gscLoading ? (
          <p className="text-muted-foreground text-sm">Loading GSC data...</p>
        ) : gscKeywords.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No GSC data yet. Sync via /dashboard/config &rarr; Pipelines &rarr; GSC Sync.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard label="Impressions" value={gscTotals.impressions.toLocaleString()} sub="28 days" color="text-foreground" />
              <StatCard label="Clicks" value={gscTotals.clicks.toLocaleString()} sub="28 days" color="text-emerald-400" />
              <StatCard label="Avg CTR" value={`${gscTotals.avgCtr}%`} sub="across queries" color="text-blue-400" />
              <StatCard label="Avg Position" value={String(gscTotals.avgPos)} sub="across queries" color="text-amber-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Query</th>
                    <th className="pb-2 text-right pr-4">Impressions</th>
                    <th className="pb-2 text-right pr-4">Clicks</th>
                    <th className="pb-2 text-right pr-4">CTR</th>
                    <th className="pb-2 text-right pr-4">Position</th>
                    <th className="pb-2 text-right">VICE</th>
                  </tr>
                </thead>
                <tbody>
                  {gscKeywords.map((kw) => (
                    <tr key={kw.keyword} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-2 pr-4 text-foreground">{truncate(kw.keyword, 40)}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{kw.impressions?.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right text-emerald-400">{kw.clicks}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{kw.ctr ? `${(kw.ctr * 100).toFixed(1)}%` : '-'}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{kw.position?.toFixed(1)}</td>
                      <td className="py-2 text-right text-accent">{kw.viceScore?.toFixed(0) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* LLM Costs (30d) */}
      {costs && (
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            LLM Costs (30 days)
          </h2>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatCard label="Total Calls" value={String(costs.total.calls)} sub="30 days" color="text-foreground" />
            <StatCard label="Input Tokens" value={costs.total.inputTokens.toLocaleString()} sub="" color="text-muted-foreground" />
            <StatCard label="Output Tokens" value={costs.total.outputTokens.toLocaleString()} sub="" color="text-muted-foreground" />
            <StatCard label="Total Cost" value={`$${costs.total.costUsd.toFixed(4)}`} sub="USD" color="text-accent" />
          </div>
          {Object.keys(costs.byDay).length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(costs.byDay).sort().slice(-14).map(([day, v]) => ({ day: day.slice(5), calls: v.calls, cost: v.costUsd }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 10, fill: '#aaa' }} />
                <YAxis stroke="#666" tick={{ fontSize: 10, fill: '#aaa' }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#eee' }} />
                <Bar dataKey="calls" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      {/* Cross-Source Overview */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Cross-Source Keywords
        </h2>
        {crossLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : crossSourceList.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No keywords found in multiple sources yet. Run scans across YouTube, Reddit, and GSC.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4">Keyword</th>
                  <th className="pb-2">Sources</th>
                </tr>
              </thead>
              <tbody>
                {crossSourceList.map((item) => (
                  <tr
                    key={item.keyword}
                    className="border-b border-border/50 hover:bg-surface-hover"
                  >
                    <td className="py-2 pr-4 text-foreground">{item.keyword}</td>
                    <td className="py-2">
                      <div className="flex gap-1.5">
                        {item.sources.map((src) => (
                          <SourceBadge key={src} source={src} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold ${color} truncate`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const s = source.toLowerCase();
  let label = source;
  let classes = 'bg-gray-800 text-gray-300';

  if (s.includes('youtube') || s === 'yt') {
    label = 'YT';
    classes = 'bg-red-900/40 text-red-300';
  } else if (s.includes('reddit')) {
    label = 'Reddit';
    classes = 'bg-orange-900/40 text-orange-300';
  } else if (s.includes('gsc') || s.includes('google')) {
    label = 'GSC';
    classes = 'bg-blue-900/40 text-blue-300';
  } else if (s.includes('suggest')) {
    label = 'Suggest';
    classes = 'bg-purple-900/40 text-purple-300';
  }

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${classes}`}>
      {label}
    </span>
  );
}
