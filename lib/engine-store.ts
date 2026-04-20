import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Briefing, CritiqueIssue, PostState, SectionState } from './engine-types';

interface PostStore extends PostState {
  slug: string | null;
  /**
   * Editor-wide note the user attaches to the post. Passed to every
   * writeSection call so the LLM sees consistent guidance across sections
   * ("tom mais casual", "evitar jargão TFT", etc.) without the user having
   * to repeat it in each section's input box.
   */
  globalComment: string;
  setBriefing: (briefing: Briefing) => void;
  setPostId: (id: string) => void;
  setSlug: (slug: string) => void;
  setGlobalComment: (value: string) => void;
  initSections: (
    sections: Array<{
      sectionId: string;
      title: string;
      requiresHumanInput?: boolean;
      humanInputGuidance?: string;
    }>,
  ) => void;
  updateSection: (sectionId: string, patch: Partial<SectionState>) => void;
  setActiveSection: (sectionId: string | null) => void;
  setPhase: (phase: PostState['phase']) => void;
  setMeta: (meta: Record<string, unknown>) => void;
  addHumanMessage: (sectionId: string, message: string) => void;
  /** Remove a previously-submitted opinion by its index in humanMessages[]. */
  removeHumanMessage: (sectionId: string, index: number) => void;
  setCritiqueIssues: (sectionId: string, issues: CritiqueIssue[]) => void;
  dismissIssue: (sectionId: string, issueId: string) => void;
  clearIssues: (sectionId: string) => void;
  setIssuesCollapsed: (sectionId: string, collapsed: boolean) => void;
  setFixingIssues: (sectionId: string, issueIds: string[]) => void;
  loadFromSaved: (data: any) => void;
  reset: () => void;
}

const initialState: PostState & { slug: string | null; globalComment: string } = {
  postId: '',
  slug: null,
  briefing: null,
  sections: [],
  activeSectionId: null,
  meta: null,
  phase: 'briefing',
  globalComment: '',
};

export const usePostStore = create<PostStore>()(
  persist(
    (set) => ({
      ...initialState,

      slug: null,

      setBriefing: (briefing) => set({ briefing }),

      setPostId: (id) => set({ postId: id }),

      setSlug: (slug) => set({ slug }),

      setGlobalComment: (value) => set({ globalComment: value }),

      initSections: (sections) =>
        set({
          sections: sections.map((s) => ({
            sectionId: s.sectionId,
            title: s.title,
            status: 'pending' as const,
            draft: null,
            humanMessages: [],
            lockedParts: [],
            requiresHumanInput: s.requiresHumanInput ?? false,
            humanInputGuidance: s.humanInputGuidance,
            tokensUsed: 0,
            critiqueIssues: [],
            dismissedIssueIds: [],
            issuesCollapsed: false,
            fixingIssueIds: [],
          })),
          activeSectionId: sections[0]?.sectionId ?? null,
          phase: 'writing',
        }),

      updateSection: (sectionId, patch) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId ? { ...s, ...patch } : s,
          ),
        })),

      setActiveSection: (sectionId) => set({ activeSectionId: sectionId }),

      setPhase: (phase) => set({ phase }),

      setMeta: (meta) => set({ meta }),

      addHumanMessage: (sectionId, message) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId
              ? { ...s, humanMessages: [...s.humanMessages, message] }
              : s,
          ),
        })),

      removeHumanMessage: (sectionId, index) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId
              ? {
                  ...s,
                  humanMessages: s.humanMessages.filter((_, i) => i !== index),
                }
              : s,
          ),
        })),

      setCritiqueIssues: (sectionId, issues) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId
              ? { ...s, critiqueIssues: issues, dismissedIssueIds: [] }
              : s,
          ),
        })),

      dismissIssue: (sectionId, issueId) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId
              ? {
                  ...s,
                  dismissedIssueIds: s.dismissedIssueIds.includes(issueId)
                    ? s.dismissedIssueIds
                    : [...s.dismissedIssueIds, issueId],
                }
              : s,
          ),
        })),

      clearIssues: (sectionId) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId
              ? { ...s, critiqueIssues: [], dismissedIssueIds: [], fixingIssueIds: [] }
              : s,
          ),
        })),

      setIssuesCollapsed: (sectionId, collapsed) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId ? { ...s, issuesCollapsed: collapsed } : s,
          ),
        })),

      setFixingIssues: (sectionId, issueIds) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.sectionId === sectionId ? { ...s, fixingIssueIds: issueIds } : s,
          ),
        })),

      loadFromSaved: (data: any) =>
        set({
          postId: data.postId || data.slug || '',
          slug: data.slug || null,
          briefing: data.briefing || null,
          globalComment: typeof data.globalComment === 'string' ? data.globalComment : '',
          sections: (data.sections || []).map((s: any) => ({
            sectionId: s.sectionId,
            title: s.title,
            status: s.status || (s.draft || s.content ? 'draft' : 'pending'),
            draft: s.draft || s.content || null,
            humanMessages: s.humanMessages || [],
            lockedParts: s.lockedParts || [],
            requiresHumanInput: s.requiresHumanInput ?? false,
            humanInputGuidance: s.humanInputGuidance || undefined,
            tokensUsed: s.tokensUsed || 0,
            critiqueIssues: s.critiqueIssues || [],
            dismissedIssueIds: s.dismissedIssueIds || [],
            issuesCollapsed: s.issuesCollapsed || false,
            fixingIssueIds: [],
          })),
          activeSectionId: data.sections?.[0]?.sectionId ?? null,
          meta: data.meta || null,
          phase: data.phase || 'writing',
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'pot-cowriter',
    },
  ),
);
