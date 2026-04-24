'use client';

// State hook for /seo/analysis — keyword input, SERP fetch, competitor analysis.
// ContentScorer (POST /api/engine/seo/score) requires a draft body — so the score
// button is available only as a stub here; user would paste their draft in a future UI.
// See TODO below.

import { useState, useCallback } from 'react';
import type { CompetitorAnalysis, SerpSnapshot } from '../shared/types';
import { API_URL } from '../shared/helpers';

export interface AnalysisState {
  keyword: string;
  locale: string;
  serpSnapshot: SerpSnapshot | null;
  serpLoading: boolean;
  competitorResult: CompetitorAnalysis | null;
  competitorLoading: boolean;
  setKeyword: (v: string) => void;
  setLocale: (v: string) => void;
  fetchSerp: () => Promise<void>;
  runCompetitorAnalysis: () => Promise<void>;
}

export function useAnalysisState(): AnalysisState {
  const [keyword, setKeyword] = useState('');
  const [locale, setLocale] = useState('en/us');

  const [serpSnapshot, setSerpSnapshot] = useState<SerpSnapshot | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);

  const [competitorResult, setCompetitorResult] = useState<CompetitorAnalysis | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  // Fetch latest SERP snapshot from GET /api/engine/seo/serp/latest.
  // If none exists, triggers a new analysis via POST /api/engine/seo/serp/analyze.
  const fetchSerp = useCallback(async () => {
    if (!keyword.trim()) return;
    setSerpLoading(true);
    setSerpSnapshot(null);
    try {
      const localeParam = locale.split('/')[0]; // "en/us" → "en"
      const latestRes = await fetch(
        `${API_URL}/seo/serp/latest?keyword=${encodeURIComponent(keyword.trim())}&locale=${localeParam}`,
      );
      const latestData: SerpSnapshot = await latestRes.json();

      if (latestData.found) {
        setSerpSnapshot(latestData);
      } else {
        // Trigger fresh analysis and then re-fetch
        await fetch(`${API_URL}/seo/serp/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: keyword.trim(), locale: localeParam }),
        });
        const freshRes = await fetch(
          `${API_URL}/seo/serp/latest?keyword=${encodeURIComponent(keyword.trim())}&locale=${localeParam}`,
        );
        setSerpSnapshot(await freshRes.json());
      }
    } catch { /* engine offline */ }
    setSerpLoading(false);
  }, [keyword, locale]);

  // Competitor analysis via GET /api/engine/seo/analyze/keyword (CompetitorAnalyzerService).
  // This is the same endpoint used by the former "analyze" tab in /seo/research.
  const runCompetitorAnalysis = useCallback(async () => {
    if (!keyword.trim()) return;
    setCompetitorLoading(true);
    setCompetitorResult(null);
    try {
      const [hl, gl] = locale.split('/');
      const res = await fetch(
        `${API_URL}/seo/analyze/keyword?keyword=${encodeURIComponent(keyword.trim())}&hl=${hl}&gl=${gl}`,
      );
      setCompetitorResult(await res.json());
    } catch { /* engine offline */ }
    setCompetitorLoading(false);
  }, [keyword, locale]);

  return {
    keyword,
    locale,
    serpSnapshot,
    serpLoading,
    competitorResult,
    competitorLoading,
    setKeyword,
    setLocale,
    fetchSerp,
    runCompetitorAnalysis,
  };
}
