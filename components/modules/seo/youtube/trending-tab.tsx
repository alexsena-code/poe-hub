'use client';

// ---------------------------------------------------------------------------
// TrendingTab — aggregated keywords across all scans, with expandable rows
// ---------------------------------------------------------------------------

import React, { useState, useEffect } from 'react';
import { useSort, SortHeader, Tip, YtBadge } from './primitives';
import { scoreColor, channelColor, formatNumber } from './helpers';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import type { AggregatedKeyword, AggregatedKeywordsResponse, Video } from './types';

const API_URL = '/api/engine';

// S05.b — migrated from hardcoded hues to StatusBadgeVariant.
// "new" uses info (blue) since there's no purple token; purple was non-semantic.
const MOMENTUM_STYLE: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  rising:   { label: 'Rising',    variant: 'success' },
  stable:   { label: 'Stable',    variant: 'info' },
  declining:{ label: 'Declining', variant: 'danger' },
  new:      { label: 'New',       variant: 'neutral' },
};

// ---------------------------------------------------------------------------
// ExpandableVideoList — collapsible video list inside a keyword detail row
// ---------------------------------------------------------------------------

function ExpandableVideoList({ videos }: { videos: Video[] }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 5;
  const visible = showAll ? videos : videos.slice(0, INITIAL);

  if (videos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No exact title matches — keyword was extracted from n-grams.
      </p>
    );
  }

  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        Videos ({videos.length})
      </div>
      {visible.map((v) => (
        <div key={v.id} className="py-1 flex justify-between items-center">
          <a
            href={v.url}
            target="_blank"
            rel="noopener"
            className="text-sm text-foreground hover:text-emerald-400 hover:underline"
          >
            {v.title}
          </a>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {v.channel} {v.views > 0 && `· ${formatNumber(v.views)}`}
          </span>
        </div>
      ))}
      {videos.length > INITIAL && (
        <div className="text-center mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(!showAll);
            }}
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
// KeywordDetailRow — expanded detail panel for a selected keyword
// ---------------------------------------------------------------------------

function KeywordDetailRow({ kw }: { kw: AggregatedKeyword }) {
  return (
    <tr className="bg-foreground/[0.03] border-b border-border">
      <td colSpan={8} className="px-4 py-3">
        <div className="grid grid-cols-5 gap-3 mb-3">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              <Tip text="Peak trending score">Max Score</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">
              {kw.max_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              <Tip text="Average trending score across scans">Avg Score</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">
              {kw.avg_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              <Tip text="Total videos mentioning this topic">Videos</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{kw.video_count}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              <Tip text="Total views across all videos">Total Views</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{formatNumber(kw.total_views)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              <Tip text="Appeared in N different scans">Scans</Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{kw.scan_count}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
          <span>First seen: {new Date(kw.first_seen).toLocaleDateString()}</span>
          <span>Last seen: {new Date(kw.last_seen).toLocaleDateString()}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {kw.channels.map((ch) => (
            <YtBadge key={ch} className={channelColor(ch)}>{ch}</YtBadge>
          ))}
        </div>
        {kw.score_history.length > 1 && (
          <div className="mt-2">
            <div className="text-xs text-muted-foreground mb-1">Score History</div>
            <div className="flex items-end gap-1 h-12">
              {kw.score_history.map((h, idx) => {
                const maxH = Math.max(...kw.score_history.map((s) => s.score));
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
  );
}

// ---------------------------------------------------------------------------
// TrendingTab — main export
// ---------------------------------------------------------------------------

interface Props {
  minMentions: number;
}

export function TrendingTab({ minMentions }: Props) {
  const [aggData, setAggData] = useState<AggregatedKeywordsResponse | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    fetchAggregated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMentions]);

  async function fetchAggregated() {
    setAggLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/seo/youtube/trending-keywords?limit=500&minMentions=${minMentions}`,
      );
      if (res.ok) {
        const result = await res.json();
        if (!result.error) setAggData(result);
      }
    } catch { /* API offline */ }
    setAggLoading(false);
  }

  const { sorted, sortKey, sortDir, toggle } = useSort<AggregatedKeyword>(
    aggData?.keywords ?? [],
    'max_trending_score',
    'desc',
  );
  const visible = sorted.slice(0, displayLimit);
  const hasMore = sorted.length > displayLimit;

  if (aggLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Loading trending keywords...</p>
      </div>
    );
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
            {aggData.totalUniqueKeywords} keywords across {aggData.totalScans} scan
            {aggData.totalScans !== 1 ? 's' : ''}
            {minMentions > 1 && ` (min ${minMentions}+ mentions)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Show:</span>
          {[50, 100, 200].map((n) => (
            <button
              key={n}
              onClick={() => setDisplayLimit(n)}
              className={`px-2 py-0.5 text-xs rounded ${
                displayLimit === n
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-hover text-muted-foreground hover:text-foreground'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setDisplayLimit(sorted.length)}
            className={`px-2 py-0.5 text-xs rounded ${
              displayLimit >= sorted.length
                ? 'bg-emerald-600 text-white'
                : 'bg-surface-hover text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="pb-2 pr-3 w-8">#</th>
            <SortHeader
              label="Keyword"
              active={sortKey === 'keyword'}
              dir={sortKey === 'keyword' ? sortDir : null}
              onToggle={() => toggle('keyword')}
              className="pb-2 pr-3"
              tip="Trending topic extracted from video titles"
            />
            <SortHeader
              label="Score"
              active={sortKey === 'max_trending_score'}
              dir={sortKey === 'max_trending_score' ? sortDir : null}
              onToggle={() => toggle('max_trending_score')}
              className="pb-2 pr-3 text-right"
              tip="Peak trending score across all scans"
            />
            <SortHeader
              label="Videos"
              active={sortKey === 'video_count'}
              dir={sortKey === 'video_count' ? sortDir : null}
              onToggle={() => toggle('video_count')}
              className="pb-2 pr-3 text-right"
              tip="Total videos mentioning this topic"
            />
            <SortHeader
              label="Views"
              active={sortKey === 'total_views'}
              dir={sortKey === 'total_views' ? sortDir : null}
              onToggle={() => toggle('total_views')}
              className="pb-2 pr-3 text-right"
              tip="Total views across all videos"
            />
            <SortHeader
              label="Mentions"
              active={sortKey === 'total_mentions'}
              dir={sortKey === 'total_mentions' ? sortDir : null}
              onToggle={() => toggle('total_mentions')}
              className="pb-2 pr-3 text-right"
              tip="Number of scans where this keyword appeared"
            />
            <th className="pb-2 pr-3">
              <Tip text="Trend direction: Rising (score increasing), Stable, Declining, or New (first scan)">
                Trend
              </Tip>
            </th>
            <SortHeader
              label="Channels"
              active={sortKey === 'channel_count'}
              dir={sortKey === 'channel_count' ? sortDir : null}
              onToggle={() => toggle('channel_count')}
              className="pb-2 pr-3 text-right"
              tip="Unique creators covering this topic"
            />
          </tr>
        </thead>
        <tbody>
          {visible.map((kw, i) => (
            <React.Fragment key={kw.keyword}>
              <tr
                className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${
                  expanded === kw.keyword ? 'bg-foreground/5 border-border' : ''
                }`}
                onClick={() => setExpanded(expanded === kw.keyword ? null : kw.keyword)}
              >
                <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-foreground hover:text-emerald-400">
                  {kw.keyword}
                  {kw.from_transcript && (
                    <span className="ml-1.5 text-[8px] text-purple-400 opacity-70" title="From transcript">
                      T
                    </span>
                  )}
                  {kw.confirmed && (
                    <span className="ml-1 text-[8px] text-emerald-400 opacity-70" title="Confirmed by regex + AI">
                      C
                    </span>
                  )}
                  {(kw.qdrant_relevance ?? 0) > 0.3 && (
                    <span
                      className="ml-1 text-[8px] text-sky-400 opacity-70"
                      title={`Qdrant: ${kw.qdrant_relevance?.toFixed(2)}`}
                    >
                      Q
                    </span>
                  )}
                  {kw.pg_match && (
                    <span className="ml-1 text-[8px] text-amber-400 opacity-70" title={`DB match: ${kw.pg_type}`}>
                      PG
                    </span>
                  )}
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.max_trending_score)}`}>
                  {kw.max_trending_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.video_count}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                  {formatNumber(kw.total_views)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.total_mentions}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-1">
                    {kw.momentum.map((tag) => {
                      const style = MOMENTUM_STYLE[tag] ?? MOMENTUM_STYLE.new;
                      return (
                        <StatusBadge key={tag} variant={style.variant}>
                          {style.label}
                        </StatusBadge>
                      );
                    })}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kw.channel_count}</td>
              </tr>
              {expanded === kw.keyword && <KeywordDetailRow kw={kw} />}
            </React.Fragment>
          ))}
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
        <p className="text-center py-8 text-muted-foreground text-sm">
          No trending keywords found. Run a Smart Scan first.
        </p>
      )}
    </div>
  );
}
