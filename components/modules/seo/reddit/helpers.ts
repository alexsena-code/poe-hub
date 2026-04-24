// ---------------------------------------------------------------------------
// Reddit module helpers — pure functions, no React deps
// ---------------------------------------------------------------------------

import type { RedditPost, RedditPostRaw, TopComment } from './types';

/**
 * Normalize a raw Reddit post from the engine API into the stable RedditPost
 * shape. Defends against both camelCase and snake_case keys because the
 * engine exporter has been inconsistent across versions.
 *
 * @example
 * const post = normalizePost({ postId: 'abc', numComments: 5 });
 * // → { id: 'abc', num_comments: 5, ... }
 */
export function normalizePost(raw: RedditPostRaw): RedditPost {
  return {
    id: (raw['id'] ?? raw['postId'] ?? '') as string,
    title: (raw['title'] ?? '') as string,
    selftext: (raw['selftext'] ?? '') as string,
    score: (raw['score'] ?? 0) as number,
    num_comments: (raw['num_comments'] ?? raw['numComments'] ?? 0) as number,
    flair: (raw['flair'] ?? raw['link_flair_text'] ?? '') as string,
    author: (raw['author'] ?? '') as string,
    subreddit: (raw['subreddit'] ?? '') as string,
    permalink: (raw['permalink'] ?? '') as string,
    url: (raw['url'] ?? '') as string,
    created_utc: (raw['created_utc'] ?? raw['createdUtc'] ?? '') as string,
    is_self: (raw['is_self'] ?? false) as boolean,
    pob_links: (raw['pob_links'] ?? raw['pobLinks'] ?? []) as string[],
    upvote_ratio: (raw['upvote_ratio'] ?? raw['upvoteRatio'] ?? 0) as number,
    top_comments: (raw['top_comments'] ?? raw['topComments'] ?? []) as TopComment[],
  };
}

/** Format a large number with K/M suffix for compact display. */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** Format an ISO date string to "Jan 1, 2024" (English locale, no pt-BR — Reddit data is en-US). */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Human-readable relative time label.
 * - <1h  → "just now"
 * - <24h → "Xh ago"
 * - <7d  → "Xd ago"
 * - ≥7d  → falls back to formatDate
 */
export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/** Tailwind classes for subreddit badge color-coding. */
export function subredditColor(sub: string): string {
  const map: Record<string, string> = {
    pathofexile: 'bg-orange-900/40 text-orange-300',
    PathOfExileBuilds: 'bg-amber-900/40 text-amber-300',
    PathOfExile2: 'bg-red-900/40 text-red-300',
  };
  return map[sub] ?? 'bg-zinc-800 text-zinc-300';
}

/** Tailwind classes for flair badge color-coding. */
export function flairColor(flair: string): string {
  const map: Record<string, string> = {
    'Build': 'bg-emerald-900/40 text-emerald-300',
    'Build Showcase': 'bg-emerald-900/40 text-emerald-300',
    'Build Feedback': 'bg-emerald-900/40 text-emerald-300',
    'Build Request': 'bg-teal-900/40 text-teal-300',
    'Paint Build': 'bg-emerald-900/40 text-emerald-300',
    'Atlas Tree': 'bg-emerald-900/40 text-emerald-300',
    'GGG': 'bg-red-900/40 text-red-300',
    'Game Feedback': 'bg-amber-900/40 text-amber-300',
    'Tool': 'bg-blue-900/40 text-blue-300',
    'Information': 'bg-cyan-900/40 text-cyan-300',
    'Discussion': 'bg-purple-900/40 text-purple-300',
    'Crafting Showcase': 'bg-pink-900/40 text-pink-300',
    'Crafting': 'bg-pink-900/40 text-pink-300',
    'Lucky (Non-Crafted) Showcase': 'bg-yellow-900/40 text-yellow-300',
    'Lucky Drop Showcase': 'bg-yellow-900/40 text-yellow-300',
    'Question': 'bg-indigo-900/40 text-indigo-300',
    'Question | Answered': 'bg-indigo-900/40 text-indigo-300',
    'Help Needed': 'bg-indigo-900/40 text-indigo-300',
    'Cautionary Tale': 'bg-rose-900/40 text-rose-300',
    'Theory': 'bg-violet-900/40 text-violet-300',
  };
  return map[flair] ?? 'bg-zinc-800 text-zinc-300';
}

/**
 * Compute trending phrases (single words + bigrams) from post titles.
 * Filters stopwords and phrases that appear fewer than 3 times.
 * Returns top 50 by total score of the posts containing the phrase.
 */
export function computeTrendingPhrases(
  posts: RedditPost[],
): { phrase: string; count: number; totalScore: number }[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'it', 'to', 'in', 'of', 'for', 'and', 'or', 'on', 'with', 'my', 'i', 'me',
    'this', 'that', 'be', 'are', 'was', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'at', 'by', 'from', 'not', 'you',
    'your', 'we', 'they', 'all', 'can', 'will', 'just', 'so', 'if', 'as', 'no', 'up', 'out', 'about', 'what', 'how', 'when',
    'there', 'would', 'been', 'than', 'its', 'one', 'more', 'too', 'very', 'should', 'now', 'after', 'before', 'into',
    'get', 'got', 'like', 'new', 'way', 'even', 'also', 'any', 'make', 'don', 'why', 'who', 'which', 'being', 'am',
  ]);
  const counts: Record<string, { count: number; totalScore: number }> = {};

  for (const p of posts) {
    const words = p.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    for (const w of words) {
      counts[w] = counts[w] || { count: 0, totalScore: 0 };
      counts[w].count++;
      counts[w].totalScore += p.score;
    }

    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      counts[bigram] = counts[bigram] || { count: 0, totalScore: 0 };
      counts[bigram].count++;
      counts[bigram].totalScore += p.score;
    }
  }

  return Object.entries(counts)
    .filter(([, v]) => v.count >= 3)
    .map(([phrase, v]) => ({ phrase, ...v }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);
}

/**
 * Group posts by flair, compute stats, and sort by total score descending.
 * Returns top posts (up to 5) per flair for inline display.
 */
export function groupPostsByFlair(posts: RedditPost[]): {
  flair: string;
  count: number;
  totalScore: number;
  avgScore: number;
  topPosts: RedditPost[];
}[] {
  const groups: Record<string, {
    flair: string;
    count: number;
    totalScore: number;
    avgScore: number;
    topPosts: RedditPost[];
  }> = {};

  for (const p of posts) {
    const flair = p.flair || 'Unflaired';
    if (!groups[flair]) groups[flair] = { flair, count: 0, totalScore: 0, avgScore: 0, topPosts: [] };
    groups[flair].count++;
    groups[flair].totalScore += p.score;
    groups[flair].topPosts.push(p);
  }

  for (const g of Object.values(groups)) {
    g.avgScore = Math.round(g.totalScore / g.count);
    g.topPosts.sort((a, b) => b.score - a.score);
    g.topPosts = g.topPosts.slice(0, 5);
  }

  return Object.values(groups).sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Compute the ISO dateFrom boundary for a given period filter string.
 * Returns undefined when period is 'all'.
 */
export function getDateFrom(period: string): string | undefined {
  if (period === 'all') return undefined;
  const now = new Date();
  const map: Record<string, number> = {
    '24h': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30,
  };
  const days = map[period];
  if (!days) return undefined;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
