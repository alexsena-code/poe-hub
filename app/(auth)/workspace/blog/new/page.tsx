'use client';
/**
 * New blog post page — client wrapper.
 *
 * Generates two fresh draft IDs (PT-BR + EN) and a `translation.metadata`
 * document linking them, so the operator gets the bilingual editor toggle
 * from the moment the post is created. Without this pre-pairing, /new
 * starts as single-mode and the toggle only appears after the operator
 * manually creates a translation in Sanity Studio.
 *
 * Why two draftIds + an explicit pair: the autosave layer doesn't know
 * about pairing; the page is the only place that knows it just minted two
 * fresh ids that should be siblings. We POST /api/sanity/translation-pair
 * once on mount (gated by useRef) and pass both ids to EditorShell.
 *
 * Re-mount caveat: if the operator reloads /new without saving anything,
 * the metadata doc lingers as an orphan referencing two never-saved ids.
 * Acceptable for an MVP — Sanity drops orphan metadata when both refs
 * resolve to nothing. If this becomes noise, switch to lazy pairing on
 * first autosave instead.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { EditorShell } from "@/components/editor/editor-shell";

export default function NewBlogPostPage() {
  // Stable across re-renders for the lifetime of this page mount.
  // nanoid(21) → 21-char URL-safe string, collision-free for our drafts scope.
  const ptDraftId = useMemo(() => nanoid(21), []);
  const enDraftId = useMemo(() => nanoid(21), []);

  const pairedRef = useRef(false);
  const [pairReady, setPairReady] = useState(false);

  useEffect(() => {
    if (pairedRef.current) return;
    pairedRef.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/sanity/translation-pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ptId: ptDraftId, enId: enDraftId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setPairReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "erro desconhecido";
        // Pair failure isn't fatal — operator can still edit the PT draft as
        // single-mode. Surface the error so they know the EN side won't be
        // wired up until they retry.
        toast.error("Falha ao parear PT/EN", { description: message });
        setPairReady(true);
      }
    })();
  }, [ptDraftId, enDraftId]);

  // Avoid mounting EditorShell with sibling before the pair POST resolves —
  // otherwise the EN autosave fires first and writes to a draft that has
  // no translation.metadata yet (would still work, but the GET sibling
  // endpoint relies on the metadata existing).
  if (!pairReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Preparando rascunhos PT-BR e EN…
      </div>
    );
  }

  return (
    <EditorShell
      draftId={ptDraftId}
      defaultLanguage="pt-br"
      sibling={{
        draftId: enDraftId,
        language: "en",
      }}
    />
  );
}
