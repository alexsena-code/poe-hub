'use client';

// State hook for /seo/research — keywords, scans, blacklist, and scan actions.
// Server-side pagination and sorting delegated to the engine API (not client-sort).

import { useState, useCallback } from 'react';
import type { KeywordOpportunity, DashboardData, ScanResult } from '../shared/types';
import { API_URL } from '../shared/helpers';

const PAGE_SIZE = 50;

export interface ResearchFilters {
  source: string;
  cluster: string;
  intent: string;
  game: string;
  longTailOnly: boolean;
}

export interface ResearchState {
  dashboard: DashboardData | null;
  keywords: KeywordOpportunity[];
  loading: boolean;
  filters: ResearchFilters;
  page: number;
  totalKeywords: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  scans: ScanResult[];
  blacklistTerms: string[];
  blacklistLoading: boolean;
  newBlacklistTerm: string;
  suggestSeeds: string;
  suggestGame: string;
  actionLoading: string | null;
  actionResult: string | null;
  setFilters: (f: Partial<ResearchFilters>) => void;
  setPage: (p: number | ((prev: number) => number)) => void;
  setSortBy: (k: string) => void;
  setSortDir: (d: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => void;
  setNewBlacklistTerm: (v: string) => void;
  setSuggestSeeds: (v: string) => void;
  setSuggestGame: (v: string) => void;
  fetchDashboard: () => Promise<void>;
  fetchKeywords: () => Promise<void>;
  fetchScans: () => Promise<void>;
  fetchBlacklist: () => Promise<void>;
  addBlacklistTerm: () => Promise<void>;
  removeBlacklistTerm: (term: string) => Promise<void>;
  runSuggestScan: () => Promise<void>;
  runCompetitorCrawl: () => Promise<void>;
  importGaps: () => Promise<void>;
  PAGE_SIZE: number;
}

export function useResearchState(): ResearchState {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [keywords, setKeywords] = useState<KeywordOpportunity[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFiltersState] = useState<ResearchFilters>({
    source: 'all',
    cluster: 'all',
    intent: 'all',
    game: 'all',
    longTailOnly: false,
  });
  const [page, setPage] = useState(0);
  const [totalKeywords, setTotalKeywords] = useState(0);
  const [sortBy, setSortBy] = useState('viceScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [blacklistTerms, setBlacklistTerms] = useState<string[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [newBlacklistTerm, setNewBlacklistTerm] = useState('');

  const [suggestSeeds, setSuggestSeeds] = useState('');
  const [suggestGame, setSuggestGame] = useState('auto');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  function setFilters(partial: Partial<ResearchFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }));
    setPage(0);
  }

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/dashboard`);
      if (res.ok) setDashboard(await res.json());
    } catch { /* engine offline — surface stays at last known state */ }
  }, []);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.source !== 'all') params.set('source', filters.source);
      if (filters.cluster !== 'all') params.set('cluster', filters.cluster);
      if (filters.game !== 'all') params.set('game', filters.game);
      if (filters.longTailOnly) params.set('longTailOnly', 'true');
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const [kwRes, countRes] = await Promise.all([
        fetch(`${API_URL}/seo/keywords?${params}`),
        fetch(`${API_URL}/seo/keywords/count?${params}`),
      ]);
      if (kwRes.ok) setKeywords(await kwRes.json());
      if (countRes.ok) setTotalKeywords(await countRes.json());
    } catch { /* engine offline */ }
    setLoading(false);
  }, [filters, page, sortBy, sortDir]);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/scans?limit=20`);
      if (res.ok) setScans(await res.json());
    } catch { /* */ }
  }, []);

  const fetchBlacklist = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/blacklist`);
      if (res.ok) {
        const data = await res.json();
        setBlacklistTerms(data.terms ?? []);
      }
    } catch { /* engine offline */ }
  }, []);

  async function addBlacklistTerm() {
    const term = newBlacklistTerm.trim().toLowerCase();
    if (!term) return;
    setBlacklistLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      if (res.ok) {
        setNewBlacklistTerm('');
        fetchBlacklist();
      }
    } catch { /* */ }
    setBlacklistLoading(false);
  }

  async function removeBlacklistTerm(term: string) {
    try {
      await fetch(`${API_URL}/seo/blacklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      fetchBlacklist();
    } catch { /* */ }
  }

  async function runSuggestScan() {
    const seeds = suggestSeeds.split(',').map((s) => s.trim()).filter(Boolean);
    if (!seeds.length) return;
    setActionLoading('suggest');
    setActionResult(null);
    try {
      const payload: Record<string, unknown> = { seeds };
      if (suggestGame !== 'auto') payload.game = suggestGame;
      await fetch(`${API_URL}/seo/scan/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const gameLabel = suggestGame === 'auto' ? 'auto-detect' : suggestGame;
      setActionResult(`Suggest scan started for ${seeds.length} seed(s) (${gameLabel}). Keywords appear in ~40s.`);
    } catch {
      setActionResult('Failed to start suggest scan');
    }
    setActionLoading(null);
  }

  async function runCompetitorCrawl() {
    setActionLoading('competitors');
    setActionResult(null);
    try {
      await fetch(`${API_URL}/seo/competitors/crawl`, { method: 'POST' });
      setActionResult('Competitor crawl started. Check stats in ~30s.');
    } catch {
      setActionResult('Failed to start competitor crawl');
    }
    setActionLoading(null);
  }

  async function importGaps() {
    setActionLoading('gaps');
    setActionResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/competitors/import-gaps`, { method: 'POST' });
      const data = await res.json();
      setActionResult(`Imported ${data.imported} gaps, skipped ${data.skipped}`);
      fetchKeywords();
    } catch {
      setActionResult('Failed to import gaps');
    }
    setActionLoading(null);
  }

  return {
    dashboard,
    keywords,
    loading,
    filters,
    page,
    totalKeywords,
    sortBy,
    sortDir,
    scans,
    blacklistTerms,
    blacklistLoading,
    newBlacklistTerm,
    suggestSeeds,
    suggestGame,
    actionLoading,
    actionResult,
    setFilters,
    setPage,
    setSortBy,
    setSortDir,
    setNewBlacklistTerm,
    setSuggestSeeds,
    setSuggestGame,
    fetchDashboard,
    fetchKeywords,
    fetchScans,
    fetchBlacklist,
    addBlacklistTerm,
    removeBlacklistTerm,
    runSuggestScan,
    runCompetitorCrawl,
    importGaps,
    PAGE_SIZE,
  };
}
