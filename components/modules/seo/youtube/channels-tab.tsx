'use client';

// ---------------------------------------------------------------------------
// ChannelsTab — active channels table + per-channel video panel
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useSort, SortHeader, Tip, YtBadge } from './primitives';
import { channelColor, formatNumber, timeAgo, extractVideoKeywords } from './helpers';
import type { ActiveChannel, TrendingKeyword, YouTubeTrendsData } from './types';

interface Props {
  data: YouTubeTrendsData | null;
  allKeywords: TrendingKeyword[];
}

export function ChannelsTab({ data, allKeywords }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { sorted, sortKey, sortDir, toggle } = useSort<ActiveChannel>(
    data?.active_channels ?? [],
    'videos',
    'desc',
  );

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No data yet. Click &quot;Scan Channels&quot; to monitor PoE creators.</p>
      </div>
    );
  }

  // Build channel -> top topics map from trending keywords
  const channelTopics: Record<string, string[]> = {};
  for (const kw of allKeywords) {
    for (const ch of kw.channels) {
      if (!channelTopics[ch]) channelTopics[ch] = [];
      if (channelTopics[ch].length < 5) channelTopics[ch].push(kw.keyword);
    }
  }

  const channelVideos = selectedChannel
    ? data.videos
        .filter((v) => v.channel === selectedChannel)
        .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    : [];

  return (
    <div className="flex gap-4">
      {/* Channel list */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <SortHeader
                label="Channel"
                active={sortKey === 'channel'}
                dir={sortKey === 'channel' ? sortDir : null}
                onToggle={() => toggle('channel')}
                className="pb-2 pr-3"
              />
              <SortHeader
                label="Videos (30d)"
                active={sortKey === 'videos'}
                dir={sortKey === 'videos' ? sortDir : null}
                onToggle={() => toggle('videos')}
                className="pb-2 pr-3 text-right"
                tip="Videos published in the last 30 days"
              />
              <th className="pb-2">
                <Tip text="Most common PoE topics in their recent videos">Top Topics</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ch) => (
              <tr
                key={ch.channel}
                onClick={() => setSelectedChannel(selectedChannel === ch.channel ? null : ch.channel)}
                className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${
                  selectedChannel === ch.channel ? 'bg-foreground/5 border-border' : ''
                }`}
              >
                <td className="py-2 pr-3">
                  <YtBadge className={channelColor(ch.channel)}>{ch.channel}</YtBadge>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium text-foreground">
                  {ch.videos}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {(channelTopics[ch.channel] || []).map((topic) => (
                      <span
                        key={topic}
                        className="text-xs text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded"
                      >
                        {topic}
                      </span>
                    ))}
                    {!channelTopics[ch.channel]?.length && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected channel video panel */}
      {selectedChannel && (
        <div className="w-[420px] shrink-0 bg-surface border border-border rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-foreground">{selectedChannel}</h3>
            <span className="text-xs text-muted-foreground">{channelVideos.length} videos</span>
          </div>
          {channelVideos.length === 0 && (
            <p className="text-xs text-muted-foreground">No PoE videos found for this channel.</p>
          )}
          {channelVideos.map((v) => {
            const kws = extractVideoKeywords(v.title);
            return (
              <div key={v.id} className="border-b border-border/50 py-3 last:border-0">
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-foreground hover:text-emerald-400 block mb-1"
                >
                  {v.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span>{timeAgo(v.published)}</span>
                  {v.views > 0 && <span>{formatNumber(v.views)} views</span>}
                </div>
                {kws.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {kws.map((k) => (
                      <span
                        key={k}
                        className="text-[10px] bg-emerald-900/30 text-emerald-300 px-1.5 py-0.5 rounded"
                      >
                        {k}
                      </span>
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
