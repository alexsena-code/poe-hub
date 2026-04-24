import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { authOptions } from "@/lib/auth";
import { publishPost, sanityPostSchema } from "@/lib/sanity/publish";
import { getSanityClient } from "@/lib/sanity/client";
import { editorMetaToSanityPost } from "@/lib/sanity/transform";
import { editorMetaSchema } from "@/components/editor/editor-meta-schema";
import type { PortableTextContent } from "@/lib/sanity/types";

// ─── Request schema ───────────────────────────────────────────────────────────

/**
 * New body shape for POST /api/sanity/publish.
 *
 * Replaces the old shape that sent a pre-formed SanityPost. The route now
 * accepts the editor's natural form values and transforms them server-side
 * (editorMetaToSanityPost). This is the fix for the publish blocker where
 * categoryId/authorId were sent as raw IDs instead of Sanity references.
 *
 * Session 10.c.
 */
const publishRequestSchema = z.object({
  meta: editorMetaSchema,
  body: z.array(z.unknown()).min(1, "body must contain at least one block"),
  draftId: z.string().min(1, "draftId is required"),
});

type PublishRequest = z.infer<typeof publishRequestSchema>;

// ─── Slug collision query ─────────────────────────────────────────────────────

/**
 * GROQ query: find any published post (no `drafts.` prefix) with the same
 * slug AND the same language, excluding the document being published.
 *
 * Two posts CAN share a slug across languages — they are separate Sanity
 * documents (pt-br vs en). Only same-language collisions are an error.
 */
const SLUG_COLLISION_QUERY = `
  *[_type == "post"
    && !(_id in path("drafts.**"))
    && slug.current == $slug
    && language == $language
    && _id != $draftId
  ][0] { _id, slug, language }
`.trim();

interface SlugCollisionResult {
  _id: string;
  slug: { _type: string; current: string };
  language: string;
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/sanity/publish
 *
 * Accepts the editor's natural form shape (meta + body + draftId),
 * transforms it to Sanity references, checks for slug collisions within
 * the same language, then publishes to the Sanity dataset.
 *
 * Returns: { ok: true, postId: string, slug: string, language: string }
 * Errors:
 *   401 — no session
 *   400 — validation failure
 *   409 — slug already used for this language by another post
 *   500 — Sanity write failure
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // DEBUG: dump shape of received payload so we can see which field is empty
  // when validation fails. Remove once publish flow is stable.
  const rawShape = rawBody as Record<string, unknown>;
  const metaShape = (rawShape?.meta ?? {}) as Record<string, unknown>;
  const bodyArr = (rawShape?.body ?? []) as unknown[];
  console.log("[publish] received payload:", {
    draftId: rawShape?.draftId,
    metaKeys: Object.keys(metaShape),
    metaValues: Object.fromEntries(
      Object.entries(metaShape).map(([k, v]) => [
        k,
        typeof v === "string" ? `"${v.slice(0, 60)}"` : Array.isArray(v) ? `[len=${v.length}]` : v,
      ]),
    ),
    bodyLen: Array.isArray(bodyArr) ? bodyArr.length : "not-array",
    firstBlock: Array.isArray(bodyArr) ? bodyArr[0] : null,
  });

  const parsed = publishRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.error("[publish] validation failed:", parsed.error.issues);
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { meta, body, draftId } = parsed.data as PublishRequest;

  // Check for same-language slug collision in published documents only.
  const collisionError = await checkSlugCollision(meta.slug, meta.language, draftId);
  if (collisionError) return collisionError;

  let sanityDoc;
  try {
    sanityDoc = editorMetaToSanityPost(meta, body as PortableTextContent[], {
      draftId,
      isPublish: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transform error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Defense-in-depth: validate the transformed doc before writing.
  const docParsed = sanityPostSchema.safeParse(sanityDoc);
  if (!docParsed.success) {
    console.error("[publish] transformed-doc schema failed:", docParsed.error.issues);
    console.error("[publish] sanityDoc shape:", {
      keys: Object.keys(sanityDoc as Record<string, unknown>),
      _type: (sanityDoc as Record<string, unknown>)._type,
      _id: (sanityDoc as Record<string, unknown>)._id,
    });
    return NextResponse.json(
      { error: "Transformed document failed schema validation", details: docParsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const published = await publishPost(docParsed.data);
    return NextResponse.json(
      {
        ok: true,
        postId: published._id,
        slug: published.slug.current,
        language: published.language,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.publish] POST /api/sanity/publish failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a 409 response if the slug is already in use for the same language, null otherwise. */
async function checkSlugCollision(
  slug: string,
  language: string,
  draftId: string,
): Promise<NextResponse | null> {
  try {
    const client = getSanityClient();
    const existing = await client.fetch<SlugCollisionResult | null>(
      SLUG_COLLISION_QUERY,
      { slug, language, draftId },
    );
    if (!existing) return null;

    return NextResponse.json(
      {
        error: "Slug já em uso para este idioma",
        existingId: existing._id,
        slug,
        language,
      },
      { status: 409 },
    );
  } catch (err) {
    // If the collision check itself fails, log and continue — better to
    // let Sanity enforce uniqueness than to block a valid publish.
    console.warn(
      `[sanity.publish] slug collision check failed (slug="${slug}"): ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}
