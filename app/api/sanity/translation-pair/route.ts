import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";

/**
 * POST /api/sanity/translation-pair
 *
 * Creates a `translation.metadata` document linking two posts as PT-BR ↔ EN
 * siblings. Used by /workspace/blog/new to activate the bilingual editor
 * from the moment a post is created — without this, the toggle PT/EN only
 * shows up after the operator manually creates a translation pair via
 * Sanity Studio's i18n plugin UI.
 *
 * Body: { ptId: string, enId: string }
 *   IDs are bare (no `drafts.` prefix). The metadata refs point at the bare
 *   IDs; GROQ `references()` matches both draft and published variants, so
 *   the pair survives publishing without needing to rewrite the metadata.
 *
 * Response: { ok: true, metadataId: string }
 *
 * Idempotency: the route does NOT check whether a pair already exists for
 * these IDs — caller is expected to invoke this exactly once per new post.
 * If invoked twice, two metadata docs reference the same pair and the
 * sibling lookup just picks the first one (`[0]` in the GROQ).
 */
const bodySchema = z.object({
  ptId: z.string().min(1),
  enId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { ptId, enId } = parsed.data;
  const metadataId = `translation-meta-${nanoid(12)}`;

  // Document shape matches @sanity/document-internationalization plugin output.
  // _key uses the language code; value is a reference to the post in that
  // language. schemaTypes lists the document types the metadata applies to.
  const doc = {
    _id: metadataId,
    _type: "translation.metadata",
    schemaTypes: ["post"],
    translations: [
      {
        _key: "pt-br",
        _type: "internationalizedArrayReferenceValue",
        value: { _type: "reference", _ref: ptId, _weak: true },
      },
      {
        _key: "en",
        _type: "internationalizedArrayReferenceValue",
        value: { _type: "reference", _ref: enId, _weak: true },
      },
    ],
  };

  try {
    const client = getSanityClient();
    await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[sanity.translation-pair] failed to pair ${ptId} ↔ ${enId}: ${message}`,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, metadataId }, { status: 200 });
}
