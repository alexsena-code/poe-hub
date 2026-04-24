'use client';

// ---------------------------------------------------------------------------
// TrendingTopicsTab — trending phrases cloud + posts-by-flair breakdown
// ---------------------------------------------------------------------------

import type { RedditPost } from './types';
import { formatNumber, flairColor, computeTrendingPhrases, groupPostsByFlair } from './helpers';
import { RedditBadge } from './reddit-primitives';
import { useMemo } from 'react';

interface TrendingTopicsTabProps {
  posts: RedditPost[];
}

export function TrendingTopicsTab({ posts }: TrendingTopicsTabProps) {
  const trendingPhrases = useMemo(() => computeTrendingPhrases(posts), [posts]);
  const topicsByFlair = useMemo(() => groupPostsByFlair(posts), [posts]);

  return (
    <div className="grid gap-6">
      {/* Trending phrases */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Trending Phrases (from titles)</h2>
        <div className="flex flex-wrap gap-2">
          {trendingPhrases.slice(0, 40).map(({ phrase, count, totalScore }) => (
            <div
              key={phrase}
              className="px-3 py-1.5 rounded-md bg-orange-900/20 border border-orange-800/30 text-orange-200 text-xs"
              title={`${count} posts, total score: ${formatNumber(totalScore)}`}
            >
              <span className="font-medium">{phrase}</span>
              <span className="ml-1.5 text-orange-400/60">{count}x</span>
              <span className="ml-1 text-orange-400/40">{formatNumber(totalScore)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By flair */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Posts by Flair</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-3">Flair</th>
                <th className="py-2 pr-3 text-right">Posts</th>
                <th className="py-2 pr-3 text-right">Total Score</th>
                <th className="py-2 pr-3 text-right">Avg Score</th>
                <th className="py-2 pr-3">Top Posts</th>
              </tr>
            </thead>
            <tbody>
              {topicsByFlair.map(group => (
                <tr key={group.flair} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="py-2 pr-3">
                    <RedditBadge className={flairColor(group.flair)}>{group.flair}</RedditBadge>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-foreground">{group.count}</td>
                  <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                    {formatNumber(group.totalScore)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{group.avgScore}</td>
                  <td className="py-2 pr-3">
                    <div className="space-y-0.5">
                      {group.topPosts.slice(0, 3).map(p => (
                        <div key={p.id} className="text-xs text-muted-foreground/80 truncate max-w-lg">
                          <span className="text-orange-400/60 font-mono mr-1">{formatNumber(p.score)}</span>
                          <a
                            href={`https://www.reddit.com${p.permalink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-orange-300 hover:underline"
                          >
                            {p.title.slice(0, 60)}{p.title.length > 60 ? '...' : ''}
                          </a>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
