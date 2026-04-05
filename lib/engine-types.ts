export interface Briefing {
  skill: string;
  ascendancy: string;
  topic?: string;
  league?: string;
  budgetLow?: number;
  budgetMid?: number;
  budgetHigh?: number;
  notes?: string;
  mode?: 'auto' | 'outline_only';
  templateName?: string;
}

export interface GeneratedSection {
  sectionId: string;
  title: string;
  content: { 'pt-br': string; en: string };
  tokensUsed: number;
}

export interface SectionState {
  sectionId: string;
  title: string;
  status: 'pending' | 'generating' | 'draft' | 'reviewing' | 'approved';
  draft: { 'pt-br': string; en: string } | null;
  humanMessages: string[];
  lockedParts: string[];
  requiresHumanInput: boolean;
  tokensUsed: number;
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
