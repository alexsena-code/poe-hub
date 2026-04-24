'use client';

// State hook for /seo/analysis — keyword input, SERP fetch, competitor analysis,
// and content scoring (POST /api/engine/seo/score).
// Draft is provided by the operator via DraftTextarea; scoring is separate from SERP/competitor.

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { CompetitorAnalysis, SerpSnapshot } from '../shared/types';
import type { ContentScore, ScoreResponse } from './types';
import { API_URL } from '../shared/helpers';

export interface AnalysisState {
  keyword: string;
  locale: string;
  serpSnapshot: SerpSnapshot | null;
  serpLoading: boolean;
  competitorResult: CompetitorAnalysis | null;
  competitorLoading: boolean;
  draft: string;
  score: ContentScore | null;
  scoreLoading: boolean;
  scoreError: string | null;
  setKeyword: (v: string) => void;
  setLocale: (v: string) => void;
  setDraft: (v: string) => void;
  fetchSerp: () => Promise<void>;
  runCompetitorAnalysis: () => Promise<void>;
  scoreContent: () => Promise<void>;
}

export function useAnalysisState(): AnalysisState {
  const [keyword, setKeyword] = useState('');
  const [locale, setLocale] = useState('en/us');

  const [serpSnapshot, setSerpSnapshot] = useState<SerpSnapshot | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);

  const [competitorResult, setCompetitorResult] = useState<CompetitorAnalysis | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  const [draft, setDraft] = useState('');
  const [score, setScore] = useState<ContentScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

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

  // Score draft against SERP centroid via POST /api/engine/seo/score.
  // Requires keyword + non-empty draft. Engine needs a prior SerpAnalysis for the keyword.
  // Passes triggerAnalysisIfMissing=true so operator doesn't need to click "Analyze" first.
  const scoreContent = useCallback(async () => {
    if (!keyword.trim() || !draft.trim()) return;
    setScoreLoading(true);
    setScoreError(null);
    setScore(null);
    try {
      const localeParam = locale.split('/')[0];
      const res = await fetch(`${API_URL}/seo/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          draft: draft.trim(),
          locale: localeParam,
          triggerAnalysisIfMissing: true,
        }),
      });
      const data: ScoreResponse = await res.json();

      if ('error' in data) {
        setScoreError(data.error);
        toast.error(`Score failed: ${data.error}`);
      } else if (data.status === 'no_analysis') {
        setScoreError(`No SERP analysis for this keyword. ${data.hint}`);
        toast.error('No SERP analysis available — run "Analyze" first');
      } else {
        // status === 'scored': extract ContentScore fields (omit `status`)
        const { status: _status, ...contentScore } = data;
        setScore(contentScore);
        toast.success(`Score: ${contentScore.contentScore}/100`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Engine offline';
      setScoreError(msg);
      toast.error(`Score error: ${msg}`);
    }
    setScoreLoading(false);
  }, [keyword, locale, draft]);

  return {
    keyword,
    locale,
    serpSnapshot,
    serpLoading,
    competitorResult,
    competitorLoading,
    draft,
    score,
    scoreLoading,
    scoreError,
    setKeyword,
    setLocale,
    setDraft,
    fetchSerp,
    runCompetitorAnalysis,
    scoreContent,
  };
}
