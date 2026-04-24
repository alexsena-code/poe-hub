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

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { EditorShell } from "@/components/editor/editor-shell";
import type { EditorMetaForm } from "@/components/editor/editor-meta-schema";
import type { PortableTextContent } from "@/lib/sanity/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResponse {
  meta: Partial<EditorMetaForm>;
  body: PortableTextContent[];
  draftId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "found"; draft: DraftResponse }
  | { status: "not-found" }
  | { status: "error"; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditBlogPostPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ status: "not-found" });
      return;
    }

    let cancelled = false;

    async function fetchDraft() {
      try {
        const res = await fetch(`/api/sanity/draft/${id}`, {
          cache: "no-store",
        });

        if (cancelled) return;

        if (res.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }

        const data = (await res.json()) as DraftResponse;
        setState({ status: "found", draft: data });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setState({ status: "error", message: msg });
        }
      }
    }

    fetchDraft();
    return () => { cancelled = true; };
  }, [id]);

  if (state.status === "not-found") {
    notFound();
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando rascunho…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive text-sm">Falha ao carregar: {state.message}</p>
      </div>
    );
  }

  const { draft } = state;

  return (
    <EditorShell
      initialMeta={draft.meta}
      initialBody={draft.body}
      draftId={id}
      defaultLanguage={(draft.meta.language as 'pt-br' | 'en') ?? 'pt-br'}
    />
  );
}
