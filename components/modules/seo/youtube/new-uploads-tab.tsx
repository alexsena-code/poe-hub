'use client';

// ---------------------------------------------------------------------------
// NewUploadsTab — recently detected uploads from monitored channels
// Shows thumbnails + basic info, filterable by time range and video type.
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import { channelColor, formatNumber, formatDuration, timeAgo } from './helpers';
import { YtBadge } from './primitives';
import type { NewUploadVideo, TimeRange } from './types';

const API_URL = '/api/engine';
const MIN_DURATION = 120; // 2 minutes — below this is considered a Short
const LIVE_TITLE_RE = /\[LIVE\]|\(LIVE\)|Livestream|![a-z]+\s+![a-z]+/i;

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24', label: 'Last 24h' },
  { value: '48', label: 'Last 48h' },
  { value: '168', label: 'Last 7 days' },
];

function isVideoLive(v: NewUploadVideo): boolean {
  return v.is_live || LIVE_TITLE_RE.test(v.title);
}

function isVideoShort(v: NewUploadVideo): boolean {
  return v.duration != null && v.duration > 0 && v.duration < MIN_DURATION;
}

export function NewUploadsTab() {
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

  const videos = allVideos.filter((v) => {
    if (hideShort && isVideoShort(v)) return false;
    if (hideLives && isVideoLive(v)) return false;
    return true;
  });

  const shortCount = allVideos.filter(isVideoShort).length;
  const liveCount = allVideos.filter(isVideoLive).length;

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
          <input
            type="checkbox"
            checked={hideShort}
            onChange={(e) => setHideShort(e.target.checked)}
            className="rounded"
          />
          Hide Shorts {shortCount > 0 && <span className="text-muted-foreground/50">({shortCount})</span>}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={hideLives}
            onChange={(e) => setHideLives(e.target.checked)}
            className="rounded"
          />
          Hide lives {liveCount > 0 && <span className="text-muted-foreground/50">({liveCount})</span>}
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {videos.length} of {allVideos.length} videos
        </span>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Loading new uploads...
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No new uploads detected in this time range.</p>
          <p className="text-xs mt-1">
            The monitor checks every hour. Click &quot;Refresh&quot; or wait for the next cron.
          </p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="space-y-1">
          {videos.map((v) => (
            <div
              key={v.videoId}
              className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-hover transition-colors"
            >
              {/* Thumbnail */}
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <YtBadge className={channelColor(v.channel)}>{v.channel}</YtBadge>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(v.published)}</span>
                  {v.views > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatNumber(v.views)} views
                    </span>
                  )}
                  {v.is_live && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
