import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { deletePost } from "@/lib/sanity/publish";
import { sanityPostToEditorMeta } from "@/lib/sanity/transform";
import { editorDraftMetaSchema } from "@/components/editor/editor-meta-schema";
import type { SanityReference, SanityImageRef } from "@/lib/sanity/types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── PUT request schema ───────────────────────────────────────────────────────

/**
 * Partial meta schema for draft saves.
 *
 * Uses `editorDraftMetaSchema` (lenient — accepts empty strings/arrays) so
 * imported guides and fresh /new drafts can be persisted before the operator
 * fills required fields like categoryId/authorId/tags. Strict validation
 * still happens at publish time via `editorMetaSchema`.
 *
 * Session 10 hotfix (post-S10.e): autosave was 400'ing on imported drafts
 * because the strict schema rejected empty IDs.
 */
const draftPutSchema = z.object({
  meta: editorDraftMetaSchema,
  body: z.array(z.unknown()).optional(),
});

type DraftPutBody = z.infer<typeof draftPutSchema>;

// ─── Reference builders ───────────────────────────────────────────────────────

function toRef(id: string | undefined): SanityReference | undefined {
  if (!id || id.trim() === "") return undefined;
  return { _type: "reference", _ref: id };
}

function toMainImage(assetId: string | undefined): SanityImageRef | undefined {
  if (!assetId || assetId.trim() === "") return undefined;
  return { _type: "image", asset: { _type: "reference", _ref: assetId } };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/sanity/draft/[id]
 *
 * Fetches a post and returns EditorMetaForm-friendly values:
 * - category._ref → categoryId
 * - author._ref → authorId
 * - mainImage.asset._ref → mainImageAssetId
 * - slug.current → slug (string)
 *
 * Lookup precedence: `drafts.<id>` first (in-progress edits) → `<id>`
 * (published doc) as fallback. Without the fallback, posts that have only a
 * published variant (no draft yet) returned 404, blocking the operator from
 * opening them in the editor. With the fallback, opening a published-only
 * post loads its content; the next autosave PUT writes to `drafts.<id>` so
 * the published doc stays untouched until republish.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = getSanityClient();
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  let doc: Record<string, unknown> | null = null;
  try {
    const draftDoc = await client.getDocument(draftId);
    doc = (draftDoc as Record<string, unknown> | null | undefined) ?? null;
    if (!doc) {
      const publishedDoc = await client.getDocument(baseId);
      doc = (publishedDoc as Record<string, unknown> | null | undefined) ?? null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] GET "${baseId}" failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!doc) {
    return NextResponse.json(
      { error: `Post not found (tried both ${draftId} and ${baseId})` },
      { status: 404 },
    );
  }

  const meta = sanityPostToEditorMeta(doc);
  const body = (doc.body as unknown[] | undefined) ?? [];

  return NextResponse.json({ meta, body, draftId: id }, { status: 200 });
}

/**
 * PUT /api/sanity/draft/[id]
 *
 * Creates or updates a Sanity draft (drafts.<id>) from partial editor meta.
 * Accepts the hub's natural form shape — converts IDs to Sanity references
 * server-side so callers never need to know the reference structure.
 *
 * Only `language` is required in meta; all other fields are optional so
 * incremental autosaves work even before the operator fills every field.
 *
 * Returns: { ok: true, draftId: string, savedAt: string }
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = draftPutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { meta, body } = parsed.data as DraftPutBody;

  // Build the Sanity draft document with partial fields.
  // Only include reference fields when the corresponding ID is present.
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  const categoryRef = toRef(meta.categoryId);
  const authorRef = toRef(meta.authorId);
  const mainImage = toMainImage(meta.mainImageAssetId);

  const draftDoc: Record<string, unknown> = {
    _id: draftId,
    _type: "post",
    language: meta.language,
    ...(meta.title !== undefined ? { title: meta.title } : {}),
    ...(meta.metadata !== undefined ? { metadata: meta.metadata } : {}),
    ...(meta.slug !== undefined
      ? { slug: { _type: "slug", current: meta.slug } }
      : {}),
    ...(meta.gameVersion !== undefined ? { gameVersion: meta.gameVersion } : {}),
    ...(categoryRef ? { category: categoryRef } : {}),
    ...(authorRef ? { author: authorRef } : {}),
    ...(meta.tags !== undefined ? { tags: meta.tags } : {}),
    ...(mainImage ? { mainImage } : {}),
    ...(meta.publishedAt !== undefined ? { publishedAt: meta.publishedAt } : {}),
    ...(body !== undefined ? { body } : {}),
  };

  try {
    const client = getSanityClient();
    await client.createOrReplace(
      draftDoc as Parameters<typeof client.createOrReplace>[0],
    );

    return NextResponse.json(
      { ok: true, draftId: baseId, savedAt: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] PUT draft "${draftId}" failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/sanity/draft/[id]
 *
 * Removes BOTH the draft (`drafts.<id>`) and the published (`<id>`) variants
 * of the post in a single Sanity transaction. The route name is historical
 * (it predates the published-delete capability) — the operation is now
 * "delete the entire post regardless of which variants exist."
 *
 * Accepts bare ID or `drafts.`-prefixed ID. Returns 204 No Content on success.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deletePost(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] DELETE post "${id}" failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
