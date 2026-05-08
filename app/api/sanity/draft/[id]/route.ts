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
 *
 * The response also includes `languageFromI18n` — the `_key` of the
 * `translation.metadata` entry that points at this post — when one exists.
 * That's the authoritative language because the i18n plugin sets it when the
 * pair is created and never changes it. The `meta.language` field on the
 * doc itself can drift (e.g. autosave bugs once persisted both PT/EN drafts
 * with `language: "en"`); callers should prefer `languageFromI18n` over
 * `meta.language` when present so the editor heals the wrong value on the
 * next autosave.
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
  let languageFromI18n: "pt-br" | "en" | null = null;
  let draftExists = false;
  let publishedExists = false;
  try {
    const draftDoc = await client.getDocument(draftId);
    const publishedDoc = await client.getDocument(baseId);
    draftExists = !!draftDoc;
    publishedExists = !!publishedDoc;
    doc =
      (draftDoc as Record<string, unknown> | null | undefined) ??
      (publishedDoc as Record<string, unknown> | null | undefined) ??
      null;

    // Look up the translation.metadata entry pointing at this post and return
    // its _key as the authoritative language.
    const i18nQuery = `*[
      _type == "translation.metadata" &&
      (references($publishedId) || references($draftId))
    ][0].translations[value._ref in [$publishedId, $draftId]][0]._key`;
    const key = (await client.fetch<string | null>(i18nQuery, {
      publishedId: baseId,
      draftId,
    })) ?? null;
    if (key === "pt-br" || key === "en") {
      languageFromI18n = key;
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

  // Self-heal: when the doc's language drifted from the i18n key (a known
  // historical autosave bug saved both PT/EN drafts as "en"), patch the doc
  // back to the authoritative value. Side-effect on a GET is a deliberate
  // tradeoff — without it, posts with empty bodies (autosave gated by
  // isBodyEmpty) never get a chance to fix their language and the publish
  // form would persist the wrong value forever.
  if (
    languageFromI18n &&
    meta.language !== languageFromI18n &&
    typeof doc._id === "string"
  ) {
    try {
      await client
        .patch(doc._id)
        .set({ language: languageFromI18n })
        .commit();
      meta.language = languageFromI18n;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(
        `[sanity.draft] heal-language patch failed for "${doc._id}": ${message}`,
      );
    }
  }

  return NextResponse.json(
    {
      meta,
      body,
      draftId: id,
      languageFromI18n,
      status: { draft: draftExists, published: publishedExists },
    },
    { status: 200 },
  );
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

  // Build the partial fields to write — only include what the caller sent.
  // Reference fields are wrapped only when their corresponding ID is present.
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  const categoryRef = toRef(meta.categoryId);
  const authorRef = toRef(meta.authorId);
  const mainImage = toMainImage(meta.mainImageAssetId);

  const fields: Record<string, unknown> = {
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

    // Strategy — preserve any field not explicitly in the patch payload:
    //  1. Draft already exists → patch().set(fields). Untouched fields
    //     (notably `body` when publish-form patches only meta) stay intact.
    //  2. Draft doesn't exist but published does → clone published into a
    //     draft first (so the new draft starts with the published body /
    //     other fields), then patch the editor fields on top. Without this
    //     step, editing a published-only post via /publish silently wipes
    //     the body to nothing on the first meta-only patch.
    //  3. Neither exists (fresh /new draft) → createIfNotExists with the
    //     fields we have. Sanity tolerates partial draft documents.
    const existingDraft = await client.getDocument(draftId);
    if (!existingDraft) {
      const published = await client.getDocument(baseId);
      if (published) {
        // Clone published doc structure into the draft, stripping system
        // fields that Sanity manages itself.
        const cloned: Record<string, unknown> = { ...(published as Record<string, unknown>) };
        delete cloned._id;
        delete cloned._rev;
        delete cloned._createdAt;
        delete cloned._updatedAt;
        await client.createIfNotExists({
          _id: draftId,
          _type: "post",
          ...cloned,
        } as Parameters<typeof client.createIfNotExists>[0]);
        // Apply the editor's patch on top of the cloned content.
        await client.patch(draftId).set(fields).commit();
      } else {
        await client.createIfNotExists({
          _id: draftId,
          _type: "post",
          ...fields,
        } as Parameters<typeof client.createIfNotExists>[0]);
      }
    } else {
      await client.patch(draftId).set(fields).commit();
    }

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
