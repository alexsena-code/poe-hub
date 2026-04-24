'use client';

// ---------------------------------------------------------------------------
// BuildPostsTab — posts that contain PoB (Path of Building) pastebin links
// Uses client-side sort since the dataset is a filtered subset of the page.
// ---------------------------------------------------------------------------

import type { RedditPost } from './types';
import { formatNumber, timeAgo, flairColor } from './helpers';
import { RedditBadge, SortHeader, useClientSort } from './reddit-primitives';

interface BuildPostsTabProps {
  posts: RedditPost[];
}

export function BuildPostsTab({ posts }: BuildPostsTabProps) {
  const { sorted, sortKey, sortDir, toggle } = useClientSort(posts, 'score');

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No build posts with PoB links found in the current dataset.
        <br />
        <span className="text-xs">Build posts are identified by the presence of Path of Building pastebin links.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <SortHeader
              label="Title"
              active={sortKey === 'title'}
              dir={sortKey === 'title' ? sortDir : null}
              onToggle={() => toggle('title')}
              className="py-2 pr-3"
            />
            <SortHeader
              label="Score"
              active={sortKey === 'score'}
              dir={sortKey === 'score' ? sortDir : null}
              onToggle={() => toggle('score')}
              className="py-2 pr-3 text-right"
            />
            <SortHeader
              label="Comments"
              active={sortKey === 'num_comments'}
              dir={sortKey === 'num_comments' ? sortDir : null}
              onToggle={() => toggle('num_comments')}
              className="py-2 pr-3 text-right"
            />
            <th className="py-2 pr-3">Flair</th>
            <th className="py-2 pr-3">PoB Links</th>
            <SortHeader
              label="Author"
              active={sortKey === 'author'}
              dir={sortKey === 'author' ? sortDir : null}
              onToggle={() => toggle('author')}
              className="py-2 pr-3"
            />
            <SortHeader
              label="Time"
              active={sortKey === 'created_utc'}
              dir={sortKey === 'created_utc' ? sortDir : null}
              onToggle={() => toggle('created_utc')}
              className="py-2 pr-3"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map(post => (
            <tr key={post.id} className="border-b border-border/50 hover:bg-white/[0.02]">
              <td className="py-2 pr-3 max-w-md">
                <a
                  href={`https://www.reddit.com${post.permalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-300 hover:text-orange-200 hover:underline"
                >
                  {post.title.length > 80 ? post.title.slice(0, 80) + '...' : post.title}
                </a>
              </td>
              <td className="py-2 pr-3 text-right font-mono text-foreground">{formatNumber(post.score)}</td>
              <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{post.num_comments}</td>
              <td className="py-2 pr-3">
                {post.flair && <RedditBadge className={flairColor(post.flair)}>{post.flair}</RedditBadge>}
              </td>
              <td className="py-2 pr-3">
                <div className="space-y-0.5">
                  {(post.pob_links ?? []).slice(0, 2).map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-emerald-400 hover:underline truncate max-w-[200px]"
                    >
                      {link}
                    </a>
                  ))}
                  {(post.pob_links ?? []).length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{(post.pob_links ?? []).length - 2} more
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 pr-3 text-muted-foreground text-xs">{post.author}</td>
              <td className="py-2 pr-3 text-muted-foreground text-xs whitespace-nowrap">
                {timeAgo(post.created_utc)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
