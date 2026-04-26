// Session 32 (Frontend B): types for the /seo/posts-recommended page.
// Mirrors PostRecommendation in
// packages/api/src/modules/seo/services/post-recommendation.service.ts.

export type SuggestedAction =
  | "attack_now"
  | "optimize_existing"
  | "community_demand"
  | "monitor"
  | "defer"
  | "drop";

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  "attack_now",
  "optimize_existing",
  "community_demand",
  "monitor",
  "defer",
  "drop",
];

export interface PostRecommendation {
  keywordId: number;
  keyword: string;
  cluster: string | null;
  intent: string | null;
  language: string;
  strikingOpportunity: number;
  personalizedDifficulty: string | null;
  consolidatedScore: number | null;
  momentum7d: number | null;
  predictedClicks30d: number;
  predictedClicksDelta: number;
  currentPosition: number | null;
  impressions: number | null;
  suggestedAction: SuggestedAction;
}

export type GameFilter = "poe1" | "poe2" | "all";

// Session 36 Phase O: engine endpoint now returns a paginated envelope.
// Mirrors PostRecommendationPage in
// packages/api/src/modules/seo/services/post-recommendation.service.ts.
export interface PostRecommendationPage {
  items: PostRecommendation[];
  total: number;
  limit: number;
  offset: number;
}
