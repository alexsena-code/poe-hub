export interface Briefing {
  skill: string;
  ascendancy: string;
  topic?: string;
  league?: string;
  notes?: string;
  mode?: 'auto' | 'outline_only';
  templateName?: string;
  /** Section IDs from the template that should NOT be generated for this post. */
  excludedSections?: string[];
  /** Active data-source keys (youtube, reddit, patch, ...) forcing Qdrant collections. */
  dataSources?: string[];
  /**
   * Path of Building import URL (pobb.in / pastebin / raw base64 code).
   * Decoded server-side at generate time — the decoded snapshot is
   * injected into briefing.notes as `## BUILD SNAPSHOT (PoB import)`
   * which the writer treats as authoritative build data.
   */
  pobUrl?: string;
  /**
   * User-approved outline (from OutlineEditor edits). When present, the
   * engine iterates this list instead of the template.sections, keeping
   * renames, reorders, additions and deletions the user made.
   */
  customOutline?: CustomSection[];
  /**
   * Qdrant collections a consultar no skim do OutlineProposer.
   * Vazio/ausente = default por template; com valor, sobrescreve.
   */
  skimCollections?: string[];
}

export interface SkimCollection {
  key: string;
  label: string;
  description: string;
  defaultFor: string[];
}

export interface SkimCollectionsCatalog {
  collections: SkimCollection[];
  defaultsByTemplate: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Post generation trace (mirrors packages/api/.../trace/trace-types.ts)
// ---------------------------------------------------------------------------

export type TraceMode = 'autonomous' | 'co_writer' | 'outline_only' | 'fix' | 'rewrite_selection';

export interface TraceLlmCall {
  model: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  llmUsageLogId?: number | null;
}

export interface TraceRetrieval {
  query: string | string[];
  queryType: string;
  collections: string[];
  chunkCount: number;
  topChunks: Array<{
    score: number;
    collection: string;
    pageTitle: string;
    section?: string;
    preview: string;
  }>;
  exactDataPresent: boolean;
  summaryPresent: boolean;
  durationMs: number;
}

export interface TraceEvent {
  seq: number;
  timestamp: string;
  node: string;
  kind: string;
  sectionId?: string;
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  llm?: TraceLlmCall;
  retrieval?: TraceRetrieval;
}

export interface PostTrace {
  slug: string;
  mode: TraceMode;
  createdAt: string;
  updatedAt: string;
  totals: {
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
    eventCount: number;
    llmCallCount: number;
  };
  inputs: {
    briefing: Briefing;
    templateName?: string;
    templateSnapshot?: Record<string, any>;
    customOutline?: CustomSection[];
    skimCollections?: string[];
    featureFlags?: Record<string, boolean>;
  };
  events: TraceEvent[];
}

// ---------------------------------------------------------------------------
// PoB decoder summary (mirror of packages/api PobSummary)
// ---------------------------------------------------------------------------

export interface PobSummaryGearItem {
  slot: string;
  name: string;
  isUnique: boolean;
  canonical: boolean;
  id?: string;
  explicits?: string[];
  implicits?: string[];
  enchant?: string;
  influences?: string[];
  itemLevel?: number;
  corrupted?: true;
  mirrored?: true;
  fractured?: true;
  split?: true;
}

export interface PobAlternateLoadout {
  id: string;
  title: string;
  gear?: PobSummaryGearItem[];
  tree?: {
    nodesTotal: number;
    keystones: string[];
    notablesAllocated: string[];
    masteries: Array<{ name: string; choice: string }>;
    jewels: string[];
  };
  mainSkill?: string | null;
  supports?: string[];
  auras?: string[];
  heralds?: string[];
  curses?: string[];
  banners?: string[];
  triggers?: string[];
  movement?: string[];
}

export interface PobSummary {
  class: string;
  ascendancy: string;
  level: number;
  notes?: string;
  stats: {
    totalDps?: string;
    ehp?: string;
    life?: string;
    energyShield?: string;
    resists?: string;
    movementSpeed?: string;
  };
  mainSkill: string | null;
  supports: string[];
  auras?: string[];
  heralds?: string[];
  curses?: string[];
  banners?: string[];
  triggers?: string[];
  movement?: string[];
  tree: {
    nodesTotal: number;
    keystones: string[];
    notablesAllocated: string[];
    masteries: Array<{ name: string; choice: string }>;
    jewels: string[];
  };
  gear: PobSummaryGearItem[];
  alternateLoadouts?: PobAlternateLoadout[];
}

export interface PostTraceSummary {
  slug: string;
  mode: TraceMode;
  createdAt: string;
  updatedAt: string;
  totals: PostTrace['totals'];
  templateName?: string;
  skill?: string;
  ascendancy?: string;
  topic?: string;
}

/**
 * Single section in a user-approved outline. Matches the engine's
 * CustomSection (packages/api/src/modules/content/types.ts).
 */
export interface CustomSection {
  id: string;
  title: string;
  goal: string;
  source: 'template' | 'proposed' | 'user';
  instruction?: string;
  query_type?: string;
  rag_queries?: string[];
  parallel_safe?: boolean;
  requires_human_input?: boolean;
  human_input_guidance?: string;
  max_tokens?: number;
}

/** Response shape of POST /content/outline/propose. */
export interface ProposedOutline {
  sections: CustomSection[];
  rationale: string;
  generatedAt: string;
  llmModel: string;
  tokensUsed: number;
  costUsd?: number;
  fallbackUsed?: boolean;
}

export type CritiqueSeverity = 'high' | 'medium' | 'low';
export type CritiqueIssueType =
  | 'factual'
  | 'instruction'
  | 'completeness'
  | 'invented'
  | 'banned_phrase';

export interface CritiqueIssue {
  id: string;
  severity: CritiqueSeverity;
  type: CritiqueIssueType;
  message: string;
  span?: string;
}

export interface GeneratedSection {
  sectionId: string;
  title: string;
  content: { 'pt-br': string; en: string };
  tokensUsed: number;
  critiqueIssues?: CritiqueIssue[];
}

export interface SectionState {
  sectionId: string;
  title: string;
  status: 'pending' | 'generating' | 'draft' | 'reviewing' | 'approved';
  draft: { 'pt-br': string; en: string } | null;
  humanMessages: string[];
  lockedParts: string[];
  requiresHumanInput: boolean;
  /** Human-facing prompt from the template explaining what the author should provide. */
  humanInputGuidance?: string;
  tokensUsed: number;
  critiqueIssues: CritiqueIssue[];
  dismissedIssueIds: string[];
  issuesCollapsed: boolean;
  fixingIssueIds: string[];
}

export interface PostState {
  postId: string;
  briefing: Briefing | null;
  sections: SectionState[];
  activeSectionId: string | null;
  meta: Record<string, unknown> | null;
  phase:
    | 'briefing'
    | 'outlining'
    | 'writing'
    | 'seo'
    | 'preview'
    | 'published';
}
