'use client';
/**
 * Publish blog post page — client wrapper.
 *
 * Loads draft via GET /api/sanity/draft/[id] and the sibling-language draft
 * (when one exists) so the header can render a PT/EN toggle. Each language
 * keeps an independent PublishForm — clicking the toggle navigates to the
 * other draft's publish route, preserving everything the operator already
 * entered for the current language.
 *
 * Without this toggle, the operator who clicked "Prosseguir →" from the
 * editor's bilingual mode lost track of which language they were publishing
 * (form fields appeared "lost" because they were looking at the other
 * language's empty form).
 *
 * Sessions 10.b → 21 (bilingual toggle in header).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import type { PortableTextContent } from '@/lib/sanity/types';
import type { EditorMetaForm } from '@/components/editor/editor-meta-schema';
import { PublishForm } from '@/components/editor/publish/publish-form';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResponse {
  meta: Partial<EditorMetaForm>;
  // GET /api/sanity/draft/[id] returns Portable Text (canonical Sanity format),
  // NOT Tiptap JSON. Fixed regression where the type lied as JSONContent and
  // PublishForm did tiptapToPortable() on already-Portable-Text input,
  // producing an empty array → publish 400 "body must contain at least one block".
  body: PortableTextContent[];
  draftId: string;
  languageFromI18n?: 'pt-br' | 'en' | null;
}

interface SiblingResponse extends DraftResponse {
  language: 'pt-br' | 'en';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'found'; draft: DraftResponse; sibling: SiblingResponse | null }
  | { status: 'error'; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublishBlogPostPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // retryCount triggers effect re-run without changing id
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!id) {
      setState({ status: 'error', message: 'ID do post inválido' });
      return;
    }

    let cancelled = false;

    async function fetchDraft() {
      try {
        const [primaryRes, siblingRes] = await Promise.all([
          fetch(`/api/sanity/draft/${id}`, { cache: 'no-store' }),
          fetch(`/api/sanity/draft/${id}/sibling`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (!primaryRes.ok) {
          setState({
            status: 'error',
            message: `Falha ao carregar rascunho: HTTP ${primaryRes.status}`,
          });
          return;
        }

        const draft = (await primaryRes.json()) as DraftResponse;

        let sibling: SiblingResponse | null = null;
        if (siblingRes.ok) {
          const siblingData = (await siblingRes.json()) as
            | SiblingResponse
            | { sibling: null };
          if ('draftId' in siblingData) sibling = siblingData;
        }

        setState({ status: 'found', draft, sibling });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Erro desconhecido',
          });
        }
      }
    }

    fetchDraft();
    return () => { cancelled = true; };
  }, [id, retryCount]);

  const editHref = `/workspace/blog/${id}/edit`;

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" ariaLabel="Carregando rascunho…" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (state.status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <EmptyState
          icon={AlertCircle}
          title="Falha ao carregar"
          description={state.message}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Tentar novamente
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={editHref}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Voltar ao editor
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // ── Loaded ──────────────────────────────────────────────────────────────────

  const { draft, sibling } = state;
  const postTitle = (draft.meta?.title ?? '').trim() || 'Sem título';
  // Prefer i18n key over meta.language — see edit page for the same rationale.
  const currentLanguage =
    draft.languageFromI18n ?? (draft.meta?.language as 'pt-br' | 'en' | undefined) ?? 'pt-br';

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Page header */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Publicar post</p>
            <h1 className="text-lg font-semibold text-zinc-100 truncate">{postTitle}</h1>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={editHref}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar ao editor
            </Link>
          </Button>
        </div>
      </header>

      {sibling && (
        <PublishLanguageToggle
          currentLanguage={currentLanguage}
          siblingLanguage={sibling.language}
          siblingDraftId={sibling.draftId}
        />
      )}

      {/* Form body */}
      <main className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <PublishForm
            initialMeta={draft.meta}
            body={draft.body}
            draftId={draft.draftId}
          />
        </div>
      </main>
    </div>
  );
}

// ─── Language toggle ──────────────────────────────────────────────────────────

interface PublishLanguageToggleProps {
  currentLanguage: 'pt-br' | 'en';
  siblingLanguage: 'pt-br' | 'en';
  siblingDraftId: string;
}

/**
 * Toggle that navigates between the PT and EN publish forms. Each language
 * has its own draft with independent metadata — switching navigates rather
 * than toggling local state, so unsaved form values in the current language
 * trigger the autosave debounce on the next blur (1s) before navigation.
 */
function PublishLanguageToggle({
  currentLanguage,
  siblingLanguage,
  siblingDraftId,
}: PublishLanguageToggleProps) {
  const router = useRouter();
  const labelOf = (lang: 'pt-br' | 'en') => (lang === 'pt-br' ? 'PT-BR' : 'EN');

  const handleToggle = (target: 'current' | 'sibling') => {
    if (target === 'sibling') {
      router.push(`/workspace/blog/${siblingDraftId}/publish`);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <span className="text-xs uppercase tracking-wide text-zinc-500">Idioma:</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 text-xs"
        onClick={() => handleToggle('current')}
      >
        {labelOf(currentLanguage)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => handleToggle('sibling')}
      >
        {labelOf(siblingLanguage)}
      </Button>
      <span className="ml-2 text-xs text-zinc-500">
        Cada idioma tem seus próprios metadados — alternar navega entre as duas
        páginas de publicação.
      </span>
    </div>
  );
}
