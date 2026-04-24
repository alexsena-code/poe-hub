// Local types for the /seo/analysis module.
// ContentScore mirrors ContentScoreResult from ContentScorerService in the engine.
// See: path-of-trade-content/packages/api/src/modules/seo/services/content-scorer.service.ts

export interface PerUrlSimilarity {
  url: string;
  similarity: number;
  rank: number;
}

// Response shape from POST /api/engine/seo/score (status: 'scored' wrapper stripped by caller).
export interface ContentScore {
  contentScore: number;             // 0-100, rescaled cosine
  centroidSimilarity: number;       // raw 0-1
  perUrlSimilarity: PerUrlSimilarity[];
  missingEntities: string[];
  missingHeadings: string[];
  analysisId: number;
  analysisCapturedAt: string;       // ISO string (Date serialised by engine)
  analysisStaleDays: number;
}

// Engine returns { status: 'scored', ...ContentScore } or { status: 'no_analysis', hint: string }
// or { error: string }. This union covers all three cases.
export type ScoreResponse =
  | ({ status: 'scored' } & ContentScore)
  | { status: 'no_analysis'; hint: string }
  | { error: string };
