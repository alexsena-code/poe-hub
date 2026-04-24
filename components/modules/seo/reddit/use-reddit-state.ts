'use client';

// ---------------------------------------------------------------------------
// useRedditState — central state + data-fetching hook for the Reddit dashboard
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import type {
  RedditPost,
  RedditGlobalStats,
  RedditScanProgress,
  Tab,
} from './types';
import { SORT_FIELD_MAP, PAGE_SIZE } from './types';
import { normalizePost, getDateFrom } from './helpers';

const API_URL = '/api/engine';

export interface RedditState {
  tab: Tab;
  setTab: (t: Tab) => void;
  posts: RedditPost[];
  loading: boolean;
  scanning: boolean;
  scanResult: string | null;
  scanProgress: RedditScanProgress | null;
  filterSubreddit: string;
  setFilterSubreddit: (v: string) => void;
  filterFlair: string;
  setFilterFlair: (v: string) => void;
  filterPeriod: string;
  setFilterPeriod: (v: string) => void;
  showFilters: boolean;
  setShowFilters: (fn: (prev: boolean) => boolean) => void;
  page: number;
  setPage: (fn: (prev: number) => number) => void;
  totalPosts: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  toggleSort: (key: string) => void;
  globalStats: RedditGlobalStats | null;
  expandedPost: string | null;
  setExpandedPost: (id: string | null) => void;
  fetchPosts: () => Promise<void>;
  scanRedditKeywords: () => Promise<void>;
  clearFilters: () => void;
  PAGE_SIZE: number;
}

/** Central hook — owns all state and async side-effects for the Reddit page. */
export function useRedditState(): RedditState {
  const [tab, setTab] = useState<Tab>('recent');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<RedditScanProgress | null>(null);

  const [filterSubreddit, setFilterSubreddit] = useState<string>('all');
  const [filterFlair, setFilterFlair] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [sortBy, setSortBy] = useState('createdUtc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [globalStats, setGlobalStats] = useState<RedditGlobalStats | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  function toggleSort(key: string) {
    if (sortBy === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setPage(() => 0);
  }

  function clearFilters() {
    setFilterSubreddit('all');
    setFilterFlair('all');
    setFilterPeriod('all');
    setPage(() => 0);
  }

  async function fetchPosts() {
    setLoading(true);
    try {
      const params = buildPostParams();
      const res = await fetch(`${API_URL}/seo/reddit/posts?${params}`);
      if (res.ok) {
        const data = await res.json() as unknown[];
        if (Array.isArray(data)) setPosts(data.map(normalizePost));
      }

      const [countRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/seo/reddit/posts/count?${buildCountParams()}`),
        fetch(`${API_URL}/seo/reddit/stats`),
      ]);
      if (countRes.ok) setTotalPosts(await countRes.json() as number);
      if (statsRes.ok) setGlobalStats(await statsRes.json() as RedditGlobalStats);
    } catch { /* API offline */ }
    setLoading(false);
  }

  function buildPostParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));

    // Recent tab: force sort by date desc and limit to last 48h
    if (tab === 'recent') {
      params.set('sortBy', 'createdUtc');
      params.set('sortDir', 'desc');
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      params.set('dateFrom', since);
    } else {
      params.set('sortBy', SORT_FIELD_MAP[sortBy] || sortBy);
      params.set('sortDir', sortDir);
      const dateFrom = getDateFrom(filterPeriod);
      if (dateFrom) params.set('dateFrom', dateFrom);
    }

    if (filterSubreddit !== 'all') params.set('subreddit', filterSubreddit);
    if (filterFlair !== 'all') params.set('flair', filterFlair);
    return params;
  }

  function buildCountParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (filterSubreddit !== 'all') params.set('subreddit', filterSubreddit);
    if (filterFlair !== 'all') params.set('flair', filterFlair);
    if (tab === 'recent') {
      params.set('dateFrom', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    } else {
      const dateFrom = getDateFrom(filterPeriod);
      if (dateFrom) params.set('dateFrom', dateFrom);
    }
    return params;
  }

  async function scanRedditKeywords() {
    setScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      await fetch(`${API_URL}/seo/scan/reddit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minScore: 50 }),
      });
      // Poll status every 2 seconds until scan completes
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/seo/scan/reddit/status`);
          if (!res.ok) return;
          const status = await res.json() as {
            running: boolean;
            step: string;
            progress: number;
            logs: string[];
            result?: { newKeywords: number; rejected: number; postsAnalyzed: number };
          };
          setScanProgress({ step: status.step, progress: status.progress, logs: status.logs });
          if (!status.running && status.progress >= 100) {
            clearInterval(poll);
            setScanning(false);
            if (status.result) {
              const r = status.result;
              setScanResult(`Done: ${r.newKeywords} keywords imported, ${r.rejected} rejected, ${r.postsAnalyzed} posts analyzed`);
            }
          }
        } catch { /* ignore poll errors */ }
      }, 2000);
    } catch {
      setScanResult('Failed to connect to API');
      setScanning(false);
    }
  }

  useEffect(() => { void fetchPosts(); }, [tab, page, sortBy, sortDir, filterSubreddit, filterFlair, filterPeriod]);

  return {
    tab, setTab,
    posts, loading,
    scanning, scanResult, scanProgress,
    filterSubreddit, setFilterSubreddit,
    filterFlair, setFilterFlair,
    filterPeriod, setFilterPeriod,
    showFilters, setShowFilters,
    page, setPage,
    totalPosts,
    sortBy, sortDir, toggleSort,
    globalStats,
    expandedPost, setExpandedPost,
    fetchPosts,
    scanRedditKeywords,
    clearFilters,
    PAGE_SIZE,
  };
}
