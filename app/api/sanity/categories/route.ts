/**
 * POST /api/sanity/categories
 *
 * Creates a new Sanity `category` document with the operator-supplied title,
 * tagname (slug), and language. Used by the inline "+ Nova categoria" button
 * in publish-section-taxonomy so the operator doesn't have to bounce to the
 * Sanity Studio mid-publish.
 *
 * Returns: { ok: true, category: { _id, title, tagname, slug, language } }
 * Errors:
 *   401 — no session
 *   400 — validation failure
 *   409 — tagname already exists for this language
 *   500 — Sanity write failure
 *
 * S10 hotfix.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";

const createCategorySchema = z.object({
  title: z.string().min(2, "Título mínimo 2 caracteres").max(80),
  tagname: z
    .string()
    .min(2, "Tagname mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Tagname: apenas lowercase, números e hífens"),
  language: z.enum(["pt-br", "en"]),
});

const TAGNAME_COLLISION_QUERY = `
  *[_type == "category" && tagname == $tagname && language == $language][0]
  { _id }
`.trim();

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

  const parsed = createCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { title, tagname, language } = parsed.data;
  const client = getSanityClient();

  try {
    const collision = await client.fetch<{ _id: string } | null>(
      TAGNAME_COLLISION_QUERY,
      { tagname, language },
    );
    if (collision) {
      return NextResponse.json(
        { error: `Tagname "${tagname}" já existe para o idioma ${language}` },
        { status: 409 },
      );
    }

    const created = await client.create({
      _id: `category.${nanoid(12)}`,
      _type: "category",
      title,
      tagname,
      language,
      slug: { _type: "slug", current: tagname },
    });

    return NextResponse.json(
      {
        ok: true,
        category: {
          _id: created._id,
          title,
          tagname,
          slug: tagname,
          language,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.categories] create failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
