// RSC shell — fetches posts server-side and passes to interactive client island.
// S05.a migration: was 299L 'use client'; now RSC + GuidesClient island.
import { Suspense } from "react";
import { fetchEngine } from "@/lib/fetch-engine";
import { GuidesClient, type PostSummary } from "@/components/modules/workspace/guides/guides-client";

export default async function GuidesPage() {
  // Best-effort: if the engine is down, render empty list so the client island
  // can still show its "no posts" state rather than a hard 500.
  let initialPosts: PostSummary[] = [];
  try {
    const data = await fetchEngine<PostSummary[]>("/api/engine/content/posts");
    initialPosts = Array.isArray(data) ? data : [];
  } catch {
    // Engine unreachable — client island will show empty state with refresh button
  }

  return (
    <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Carregando...</div>}>
      <GuidesClient initialPosts={initialPosts} />
    </Suspense>
  );
}
