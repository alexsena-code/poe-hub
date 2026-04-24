import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import {
  FETCH_AUTHORS_QUERY,
  FETCH_CATEGORIES_QUERY,
} from "@/lib/sanity/queries";
import type { AuthorRef, CategoryRef } from "@/lib/sanity/types";

/**
 * GET /api/sanity/refs?kind=authors
 * GET /api/sanity/refs?kind=categories&language=pt-br
 *
 * Returns reference data for autocomplete dropdowns in the blog editor.
 * Auth-gated — the Sanity client uses the write token which must not leak.
 *
 * `kind` is required. `language` is required when kind=categories.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const kind = searchParams.get("kind");

  if (!kind) {
    return NextResponse.json(
      { error: "Missing required query param: kind (authors | categories)" },
      { status: 400 }
    );
  }

  const client = getSanityClient();

  if (kind === "authors") {
    try {
      const authors: AuthorRef[] = await client.fetch(FETCH_AUTHORS_QUERY);
      return NextResponse.json(authors, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sanity.refs] failed to fetch authors: ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (kind === "categories") {
    const language = searchParams.get("language");
    if (!language) {
      return NextResponse.json(
        { error: "Missing required query param: language (pt-br | en) when kind=categories" },
        { status: 400 }
      );
    }

    if (language !== "pt-br" && language !== "en") {
      return NextResponse.json(
        { error: `Invalid language: "${language}" (expected: pt-br | en)` },
        { status: 400 }
      );
    }

    try {
      const categories: CategoryRef[] = await client.fetch(FETCH_CATEGORIES_QUERY, { language });
      return NextResponse.json(categories, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sanity.refs] failed to fetch categories (language=${language}): ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: `Unknown kind: "${kind}" (supported: authors | categories)` },
    { status: 400 }
  );
}
