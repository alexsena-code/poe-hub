'use client';

// /seo/analysis — deep dive per keyword
// Layout: keyword input + two panels side by side (SERP snapshot | Competitor Analysis)
// SERP: GET /api/engine/seo/serp/latest (triggers POST analyze if stale/missing)
// Competitor Analysis: GET /api/engine/seo/analyze/keyword (CompetitorAnalyzerService)
// ContentScorer: POST /api/engine/seo/score — operator pastes draft markdown, sees score + gaps.

import { PageHeader } from '@/components/ui/page-header';
import { useAnalysisState } from '@/components/modules/seo/analysis/use-analysis-state';
import { KeywordInput } from '@/components/modules/seo/analysis/keyword-input';
import { SerpResultsTable } from '@/components/modules/seo/analysis/serp-results-table';
import { CompetitorAnalysisPanel } from '@/components/modules/seo/analysis/competitor-analysis-panel';
import { DraftTextarea } from '@/components/modules/seo/analysis/draft-textarea';
import { ContentScoreCard } from '@/components/modules/seo/analysis/content-score-card';
import { GapsPanel } from '@/components/modules/seo/analysis/gaps-panel';

export default function SeoAnalysisPage() {
  const state = useAnalysisState();

  // Both actions (SERP + competitor) use the same keyword input.
  // They are triggered separately so the user can choose depth.
  const isLoading = state.serpLoading || state.competitorLoading;

  function handleAnalyze() {
    state.fetchSerp();
    state.runCompetitorAnalysis();
  }

  const canScore = Boolean(state.keyword.trim()) && Boolean(state.draft.trim());

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        <PageHeader
          title="SEO Analysis"
          description="Enter a keyword to fetch SERP snapshot and analyze competitor pages for content gaps"
          accent="var(--color-seo)"
          className="mb-4"
        />

        <KeywordInput
          keyword={state.keyword}
          locale={state.locale}
          onKeywordChange={state.setKeyword}
          onLocaleChange={state.setLocale}
          onAnalyze={handleAnalyze}
          loading={isLoading}
        />
      </div>

      {/* Results area */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none space-y-6">
        {/* Empty state */}
        {!state.serpSnapshot && !state.competitorResult && !isLoading && (
          <div className="text-center text-muted-foreground py-16 text-sm">
            Enter a keyword above and click "Analyze" to see SERP results and competitor page breakdown.
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Fetching SERP data and analyzing competitor pages... This may take ~15 seconds.
          </div>
        )}

        {/* SERP snapshot */}
        {state.serpSnapshot && !state.serpLoading && (
          <SerpResultsTable snapshot={state.serpSnapshot} />
        )}

        {/* Competitor Analysis */}
        {state.competitorResult && !state.competitorLoading && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Competitor Analysis
            </div>
            <CompetitorAnalysisPanel result={state.competitorResult} />
          </div>
        )}

        {/* Content Scorer — operator pastes draft markdown, scores against SERP centroid */}
        <div className="space-y-4 border-t border-border/50 pt-6">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Content Scorer
          </div>

          <DraftTextarea
            value={state.draft}
            onChange={state.setDraft}
            disabled={state.scoreLoading}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={state.scoreContent}
              disabled={!canScore || state.scoreLoading}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40
                         rounded text-sm font-medium text-white transition-colors"
            >
              {state.scoreLoading ? 'Scoring...' : 'Score Content'}
            </button>
            {!canScore && !state.scoreLoading && (
              <span className="text-xs text-muted-foreground">
                Enter a keyword and paste your draft to enable scoring
              </span>
            )}
            {state.scoreError && (
              <span className="text-xs text-red-400">{state.scoreError}</span>
            )}
          </div>

          {/* Score result */}
          {state.score && !state.scoreLoading && (
            <div className="space-y-4">
              <ContentScoreCard score={state.score} />
              <GapsPanel score={state.score} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
