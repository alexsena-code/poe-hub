import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizePost, formatNumber, timeAgo, getDateFrom } from './helpers';

// ---------------------------------------------------------------------------
// normalizePost
// ---------------------------------------------------------------------------

describe('normalizePost', () => {
  it('maps snake_case fields correctly', () => {
    const raw = {
      id: 'abc123',
      title: 'Test post',
      selftext: 'Body text',
      score: 100,
      num_comments: 42,
      flair: 'Build',
      author: 'user1',
      subreddit: 'pathofexile',
      permalink: '/r/pathofexile/abc',
      url: 'https://reddit.com/r/pathofexile/abc',
      created_utc: '2024-01-15T10:00:00.000Z',
      is_self: true,
      pob_links: ['https://pobb.in/1'],
      upvote_ratio: 0.95,
      top_comments: [{ body: 'Great build', score: 50, author: 'commenter' }],
    };

    const post = normalizePost(raw);

    expect(post.id).toBe('abc123');
    expect(post.num_comments).toBe(42);
    expect(post.created_utc).toBe('2024-01-15T10:00:00.000Z');
    expect(post.pob_links).toEqual(['https://pobb.in/1']);
    expect(post.upvote_ratio).toBe(0.95);
    expect(post.top_comments).toHaveLength(1);
    expect(post.top_comments[0].score).toBe(50);
  });

  it('falls back to camelCase fields when snake_case is missing', () => {
    const raw = {
      postId: 'camel1',
      numComments: 10,
      createdUtc: '2024-02-01T00:00:00.000Z',
      pobLinks: ['https://pobb.in/2'],
      upvoteRatio: 0.8,
      topComments: [],
      link_flair_text: 'Discussion',
    };

    const post = normalizePost(raw);

    expect(post.id).toBe('camel1');
    expect(post.num_comments).toBe(10);
    expect(post.created_utc).toBe('2024-02-01T00:00:00.000Z');
    expect(post.pob_links).toEqual(['https://pobb.in/2']);
    expect(post.upvote_ratio).toBe(0.8);
    expect(post.flair).toBe('Discussion');
  });

  it('uses safe defaults for missing fields', () => {
    const post = normalizePost({});

    expect(post.id).toBe('');
    expect(post.title).toBe('');
    expect(post.selftext).toBe('');
    expect(post.score).toBe(0);
    expect(post.num_comments).toBe(0);
    expect(post.flair).toBe('');
    expect(post.author).toBe('');
    expect(post.subreddit).toBe('');
    expect(post.permalink).toBe('');
    expect(post.url).toBe('');
    expect(post.created_utc).toBe('');
    expect(post.is_self).toBe(false);
    expect(post.pob_links).toEqual([]);
    expect(post.upvote_ratio).toBe(0);
    expect(post.top_comments).toEqual([]);
  });

  it('prefers snake_case over camelCase when both are present', () => {
    // snake_case should win when available (it's the canonical DB shape)
    const raw = {
      id: 'snake',
      postId: 'camel',
      num_comments: 99,
      numComments: 1,
    };

    const post = normalizePost(raw);

    expect(post.id).toBe('snake');
    expect(post.num_comments).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// timeAgo
// ---------------------------------------------------------------------------

describe('timeAgo', () => {
  beforeEach(() => {
    // Pin "now" to 2024-06-01T12:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" when less than 1 hour ago', () => {
    const iso = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    expect(timeAgo(iso)).toBe('just now');
  });

  it('returns hours label when 1–23 hours ago', () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString(); // 3h ago
    expect(timeAgo(iso)).toBe('3h ago');
  });

  it('returns days label when 1–6 days ago', () => {
    const iso = new Date(Date.now() - 2 * 24 * 3_600_000).toISOString(); // 2d ago
    expect(timeAgo(iso)).toBe('2d ago');
  });

  it('falls back to formatDate when 7+ days ago', () => {
    // 10 days ago — should return a formatted date, not a relative label
    const iso = new Date(Date.now() - 10 * 24 * 3_600_000).toISOString();
    const result = timeAgo(iso);
    // Must NOT be a relative label
    expect(result).not.toMatch(/ago|just now/);
    // Must look like a date string (non-empty)
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns "Invalid Date" when given a non-ISO string (NaN propagates to formatDate fallback)', () => {
    // new Date('not-a-date').getTime() is NaN — arithmetic stays NaN,
    // all comparisons are false, falls through to formatDate which returns "Invalid Date"
    expect(timeAgo('not-a-date')).toBe('Invalid Date');
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('returns raw string below 1000', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1_500)).toBe('1.5K');
    expect(formatNumber(10_000)).toBe('10.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});

// ---------------------------------------------------------------------------
// getDateFrom
// ---------------------------------------------------------------------------

describe('getDateFrom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for "all"', () => {
    expect(getDateFrom('all')).toBeUndefined();
  });

  it('returns undefined for unknown period strings', () => {
    expect(getDateFrom('90d')).toBeUndefined();
  });

  it('returns ISO string 1 day back for "24h"', () => {
    const result = getDateFrom('24h');
    expect(result).toBeDefined();
    const diff = new Date('2024-06-01T12:00:00.000Z').getTime() - new Date(result!).getTime();
    // Should be approximately 24h in ms
    expect(diff).toBeCloseTo(24 * 3_600_000, -3);
  });

  it('returns ISO string 7 days back for "7d"', () => {
    const result = getDateFrom('7d');
    expect(result).toBeDefined();
    const diff = new Date('2024-06-01T12:00:00.000Z').getTime() - new Date(result!).getTime();
    expect(diff).toBeCloseTo(7 * 24 * 3_600_000, -3);
  });
});
