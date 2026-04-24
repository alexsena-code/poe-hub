'use client';

// ---------------------------------------------------------------------------
// TopVideosTab — top videos by views with scan selector + filters
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useSort, SortHeader, YtBadge } from './primitives';
import { channelColor, formatNumber, formatDuration, timeAgo } from './helpers';
import type { Video, YouTubeTrendsData } from './types';

const API_URL = '/api/engine';

const LIVE_RE = /\[LIVE\]|\(LIVE\)|Livestream|![a-z]+\s+![a-z]+/i;

interface Props {
  latestData: YouTubeTrendsData | null;
  hideLives: boolean;
  hideShorts: boolean;
}

export function TopVideosTab({ latestData, hideLives, hideShorts }: Props) {
  const [scans, setScans] = useState<Array<{ id: number; totalVideos: number; createdAt: string }>>([]);
  const [selectedScan, setSelectedScan] = useState<string>('latest');
  const [scanData, setScanData] = useState<YouTubeTrendsData | null>(null);

  // Fetch scan list on mount
  useEffect(() => {
    fetch(`${API_URL}/seo/youtube/scans`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setScans(data); })
      .catch(() => {});
  }, []);

  // Fetch scan data when selection changes
  useEffect(() => {
    if (selectedScan === 'latest') {
      setScanData(null); // use latestData prop
      return;
    }
    if (selectedScan === 'all') {
      // Merge videos from all scans (fetch each and combine)
      Promise.all(
        scans.map((s) =>
          fetch(`${API_URL}/seo/youtube/scans/${s.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      ).then((results) => {
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
      return;
    }
    fetch(`${API_URL}/seo/youtube/scans/${selectedScan}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !data.error) setScanData(data); })
      .catch(() => {});
  }, [selectedScan, scans]);

  const data = selectedScan === 'latest' ? latestData : scanData;

  const filtered = (data?.videos ?? []).filter((v) => {
    if (hideLives && (v.is_live || LIVE_RE.test(v.title))) return false;
    if (hideShorts && (v.is_short || (v.duration && v.duration > 0 && v.duration < 120))) return false;
    return true;
  });
  const { sorted, sortKey, sortDir, toggle } = useSort<Video>(filtered, 'views', 'desc');

  if (!data || !data.videos) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">
          {selectedScan !== 'latest' && selectedScan !== 'all'
            ? 'Loading scan...'
            : 'No data yet. Run a scan first.'}
        </p>
      </div>
    );
  }

  const allVids = data?.videos ?? [];
  const liveCount = allVids.filter((v) => v.is_live || LIVE_RE.test(v.title)).length;
  const shortCount = allVids.filter(
    (v) => v.is_short || (v.duration && v.duration > 0 && v.duration < 120),
  ).length;
  const totalViews = filtered.reduce((sum, v) => sum + (v.views || 0), 0);

  return (
    <div>
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Views</div>
          <div className="text-2xl font-bold text-foreground">{formatNumber(totalViews)}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">PoE Videos</div>
          <div className="text-2xl font-bold text-foreground">{data?.poe_videos ?? allVids.length}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Views</div>
          <div className="text-2xl font-bold text-foreground">
            {formatNumber(Math.round(totalViews / (allVids.length || 1)))}
          </div>
        </div>
      </div>

      {/* Scan selector */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Scan:</span>
          <select
            value={selectedScan}
            onChange={(e) => setSelectedScan(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-foreground"
          >
            <option value="latest">Latest scan</option>
            <option value="all">All scans</option>
            {scans.map((s) => (
              <option key={s.id} value={String(s.id)}>
                #{s.id} — {s.totalVideos} videos (
                {new Date(s.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                )
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {sorted.length} videos
          {liveCount > 0 && hideLives && (
            <span className="text-muted-foreground/50"> ({liveCount} lives hidden)</span>
          )}
          {shortCount > 0 && hideShorts && (
            <span className="text-muted-foreground/50"> ({shortCount} shorts hidden)</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-2 pr-3 w-8">#</th>
              <SortHeader
                label="Title"
                active={sortKey === 'title'}
                dir={sortKey === 'title' ? sortDir : null}
                onToggle={() => toggle('title')}
                className="pb-2 pr-3"
              />
              <SortHeader
                label="Channel"
                active={sortKey === 'channel'}
                dir={sortKey === 'channel' ? sortDir : null}
                onToggle={() => toggle('channel')}
                className="pb-2 pr-3"
              />
              <SortHeader
                label="Views"
                active={sortKey === 'views'}
                dir={sortKey === 'views' ? sortDir : null}
                onToggle={() => toggle('views')}
                className="pb-2 pr-3 text-right"
              />
              <SortHeader
                label="Duration"
                active={sortKey === 'duration'}
                dir={sortKey === 'duration' ? sortDir : null}
                onToggle={() => toggle('duration')}
                className="pb-2 pr-3 text-right"
                tip="Video length — lives are usually 2h+"
              />
              <SortHeader
                label="Published"
                active={sortKey === 'published'}
                dir={sortKey === 'published' ? sortDir : null}
                onToggle={() => toggle('published')}
                className="pb-2 pr-3 text-right"
              />
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
                      {v.is_live && (
                        <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400">
                          LIVE
                        </span>
                      )}
                      {(v.is_short || (v.duration && v.duration > 0 && v.duration < 120)) && (
                        <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-yellow-900/30 text-yellow-400">
                          SHORT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <YtBadge className={channelColor(v.channel)}>{v.channel}</YtBadge>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/60 rounded-full"
                          style={{ width: `${Math.min(viewPct * 3, 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-foreground font-medium">
                        {formatNumber(v.views)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {v.is_live ? (
                      <span className="text-red-400">{formatDuration(v.duration)}</span>
                    ) : (
                      formatDuration(v.duration)
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">
                    {timeAgo(v.published)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
