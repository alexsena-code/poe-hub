// ---------------------------------------------------------------------------
// Reddit module types
// ---------------------------------------------------------------------------

export interface TopComment {
  body: string;
  score: number;
  author: string;
}

/**
 * Raw shape from the engine API — uses inconsistent camel/snake_case because
 * the engine exporter evolved over time. normalizePost() in helpers.ts
 * flattens this into RedditPost. Keeping [key: string]: unknown instead of
 * any to satisfy the strict-types rule while allowing arbitrary extra fields.
 */
export interface RedditPostRaw {
  [key: string]: unknown;
}

/** Normalized, stable shape used throughout the Reddit module UI. */
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  flair: string;
  author: string;
  subreddit: string;
  permalink: string;
  url: string;
  created_utc: string;
  is_self: boolean;
  pob_links: string[];
  upvote_ratio: number;
  top_comments: TopComment[];
}

/** Global stats returned by /api/engine/seo/reddit/stats */
export interface RedditGlobalStats {
  totalPosts: number;
  buildPosts: number;
  avgScore: number;
  subreddits: { name: string; count: number }[];
}

/** Scan progress payload from /api/engine/seo/scan/reddit/status */
export interface RedditScanProgress {
  step: string;
  progress: number;
  logs: string[];
}

export type Tab = 'recent' | 'top-posts' | 'trending-topics' | 'build-posts';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'recent', label: 'Recent (24h)' },
  { key: 'top-posts', label: 'Top Posts' },
  { key: 'trending-topics', label: 'Trending Topics' },
  { key: 'build-posts', label: 'Build Posts' },
];

export type SortDir = 'asc' | 'desc' | null;

// Map frontend field names to backend Prisma field names
export const SORT_FIELD_MAP: Record<string, string> = {
  score: 'score',
  num_comments: 'numComments',
  created_utc: 'createdUtc',
  upvote_ratio: 'upvoteRatio',
  title: 'title',
  author: 'author',
  subreddit: 'subreddit',
};

export const PAGE_SIZE = 50;
