'use client';

// ---------------------------------------------------------------------------
// PostsList — paginated table for Recent / Top Posts tabs
// ---------------------------------------------------------------------------

import React from 'react';
import type { RedditPost } from './types';
import { PAGE_SIZE } from './types';
import { formatNumber, timeAgo, subredditColor, flairColor } from './helpers';
import { RedditBadge, SortHeader } from './reddit-primitives';
import { CommentsPanel } from './comments-panel';

interface PostsListProps {
  posts: RedditPost[];
  totalPosts: number;
  page: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  expandedPost: string | null;
  onToggleSort: (key: string) => void;
  onToggleExpand: (id: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function PostsList({
  posts,
  totalPosts,
  page,
  sortBy,
  sortDir,
  expandedPost,
  onToggleSort,
  onToggleExpand,
  onPrevPage,
  onNextPage,
}: PostsListProps) {
  const pageCount = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));
  const start = totalPosts > 0 ? page * PAGE_SIZE + 1 : 0;
  const end = Math.min((page + 1) * PAGE_SIZE, totalPosts);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
              <SortHeader
                label="Title"
                active={sortBy === 'title'}
                dir={sortBy === 'title' ? sortDir : null}
                onToggle={() => onToggleSort('title')}
                className="py-2 pr-3"
              />
              <SortHeader
                label="Subreddit"
                active={sortBy === 'subreddit'}
                dir={sortBy === 'subreddit' ? sortDir : null}
                onToggle={() => onToggleSort('subreddit')}
                className="py-2 pr-3"
              />
              <SortHeader
                label="Score"
                active={sortBy === 'score'}
                dir={sortBy === 'score' ? sortDir : null}
                onToggle={() => onToggleSort('score')}
                className="py-2 pr-3 text-right"
                tip="Reddit upvote score"
              />
              <SortHeader
                label="Comments"
                active={sortBy === 'num_comments'}
                dir={sortBy === 'num_comments' ? sortDir : null}
                onToggle={() => onToggleSort('num_comments')}
                className="py-2 pr-3 text-right"
              />
              <th className="py-2 pr-3">Flair</th>
              <SortHeader
                label="Author"
                active={sortBy === 'author'}
                dir={sortBy === 'author' ? sortDir : null}
                onToggle={() => onToggleSort('author')}
                className="py-2 pr-3"
              />
              <SortHeader
                label="Time"
                active={sortBy === 'created_utc' || sortBy === 'createdUtc'}
                dir={sortBy === 'created_utc' || sortBy === 'createdUtc' ? sortDir : null}
                onToggle={() => onToggleSort('created_utc')}
                className="py-2 pr-3"
              />
            </tr>
          </thead>
          <tbody>
            {posts.map(post => (
              <React.Fragment key={post.id}>
                <tr
                  className="border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => onToggleExpand(post.id)}
                >
                  <td className="py-2 pr-3 max-w-md">
                    <a
                      href={`https://www.reddit.com${post.permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-300 hover:text-orange-200 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {post.title.length > 90 ? post.title.slice(0, 90) + '...' : post.title}
                    </a>
                    {(post.pob_links ?? []).length > 0 && (
                      <RedditBadge className="ml-2 bg-emerald-900/40 text-emerald-300">PoB</RedditBadge>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <RedditBadge className={subredditColor(post.subreddit)}>r/{post.subreddit}</RedditBadge>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-foreground">{formatNumber(post.score)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{post.num_comments}</td>
                  <td className="py-2 pr-3">
                    {post.flair && <RedditBadge className={flairColor(post.flair)}>{post.flair}</RedditBadge>}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground text-xs">{post.author}</td>
                  <td className="py-2 pr-3 text-muted-foreground text-xs whitespace-nowrap">
                    {timeAgo(post.created_utc)}
                  </td>
                </tr>
                {expandedPost === post.id && (
                  <CommentsPanel post={post} colSpan={7} />
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — fixed footer */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border bg-background">
        <span className="text-xs text-muted-foreground">
          Showing {start}-{end} of {totalPosts}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onPrevPage}
            disabled={page === 0}
            className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-white/[0.04]"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-xs text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={onNextPage}
            disabled={(page + 1) * PAGE_SIZE >= totalPosts}
            className="px-3 py-1 text-xs rounded bg-surface border border-border disabled:opacity-30 hover:bg-white/[0.04]"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
