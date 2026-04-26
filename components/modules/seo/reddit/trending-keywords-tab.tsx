'use client';

// ---------------------------------------------------------------------------
// TrendingKeywordsTab — replaces the legacy "Trending Topics" tab.
//
// Session 36: instead of computing flair-based topic clusters from the
// post list, this tab queries the engine for KeywordOpportunity rows
// sourced from Reddit (populated by RedditKeywordExtractorService after
// the universal LLM relevance gate). The result is the actual keyword
// research surface seeded by Reddit demand, not loose "trending phrases".
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { formatNumber } from './helpers';

const API_URL = '/api/engine';

interface RedditKeyword {
  id: number;
  keyword: string;
  intent: string | null;
  cluster: string | null;
  trendingScore: number | null;
  wordCount: number | null;
  isLongTail: boolean | null;
  game: string | null;
  strikingOpportunity: number | null;
  consolidatedScore: number | null;
  predictedClicks30d: number | null;
}

export function TrendingKeywordsTab() {
  const [keywords, setKeywords] = useState<RedditKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          source: 'reddit',
          sortBy: 'trendingScore',
          sortDir: 'desc',
          limit: '100',
          withSignals: 'true',
        });
        const res = await fetch(`${API_URL}/seo/keywords?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RedditKeyword[];
        if (!cancelled) setKeywords(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading Reddit keywords…</div>;
  }
  if (error) {
    return <div className="text-center py-12 text-red-400">Failed to load: {error}</div>;
  }
  if (keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No Reddit keywords yet. Run a Reddit scan to populate.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="py-2 pr-3">Keyword</th>
            <th className="py-2 pr-3">Intent</th>
            <th className="py-2 pr-3">Cluster</th>
            <th className="py-2 pr-3">Game</th>
            <th className="py-2 pr-3 text-right">Trending</th>
            <th className="py-2 pr-3 text-right">Striking</th>
            <th className="py-2 pr-3 text-right">Consol</th>
            <th className="py-2 pr-3 text-right">Clicks30D</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((kw) => (
            <tr key={kw.id} className="border-b border-border/50 hover:bg-white/[0.02]">
              <td className="py-2 pr-3 text-foreground">
                {kw.keyword}
                {kw.isLongTail && (
                  <span className="ml-1.5 text-[9px] text-orange-400/70 uppercase">LT</span>
                )}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">{kw.intent ?? '—'}</td>
              <td className="py-2 pr-3 text-muted-foreground">{kw.cluster ?? '—'}</td>
              <td className="py-2 pr-3 text-muted-foreground">{kw.game ?? '—'}</td>
              <td className="py-2 pr-3 text-right font-mono text-foreground">
                {kw.trendingScore != null ? formatNumber(Math.round(kw.trendingScore)) : '—'}
              </td>
              <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                {kw.strikingOpportunity != null
                  ? formatNumber(Math.round(kw.strikingOpportunity))
                  : '—'}
              </td>
              <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                {kw.consolidatedScore != null
                  ? formatNumber(Math.round(kw.consolidatedScore))
                  : '—'}
              </td>
              <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                {kw.predictedClicks30d != null ? formatNumber(kw.predictedClicks30d) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
