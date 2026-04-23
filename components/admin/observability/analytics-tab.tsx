"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalyticsStatCard, truncate } from "./analytics-shared";
import type {
  CompareResult,
  CrossSourceKeyword,
  GscKeyword,
  KeywordHistoryPoint,
  PipelineCosts,
  ScanSummary,
} from "./analytics-shared";
import { CrossSourcePanel } from "./cross-source-panel";
import { GscPanel } from "./gsc-panel";
import { KeywordMomentumPanel } from "./keyword-momentum-panel";
import { KeywordTrendPanel } from "./keyword-trend-panel";
import { LlmCostsPanel } from "./llm-costs-panel";

// Extracted from the original /analytics route's analytics-tab. Orchestrates
// the SEO/keyword data fetches and delegates rendering to focused subpanels.

const API_URL = '/api/engine';

export default function AnalyticsTab() {
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [momentumError, setMomentumError] = useState<string | null>(null);
  const [momentumLoading, setMomentumLoading] = useState(true);

  const [trendKeywords, setTrendKeywords] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<Record<string, KeywordHistoryPoint[]>>({});
  const [trendLoading, setTrendLoading] = useState(false);

  const [crossSourceList, setCrossSourceList] = useState<{ keyword: string; sources: string[] }[]>([]);
  const [crossLoading, setCrossLoading] = useState(true);

  const [gscKeywords, setGscKeywords] = useState<GscKeyword[]>([]);
  const [gscTotals, setGscTotals] = useState({ impressions: 0, clicks: 0, avgPos: 0, avgCtr: 0 });
  const [gscLoading, setGscLoading] = useState(true);

  const [costs, setCosts] = useState<PipelineCosts | null>(null);

  // Auto-compare the two most recent YouTube scans to derive momentum.
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

      // Top 5 rising keywords drive the trend-over-time chart below.
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
        } catch { /* skip this keyword */ }
      }),
    );
    setTrendData(results);
    setTrendLoading(false);
  }, []);

  const fetchCrossSource = useCallback(async () => {
    setCrossLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/keywords?limit=500`);
      const keywords: CrossSourceKeyword[] = await res.json();

      const map = new Map<string, Set<string>>();
      for (const kw of keywords) {
        const key = kw.keyword.toLowerCase();
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(kw.source);
      }

      // Only surface keywords that appear across multiple sources; sort by
      // how many sources agree on each keyword.
      const multi = Array.from(map.entries())
        .filter(([, sources]) => sources.size > 1)
        .map(([keyword, sources]) => ({ keyword, sources: Array.from(sources) }))
        .sort((a, b) => b.sources.length - a.sources.length)
        .slice(0, 30);
      setCrossSourceList(multi);
    } catch { /* ignore */ }
    setCrossLoading(false);
  }, []);

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

  const biggestRiser = compare?.rising?.[0];
  const newCount = compare?.newKeywords?.length ?? 0;
  const decliningCount = compare?.declining?.length ?? 0;
  const totalTracked = scans[0]?._count?.keywords ?? 0;

  return (
    <div className="max-w-[1800px] space-y-8 mt-4">
      {/* Top Movers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsStatCard
          label="Biggest Riser"
          value={biggestRiser ? truncate(biggestRiser.keyword, 20) : '--'}
          sub={biggestRiser ? `+${biggestRiser.delta.toFixed(0)} pts` : ''}
          color="text-emerald-400"
        />
        <AnalyticsStatCard
          label="New Keywords"
          value={String(newCount)}
          sub="since last scan"
          color="text-blue-400"
        />
        <AnalyticsStatCard
          label="Declining"
          value={String(decliningCount)}
          sub="lost momentum"
          color="text-red-400"
        />
        <AnalyticsStatCard
          label="Total Tracked"
          value={String(totalTracked)}
          sub="in latest scan"
          color="text-foreground"
        />
      </div>

      <KeywordMomentumPanel compare={compare} loading={momentumLoading} error={momentumError} />

      <KeywordTrendPanel
        trendKeywords={trendKeywords}
        trendData={trendData}
        loading={trendLoading}
      />

      <GscPanel keywords={gscKeywords} totals={gscTotals} loading={gscLoading} />

      <LlmCostsPanel costs={costs} />

      <CrossSourcePanel items={crossSourceList} loading={crossLoading} />
    </div>
  );
}
