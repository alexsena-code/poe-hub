/**
 * Shapes for the curated-ingest admin flow.
 *
 * Mirrors engine types in
 * packages/api/src/modules/knowledge/curated-ingest.types.ts — keep in
 * sync until the shared types package lands (tracked in CLAUDE.md).
 */

export type CuratedCollection =
  | 'poe_crafting'
  | 'poe_leveling'
  | 'poe_atlas'
  | 'poe_mechanics'
  | 'poe_trading';

export const CURATED_COLLECTIONS: readonly CuratedCollection[] = [
  'poe_crafting',
  'poe_leveling',
  'poe_atlas',
  'poe_mechanics',
  'poe_trading',
] as const;

export const COLLECTION_LABELS: Record<CuratedCollection, string> = {
  poe_crafting: 'Crafting',
  poe_leveling: 'Leveling',
  poe_atlas: 'Atlas & Endgame',
  poe_mechanics: 'Mechanics',
  poe_trading: 'Trading & Currency',
};

export type DraftStatus =
  | 'analyzing'
  | 'needs_clarification'
  | 'ready_to_approve'
  | 'approved'
  | 'rejected';

export const NON_TERMINAL_STATUSES: DraftStatus[] = [
  'analyzing',
  'needs_clarification',
  'ready_to_approve',
];

export const TERMINAL_STATUSES: DraftStatus[] = ['approved', 'rejected'];

export interface ProposedChunk {
  title: string;
  content: string;
  tags: string[];
  entities: string[];
}

export interface ClarificationGap {
  id: string;
  topic: string;
  question: string;
}

export interface LlmAnalysis {
  summary: string;
  language: string;
  proposedChunks: ProposedChunk[];
  gaps: ClarificationGap[];
}

export interface ResolvedClarification {
  questionId: string;
  answer: string;
}

/**
 * Matches the Prisma `CuratedIngestDraft` model — returned by every
 * endpoint under /api/knowledge/curated-ingest/*.
 */
export interface CuratedIngestDraft {
  id: number;
  sourceUrl: string | null;
  sourceType: string;
  targetCollection: CuratedCollection;
  language: string;
  status: DraftStatus;
  rawText: string;
  llmAnalysis: LlmAnalysis;
  clarifications: ResolvedClarification[] | null;
  qdrantPointIds: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}
