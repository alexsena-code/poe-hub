/**
 * POST /api/sanity/draft-from-guide
 *
 * Creates one Sanity draft per requested language from a guide slug fetched
 * from the engine. Designed for the "Editar no Blog" button in
 * /workspace/guides/[slug].
 *
 * Flow:
 *   1. Validate auth.
 *   2. Parse + validate body ({ guideSlug, languages? }).
 *   3. Fetch the guide from the engine via the existing /api/engine proxy.
 *   4. For each language: concat all sections, prepend h1 title, convert
 *      Markdown → Portable Text, create the Sanity draft.
 *   5. Return { drafts: [{ id, language, slug, title }] }.
 *
 * Session 10.e.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { markdownToPortableText } from "@/lib/converters/markdown-to-portable";
import type { PostDetail } from "@/lib/content-api";

// ─── Request schema ───────────────────────────────────────────────────────────

const draftFromGuideSchema = z.object({
  guideSlug: z.string().min(1, "guideSlug is required"),
  languages: z.array(z.enum(["pt-br", "en"])).optional(),
});

type DraftFromGuideBody = z.infer<typeof draftFromGuideSchema>;

// ─── Response type ────────────────────────────────────────────────────────────

interface DraftRef {
  id: string;
  language: "pt-br" | "en";
  slug: string;
  title: string;
}

// ─── Engine fetch ─────────────────────────────────────────────────────────────

/**
 * Fetches a guide from the engine API.
 * Returns null when the engine responds with 404.
 * Throws on other non-OK responses.
 */
async function fetchGuideFromEngine(
  slug: string,
  request: NextRequest,
): Promise<PostDetail | null> {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const cookie = request.headers.get("cookie") ?? "";

  const url = `${proto}://${host}/api/engine/content/posts/${encodeURIComponent(slug)}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { cookie },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(
      `[draft-from-guide] engine fetch failed for slug "${slug}": ${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<PostDetail>;
}

// ─── Markdown assembly ────────────────────────────────────────────────────────

/**
 * Concatenates all sections for a given language into one Markdown string.
 * Prepends a top-level h1 title if the first section doesn't already start
 * with one.
 */
function assembleMarkdown(guide: PostDetail, lang: "pt-br" | "en"): string {
  const title = guide.title[lang] ?? guide.title.en ?? guide.slug;
  const sortedSections = [...(guide.sections ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  const bodyParts = sortedSections.map((s) => {
    const content = s.content[lang] ?? s.content.en ?? "";
    const heading = s.heading ? `## ${s.heading}\n\n` : "";
    return `${heading}${content}`;
  });

  const body = bodyParts.join("\n\n");

  // Prepend h1 title only if the markdown doesn't already open with one.
  const startsWithH1 = body.trimStart().startsWith("# ");
  return startsWithH1 ? body : `# ${title}\n\n${body}`;
}

// ─── Draft creation ───────────────────────────────────────────────────────────

async function createGuideDraft(
  guide: PostDetail,
  lang: "pt-br" | "en",
): Promise<DraftRef> {
  const draftId = nanoid(21);
  const fullMd = assembleMarkdown(guide, lang);
  const body = markdownToPortableText(fullMd);

  const title = guide.title[lang] ?? guide.title.en ?? guide.slug;
  const description = guide.meta?.description?.[lang] ?? "";
  const guideAsRecord = guide as unknown as Record<string, unknown>;
  const tags = Array.isArray(guideAsRecord.tags)
    ? (guideAsRecord.tags as string[])
    : [];

  const draftDoc: Record<string, unknown> = {
    _id: `drafts.${draftId}`,
    _type: "post",
    language: lang,
    title,
    metadata: description,
    slug: { _type: "slug", current: guide.slug },
    gameVersion: "path-of-exile-2",
    tags,
    publishedAt: new Date().toISOString().slice(0, 16),
    body,
  };

  const client = getSanityClient();
  await client.createOrReplace(
    draftDoc as Parameters<typeof client.createOrReplace>[0],
  );

  return { id: draftId, language: lang, slug: guide.slug, title };
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  const parsed = draftFromGuideSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { guideSlug, languages = ["pt-br", "en"] }: DraftFromGuideBody = parsed.data;

  let guide: PostDetail | null;
  try {
    guide = await fetchGuideFromEngine(guideSlug, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[draft-from-guide] engine error: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!guide) {
    return NextResponse.json(
      { error: `Guide not found: "${guideSlug}"` },
      { status: 404 },
    );
  }

  const drafts: DraftRef[] = [];
  for (const lang of languages) {
    try {
      const ref = await createGuideDraft(guide, lang);
      drafts.push(ref);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[draft-from-guide] failed to create draft for lang=${lang}: ${message}`);
      return NextResponse.json(
        { error: `Failed to create ${lang} draft: ${message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ drafts }, { status: 201 });
}
