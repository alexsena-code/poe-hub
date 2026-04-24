// Shared types for the BriefingForm sub-components.
// BriefSource is the shape returned by GET /api/engine/ideation/briefs/:id
// when arriving via /workspace/new?briefId=X.

export interface BriefSource {
  id: number;
  title: string;
  titleEn: string;
  templateType: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  rationale: string;
  briefingText: string | null;
  cluster: string | null;
  urgency: string;
  effort: string;
  score: number;
}
