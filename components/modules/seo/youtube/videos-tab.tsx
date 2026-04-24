'use client';

// ---------------------------------------------------------------------------
// VideosTab — recent videos sorted by publish date
// ---------------------------------------------------------------------------

import { useSort, SortHeader, YtBadge } from './primitives';
import { channelColor, formatNumber, timeAgo } from './helpers';
import type { Video, YouTubeTrendsData } from './types';

interface Props {
  data: YouTubeTrendsData | null;
}

export function VideosTab({ data }: Props) {
  const { sorted, sortKey, sortDir, toggle } = useSort<Video>(
    data?.videos ?? [],
    'published',
    'desc',
  );

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
              <SortHeader
                label="Title"
                active={sortKey === 'title'}
                dir={sortKey === 'title' ? sortDir : null}
                onToggle={() => toggle('title')}
                className="pb-2 pr-3"
                tip="Video title — click to open on YouTube"
              />
              <SortHeader
                label="Channel"
                active={sortKey === 'channel'}
                dir={sortKey === 'channel' ? sortDir : null}
                onToggle={() => toggle('channel')}
                className="pb-2 pr-3"
                tip="YouTube channel that published the video"
              />
              <SortHeader
                label="Published"
                active={sortKey === 'published'}
                dir={sortKey === 'published' ? sortDir : null}
                onToggle={() => toggle('published')}
                className="pb-2 pr-3 text-right"
                tip="When the video was published"
              />
              <SortHeader
                label="Views"
                active={sortKey === 'views'}
                dir={sortKey === 'views' ? sortDir : null}
                onToggle={() => toggle('views')}
                className="pb-2 text-right"
                tip="View count at time of last scan"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr
                key={v.id}
                className="border-b border-border/50 hover:bg-surface-hover transition-colors"
              >
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
                <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">
                  {timeAgo(v.published)}
                </td>
                <td className="py-2 text-right tabular-nums text-foreground">
                  {formatNumber(v.views)}
                </td>
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
