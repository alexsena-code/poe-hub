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
