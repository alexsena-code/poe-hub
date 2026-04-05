'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePostStore } from '@/lib/engine-store';
import { optimizeSeo, savePost, updatePost } from '@/lib/content-api';
import type { GeneratedSection } from '@/lib/engine-types';
import SectionSidebar from './SectionSidebar';
import SectionEditor from './SectionEditor';
import PostPreview from '@/components/engine/preview/PostPreview';
import PublishPanel from '@/components/engine/publish/PublishPanel';

const PHASE_LABELS: Record<string, string> = {
  briefing: 'Briefing',
  outlining: 'Gerando Outline',
  writing: 'Escrevendo',
  seo: 'Otimizando SEO',
  preview: 'Preview',
  published: 'Publicado',
};

export default function EditorShell({ postId }: { postId: string }) {
  const router = useRouter();
  const {
    sections,
    activeSectionId,
    phase,
    briefing,
    meta,
    slug,
    setPhase,
    setMeta,
    setSlug,
    reset,
  } = usePostStore();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doAutoSave = useCallback(async () => {
    if (!briefing || sections.length === 0) return;
    const hasDraftContent = sections.some((s) => s.draft !== null);
    if (!hasDraftContent) return;

    try {
      const data = {
        postId,
        slug: slug || undefined,
        briefing,
        sections: sections.map((s) => ({
          sectionId: s.sectionId,
          title: s.title,
          status: s.status,
          draft: s.draft,
          content: s.draft,
          humanMessages: s.humanMessages,
          lockedParts: s.lockedParts,
          requiresHumanInput: s.requiresHumanInput,
          tokensUsed: s.tokensUsed,
        })),
        meta,
        phase,
        status: 'draft',
        title: {
          'pt-br': `${briefing.skill || briefing.topic || ''} ${briefing.ascendancy || ''} — ${briefing.templateName || 'Guide'}`.trim(),
          en: `${briefing.skill || briefing.topic || ''} ${briefing.ascendancy || ''} — ${briefing.templateName || 'Guide'}`.trim(),
        },
        template: briefing.templateName || 'Build Guide',
      };

      if (slug) {
        await updatePost(slug, data);
      } else {
        const result = await savePost(data);
        if (result.slug) setSlug(result.slug);
      }
      setAutoSaveStatus('Salvo');
      setTimeout(() => setAutoSaveStatus(null), 2000);
    } catch {
      setAutoSaveStatus('Erro ao salvar');
      setTimeout(() => setAutoSaveStatus(null), 3000);
    }
  }, [briefing, sections, meta, phase, postId, slug, setSlug]);

  // Auto-save debounced: 5 seconds after last change
  useEffect(() => {
    if (phase !== 'writing' && phase !== 'seo') return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doAutoSave, 5000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [sections, meta, phase, doAutoSave]);

  const activeSection = sections.find((s) => s.sectionId === activeSectionId);
  const allApproved =
    sections.length > 0 && sections.every((s) => s.status === 'approved');
  const hasDrafts = sections.some((s) => s.draft !== null);

  async function handleSeoPass() {
    if (!briefing) return;

    const generatedSections: GeneratedSection[] = sections
      .filter((s) => s.draft)
      .map((s) => ({
        sectionId: s.sectionId,
        title: s.title,
        content: s.draft!,
        tokensUsed: s.tokensUsed,
      }));

    setPhase('seo');

    try {
      const result = await optimizeSeo({
        sections: generatedSections,
        briefing,
      });
      setMeta(result);
      setPhase('preview');
    } catch {
      setPhase('writing');
    }
  }

  function handleNewPost() {
    reset();
    router.push('/new');
  }

  function handleDelete() {
    reset();
    router.push('/');
  }

  function handleExportJson() {
    const post = {
      postId,
      briefing,
      sections: sections
        .filter((s) => s.draft)
        .map((s) => ({
          sectionId: s.sectionId,
          title: s.title,
          status: s.status,
          content: s.draft,
          humanMessages: s.humanMessages,
          lockedParts: s.lockedParts,
          tokensUsed: s.tokensUsed,
        })),
      meta,
      phase,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(post, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${briefing?.skill || 'post'}-${briefing?.ascendancy || 'draft'}-${postId}.json`.toLowerCase().replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }

  // Preview mode
  if (phase === 'preview') {
    return <PostPreview onBack={() => setPhase('writing')} />;
  }

  // Published mode
  if (phase === 'published') {
    return <PublishPanel />;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-accent">Path of Trade</h1>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm text-foreground font-medium">
            {briefing?.skill} {briefing?.ascendancy}
          </span>
          <span className="text-xs text-muted-foreground">
            {briefing?.league && `(${briefing.league})`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {autoSaveStatus && (
            <span className="text-[10px] text-muted-foreground mr-2">{autoSaveStatus}</span>
          )}
          <span className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-1 rounded-full bg-background border border-border mr-2">
            {PHASE_LABELS[phase] || phase}
          </span>

          {/* Export JSON */}
          {hasDrafts && (
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:text-foreground hover:border-foreground/30 transition-colors"
              title="Exportar JSON"
            >
              Exportar
            </button>
          )}

          {/* Preview (available even without all approved) */}
          {hasDrafts && phase === 'writing' && (
            <button
              onClick={() => setPhase('preview')}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Preview
            </button>
          )}

          {/* New Post */}
          <button
            onClick={handleNewPost}
            className="px-3 py-1.5 rounded-lg border border-accent/50 text-accent text-xs hover:bg-accent/10 transition-colors"
          >
            Novo Post
          </button>

          {/* Delete */}
          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
            >
              Apagar
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400">Tem certeza?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-500 transition-colors"
              >
                Sim
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:text-foreground transition-colors"
              >
                Nao
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="editor-grid flex-1 min-h-0">
        <SectionSidebar />
        <div className="flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            {activeSection ? (
              <SectionEditor />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Selecione uma secao para comecar.
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between h-12 px-6 border-t border-border bg-surface shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {sections.filter((s) => s.status === 'approved').length}/
                {sections.length} secoes aprovadas
              </span>
              {hasDrafts && (
                <>
                  <span>|</span>
                  <span>
                    {sections.reduce((sum, s) => sum + s.tokensUsed, 0).toLocaleString()} tokens
                  </span>
                  <span>|</span>
                  <span className="text-accent">
                    ~${(sections.reduce((sum, s) => sum + s.tokensUsed, 0) / 1_000_000 * 0.40).toFixed(4)}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {allApproved && phase === 'writing' && (
                <button
                  onClick={handleSeoPass}
                  className="px-4 py-1.5 rounded-lg bg-accent text-background font-medium text-sm hover:bg-accent-hover transition-colors"
                >
                  Otimizar SEO e Publicar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
