'use client';

// ---------------------------------------------------------------------------
// CommentsPanel — expanded row for a single post: meta, selftext, top comments
// ---------------------------------------------------------------------------

import type { RedditPost } from './types';
import { formatNumber } from './helpers';

interface CommentsPanelProps {
  post: RedditPost;
  colSpan: number;
}

export function CommentsPanel({ post, colSpan }: CommentsPanelProps) {
  return (
    <tr className="bg-white/[0.02]">
      <td colSpan={colSpan} className="py-3 px-4">
        <div className="grid gap-3">
          {/* Post meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Upvote ratio: {(post.upvote_ratio * 100).toFixed(0)}%</span>
            <span>{post.is_self ? 'Self post' : 'Link post'}</span>
            {(post.pob_links ?? []).length > 0 && (
              <span>PoB links: {(post.pob_links ?? []).length}</span>
            )}
            <a
              href={`https://www.reddit.com${post.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              Open on Reddit
            </a>
          </div>

          {/* Selftext preview */}
          {post.selftext && (
            <div className="text-xs text-muted-foreground/80 bg-black/20 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {post.selftext.slice(0, 500)}{post.selftext.length > 500 ? '...' : ''}
            </div>
          )}

          {/* Top comments */}
          {post.top_comments.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top Comments</div>
              <div className="space-y-1">
                {post.top_comments.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-orange-400/70 font-mono shrink-0 w-8 text-right">{formatNumber(c.score)}</span>
                    <span className="text-muted-foreground/60 shrink-0">{c.author}:</span>
                    <span className="text-muted-foreground/80">
                      {c.body.slice(0, 200)}{c.body.length > 200 ? '...' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
