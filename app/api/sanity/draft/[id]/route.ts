import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { deleteDraft } from "@/lib/sanity/publish";
import { sanityPostToEditorMeta } from "@/lib/sanity/transform";
import { editorMetaSchema } from "@/components/editor/editor-meta-schema";
import type { SanityReference, SanityImageRef } from "@/lib/sanity/types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── PUT request schema ───────────────────────────────────────────────────────

/**
 * Partial meta schema for draft saves.
 *
 * `language` is the only required field — it disambiguates PT-BR vs EN drafts.
 * All other fields are optional because Sanity drafts tolerate partial state.
 *
 * Session 10.c: switched from accepting a raw SanityPost (which the caller had
 * to pre-shape) to accepting editor-native fields (IDs instead of references).
 */
const draftPutSchema = z.object({
  meta: editorMetaSchema.partial().extend({
    language: z.enum(["pt-br", "en"]),
  }),
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
 * Fetches a draft and returns EditorMetaForm-friendly values:
 * - category._ref → categoryId
 * - author._ref → authorId
 * - mainImage.asset._ref → mainImageAssetId
 * - slug.current → slug (string)
 *
 * Session 10.c: added reverse transform so caller gets form-ready values
 * instead of raw Sanity shapes.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = getSanityClient();
  const draftId = `drafts.${id.replace(/^drafts\./, "")}`;

  let draft: Record<string, unknown> | null = null;
  try {
    const fetched = await client.getDocument(draftId);
    draft = (fetched as Record<string, unknown> | null | undefined) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] GET draft "${draftId}" failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!draft) {
    return NextResponse.json({ error: `Draft not found: ${draftId}` }, { status: 404 });
  }

  // Transform to editor-friendly shape before returning.
  const meta = sanityPostToEditorMeta(draft);
  const body = (draft.body as unknown[] | undefined) ?? [];

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
 * Deletes a draft from Sanity. Accepts bare ID or `drafts.`-prefixed ID.
 * Returns 204 No Content on success.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteDraft(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] DELETE draft "${id}" failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
