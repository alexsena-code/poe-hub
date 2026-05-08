import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { sanityPostToEditorMeta } from "@/lib/sanity/transform";
import type { Language } from "@/lib/sanity/types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sanity/draft/[id]/sibling
 *
 * Returns the sibling-language draft of the given post via the
 * `translation.metadata` document created by Sanity's i18n plugin.
 *
 * Response shapes:
 *   200 { meta, body, draftId, language }  — sibling found
 *   200 { sibling: null }                  — no translation pair exists
 *   401 { error }                          — unauthenticated
 *   500 { error }                          — Sanity query failed
 *
 * The bilingual editor uses this to mount the EN draft alongside the PT draft
 * (or vice-versa). Imagens inseridas are broadcast to both editors so the
 * operator only pastes once.
 *
 * GROQ contract: each `translation.metadata` doc holds an array
 * `translations[]` of `{ _key: language, value: reference }`. We match on
 * either the bare ID or the `drafts.`-prefixed ID because the metadata
 * reference may point at the published id even while only the draft exists.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;
  const client = getSanityClient();

  const findQuery = `*[
    _type == "translation.metadata" &&
    (references($publishedId) || references($draftId))
  ][0]{
    translations[]{
      "language": _key,
      "ref": value._ref
    }
  }`;

  let pair: { translations?: { language: string; ref: string }[] } | null;
  try {
    pair = await client.fetch(findQuery, { publishedId: baseId, draftId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft.sibling] find failed for "${baseId}": ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const translations = pair?.translations ?? [];
  // Find the entry that does NOT match this post — that's the sibling.
  const sibling = translations.find(
    (t) => t.ref !== baseId && t.ref !== draftId,
  );
  if (!sibling) {
    return NextResponse.json({ sibling: null }, { status: 200 });
  }

  // The ref may be either the published id or `drafts.X`. Try draft first
  // because the editor cares about in-progress content; fall back to published.
  const siblingBaseId = sibling.ref.replace(/^drafts\./, "");
  const siblingDraftId = `drafts.${siblingBaseId}`;

  let doc: Record<string, unknown> | null = null;
  try {
    const draftDoc = await client.getDocument(siblingDraftId);
    doc = (draftDoc as Record<string, unknown> | null | undefined) ?? null;
    if (!doc) {
      const publishedDoc = await client.getDocument(siblingBaseId);
      doc = (publishedDoc as Record<string, unknown> | null | undefined) ?? null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[sanity.draft.sibling] fetch sibling "${siblingBaseId}" failed: ${message}`,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json({ sibling: null }, { status: 200 });
  }

  const meta = sanityPostToEditorMeta(doc);
  const body = (doc.body as unknown[] | undefined) ?? [];

  return NextResponse.json(
    {
      meta,
      body,
      draftId: siblingBaseId,
      language: sibling.language as Language,
    },
    { status: 200 },
  );
}
