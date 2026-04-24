'use client';
/**
 * Publish blog post page — client wrapper.
 *
 * Loads draft via GET /api/sanity/draft/[id] (returns { meta, body, draftId }).
 * Shows spinner while loading; error message on failure.
 *
 * Renders PublishForm with the fetched meta + body.
 * Header includes "← Voltar ao editor" link (Link to /workspace/blog/[id]/edit).
 *
 * This must be a Client Component because the draft response drives state
 * and PublishForm needs hooks for the form and router.
 *
 * Session 10.b.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import type { JSONContent } from '@tiptap/core';
import type { EditorMetaForm } from '@/components/editor/editor-meta-schema';
import { PublishForm } from '@/components/editor/publish/publish-form';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResponse {
  meta: Partial<EditorMetaForm>;
  body: JSONContent;
  draftId: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'found'; draft: DraftResponse }
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
        const res = await fetch(`/api/sanity/draft/${id}`, { cache: 'no-store' });

        if (cancelled) return;

        if (!res.ok) {
          setState({
            status: 'error',
            message: `Falha ao carregar rascunho: HTTP ${res.status}`,
          });
          return;
        }

        const data = await res.json() as DraftResponse;
        setState({ status: 'found', draft: data });
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

  const { draft } = state;
  const postTitle = (draft.meta?.title ?? '').trim() || 'Sem título';

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
