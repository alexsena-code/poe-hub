'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePostStore } from '@/lib/engine-store';
import { optimizeSeo, savePost, updatePost } from '@/lib/content-api';
import type { GeneratedSection } from '@/lib/engine-types';
import type { ContentScoreReport, SlangReport } from '@/lib/engine-types';
import { ContentScoreCard } from '@/components/modules/workspace/guides/content-score-card';
import { SlangReportCard } from '@/components/modules/workspace/guides/slang-report-card';
import { Textarea } from '@/components/ui/textarea';
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
    globalComment,
    setPhase,
    setMeta,
    setSlug,
    setGlobalComment,
    reset,
  } = usePostStore();

  const [showGlobalComment, setShowGlobalComment] = useState(false);
  const [contentScore, setContentScore] = useState<ContentScoreReport | null>(null);
  const [slangReport, setSlangReport] = useState<SlangReport | null>(null);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add/remove fullscreen class on #app-main for edge-to-edge editor
  useEffect(() => {
    const main = document.getElementById('app-main');
    if (main) {
      main.classList.add('editor-fullscreen');
      return () => main.classList.remove('editor-fullscreen');
    }
  }, []);

  // Load existing post from backend when opening an already-generated post
  const { loadFromSaved, setPostId: storeSetPostId } = usePostStore();
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    // If store already has sections for this post, skip loading
    if (sections.length > 0 && (slug === postId || usePostStore.getState().postId === postId)) return;

    loadedRef.current = true;
    fetch(`/api/engine/content/posts/${postId}`)
      .then(async (res) => {
        if (!res.ok) return; // Post doesn't exist yet (new post flow)
        const data = await res.json();
        if (!data || !data.sections || data.sections.length === 0) return;

        loadFromSaved({
          postId,
          slug: data.slug || postId,
          briefing: data.briefing || null,
          sections: data.sections.map((s: any) => ({
            sectionId: s.sectionId || s.id,
            title: s.title || s.heading,
            status: s.status || (s.content ? 'draft' : 'pending'),
            draft: s.content || s.draft || null,
            humanMessages: s.humanMessages || [],
            lockedParts: s.lockedParts || [],
            requiresHumanInput: s.requiresHumanInput ?? false,
            tokensUsed: s.tokensUsed || 0,
          })),
          meta: data.meta || null,
          phase: data.phase || 'writing',
        });
        // Capture quality reports if the post was generated with engine session 21 Fase C.
        if (data.contentScore) setContentScore(data.contentScore);
        if (data.slangReport) setSlangReport(data.slangReport);
      })
      .catch(() => {}); // Silently fail — new post flow continues
  }, [postId]);

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
    router.push('/workspace/new');
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
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">Path of Trade</h1>
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
            className="px-3 py-1.5 rounded-lg border border-foreground/30 text-foreground text-xs hover:bg-foreground/10 transition-colors"
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

      {/* Main area: sidebar + editor */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar: sections list */}
        <SectionSidebar />

        {/* Right: active section editor */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Global comment panel — applied to every writeSection call so
              the user's editorial direction stays consistent across
              sections without repeating it per-section. */}
          <div className="shrink-0 border-b border-border bg-surface/50">
            <button
              type="button"
              onClick={() => setShowGlobalComment((v) => !v)}
              className={`w-full px-4 py-2 flex items-center gap-2 text-xs transition-colors ${
                globalComment
                  ? 'text-amber-300 hover:bg-amber-950/20'
                  : 'text-muted-foreground hover:bg-background/50'
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${globalComment ? 'bg-amber-400' : 'bg-muted-foreground/40'}`} />
              <span className="font-medium">Comentário global</span>
              {globalComment && (
                <span className="text-amber-400/70 truncate max-w-[60%]">
                  — {globalComment.slice(0, 80)}{globalComment.length > 80 ? '…' : ''}
                </span>
              )}
              <span className="ml-auto text-muted-foreground/60">
                {showGlobalComment ? 'ocultar' : globalComment ? 'editar' : 'adicionar'}
              </span>
            </button>
            {showGlobalComment && (
              <div className="px-4 pb-3">
                <Textarea
                  value={globalComment}
                  onChange={(e) => setGlobalComment(e.target.value)}
                  placeholder='Ex: "tom casual, evitar jargão TFT", "priorizar exemplos com Scarab of Divinity", "não mencionar TFT trades". Vai junto em toda regeneração de seção.'
                  rows={3}
                  className="resize-none placeholder:text-muted-foreground/70"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Aplicado a todas as seções. Separado do input por-seção.
                  </span>
                  {globalComment && (
                    <button
                      type="button"
                      onClick={() => setGlobalComment('')}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeSection ? (
              <SectionEditor />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Selecione uma secao para comecar.
              </div>
            )}
          </div>

          {/* Quality reports — shown post-generation when engine returned scores */}
          {(contentScore || slangReport) && (
            <div className="shrink-0 border-t border-border bg-surface/30 p-4 space-y-3">
              {contentScore && <ContentScoreCard score={contentScore} />}
              {slangReport && <SlangReportCard report={slangReport} />}
            </div>
          )}

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
                  <span className="text-green-400">
                    ~${(sections.reduce((sum, s) => sum + s.tokensUsed, 0) / 1_000_000 * 0.40).toFixed(4)}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {allApproved && phase === 'writing' && (
                <button
                  onClick={handleSeoPass}
                  className="px-4 py-1.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-500 transition-colors"
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
