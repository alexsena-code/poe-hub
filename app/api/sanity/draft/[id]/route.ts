import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { saveDraft, deleteDraft } from "@/lib/sanity/publish";
import type { SanityPost } from "@/lib/sanity/types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sanity/draft/[id]
 *
 * Fetches a single draft by bare ID (without `drafts.` prefix).
 * Returns 404 if the draft does not exist in Sanity.
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

  return NextResponse.json(draft, { status: 200 });
}

/**
 * PUT /api/sanity/draft/[id]
 *
 * Creates or updates a draft document. The `id` param is the bare post ID
 * (without `drafts.` prefix). Body should be a partial or full SanityPost.
 * Returns { id: string } with the resulting draft document ID.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const post = body as Partial<SanityPost> & { _type: "post"; id?: string };

  try {
    const result = await saveDraft({ ...post, _type: "post", id });
    return NextResponse.json({ id: result.id }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.draft] PUT draft "${id}" failed: ${message}`);
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
