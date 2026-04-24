import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishPost, sanityPostSchema } from "@/lib/sanity/publish";

/**
 * POST /api/sanity/publish
 *
 * Publishes a post document directly to the Sanity dataset (no `drafts.` prefix).
 * Body must be a valid SanityPost object — validated by the zod schema in
 * lib/sanity/publish.ts before the Sanity write is attempted.
 *
 * Returns: { _id: string, slug: string }
 * Errors: 401 (no session) | 400 (validation) | 500 (Sanity error)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sanityPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const published = await publishPost(parsed.data);
    return NextResponse.json(
      { _id: published._id, slug: published.slug.current },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sanity.publish] POST /api/sanity/publish failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
