'use client';
/**
 * Edit existing blog post page — client wrapper.
 *
 * This must be a client component because EditorShell is client-only
 * (Tiptap requires browser APIs). We fetch the post data client-side
 * via the existing draft/[id] API route with SWR.
 *
 * The `id` param is the bare Sanity document ID (without "drafts." prefix).
 * getSanityClient() on the server would require env vars at build time;
 * fetching via the auth-protected API route is safer and consistent with
 * the rest of the hub's data patterns.
 *
 * Session 10 S10.a — side panels removed; right rail is mounted inside EditorShell.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/editor-shell";
import type { SanityPost } from "@/lib/sanity/types";

type LoadState =
  | { status: "loading" }
  | { status: "found"; post: SanityPost }
  | { status: "not-found" }
  | { status: "error"; message: string };

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

    async function fetchPost() {
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

        const data = (await res.json()) as SanityPost;
        setState({ status: "found", post: data });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setState({ status: "error", message: msg });
        }
      }
    }

    fetchPost();
    return () => { cancelled = true; };
  }, [id]);

  if (state.status === "not-found") {
    // Trigger Next.js 404 page
    notFound();
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Carregando rascunho…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive text-sm">
          Falha ao carregar: {state.message}
        </p>
      </div>
    );
  }

  const { post } = state;

  return (
    <EditorShell
      initialPost={post}
      draftId={id}
    />
  );
}
