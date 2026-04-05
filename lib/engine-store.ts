import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Briefing, PostState, SectionState } from './engine-types';

interface PostStore extends PostState {
  slug: string | null;
  setBriefing: (briefing: Briefing) => void;
  setPostId: (id: string) => void;
  setSlug: (slug: string) => void;
  initSections: (
    sections: Array<{
      sectionId: string;
      title: string;
      requiresHumanInput?: boolean;
    }>,
  ) => void;
  updateSection: (sectionId: string, patch: Partial<SectionState>) => void;
  setActiveSection: (sectionId: string | null) => void;
  setPhase: (phase: PostState['phase']) => void;
  setMeta: (meta: Record<string, unknown>) => void;
  addHumanMessage: (sectionId: string, message: string) => void;
  loadFromSaved: (data: any) => void;
  reset: () => void;
}

const initialState: PostState & { slug: string | null } = {
  postId: '',
  slug: null,
  briefing: null,
  sections: [],
  activeSectionId: null,
  meta: null,
  phase: 'briefing',
};

export const usePostStore = create<PostStore>()(
  persist(
    (set) => ({
      ...initialState,

      slug: null,

      setBriefing: (briefing) => set({ briefing }),

      setPostId: (id) => set({ postId: id }),

      setSlug: (slug) => set({ slug }),

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
            tokensUsed: 0,
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

      loadFromSaved: (data: any) =>
        set({
          postId: data.postId || data.slug || '',
          slug: data.slug || null,
          briefing: data.briefing || null,
          sections: (data.sections || []).map((s: any) => ({
            sectionId: s.sectionId,
            title: s.title,
            status: s.status || (s.draft || s.content ? 'draft' : 'pending'),
            draft: s.draft || s.content || null,
            humanMessages: s.humanMessages || [],
            lockedParts: s.lockedParts || [],
            requiresHumanInput: s.requiresHumanInput ?? false,
            tokensUsed: s.tokensUsed || 0,
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
