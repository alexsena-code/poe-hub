'use client';
/**
 * Edit existing blog post page — client wrapper.
 *
 * Fetches the draft via GET /api/sanity/draft/[id] which returns
 * { meta, body, draftId } (editor-native shape since S10.a/10.c transform).
 * Passes the loaded data to EditorShell via the new initialMeta/initialBody props.
 *
 * S10.b: EditorShell no longer accepts SanityPost — it accepts initialMeta
 * (Partial<EditorMetaForm>) and initialBody (Tiptap JSONContent) directly.
 *
 * Session 10 S10.b.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { EditorShell } from "@/components/editor/editor-shell";
import type { EditorMetaForm } from "@/components/editor/editor-meta-schema";
import type { PortableTextContent } from "@/lib/sanity/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResponse {
  meta: Partial<EditorMetaForm>;
  body: PortableTextContent[];
  draftId: string;
  /**
   * Language inferred from the translation.metadata `_key` for this doc.
   * Authoritative — `meta.language` can drift when autosave persists a
   * stale value. Use this when present.
   */
  languageFromI18n?: 'pt-br' | 'en' | null;
}

interface SiblingResponse extends DraftResponse {
  language: 'pt-br' | 'en';
}

type LoadState =
  | { status: "loading" }
  | { status: "found"; draft: DraftResponse; sibling: SiblingResponse | null }
  | { status: "not-found" }
  | { status: "error"; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditBlogPostPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // retryCount increments on "Tentar novamente" to re-trigger the effect
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setState({ status: "loading" });
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!id) {
      setState({ status: "not-found" });
      return;
    }

    let cancelled = false;

    async function fetchDraft() {
      try {
        // Fetch the primary draft + its translation sibling in parallel.
        // Sibling failures are non-fatal — the editor falls back to single mode.
        const [primaryRes, siblingRes] = await Promise.all([
          fetch(`/api/sanity/draft/${id}`, { cache: "no-store" }),
          fetch(`/api/sanity/draft/${id}/sibling`, { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (primaryRes.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        if (!primaryRes.ok) {
          setState({ status: "error", message: `HTTP ${primaryRes.status}` });
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

        setState({ status: "found", draft, sibling });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setState({ status: "error", message: msg });
        }
      }
    }

    fetchDraft();
    return () => { cancelled = true; };
  }, [id, retryCount]);

  if (state.status === "not-found") {
    notFound();
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" ariaLabel="Carregando rascunho…" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <EmptyState
          icon={AlertCircle}
          title="Falha ao carregar"
          description={state.message}
          action={
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const { draft, sibling } = state;

  // Prefer the i18n-derived language over `meta.language`. When both disagree,
  // the i18n key wins because it's set by the plugin at pair creation and
  // can't drift; meta.language has historical bugs that produced wrong values.
  const primaryLanguage =
    draft.languageFromI18n ?? (draft.meta.language as 'pt-br' | 'en') ?? 'pt-br';

  return (
    <EditorShell
      initialMeta={draft.meta}
      initialBody={draft.body}
      draftId={id}
      defaultLanguage={primaryLanguage}
      sibling={
        sibling
          ? {
              initialMeta: sibling.meta,
              initialBody: sibling.body,
              draftId: sibling.draftId,
              language: sibling.language,
            }
          : undefined
      }
    />
  );
}
