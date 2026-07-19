import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { FETCH_BUILD_OVERVIEW_BY_SLUG_QUERY } from "@/lib/sanity/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const client = getSanityClient();
    const doc = await client.fetch(FETCH_BUILD_OVERVIEW_BY_SLUG_QUERY, {
      slug: id,
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(doc);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[sanity/build-overview] GET ${id} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { sections: any[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.sections)) {
    return NextResponse.json(
      { error: "sections must be an array" },
      { status: 400 },
    );
  }

  try {
    const client = getSanityClient();

    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "buildOverview" && slug.current == $slug && !(_id in path("drafts.**"))][0] { _id }`,
      { slug: id },
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sections = body.sections.map((s: any, i: number) => ({
      _key: s._key || `section-${i}-${Date.now()}`,
      _type: "contentSection",
      heading: s.heading || undefined,
      body: s.body || undefined,
    }));

    await client
      .patch(existing._id)
      .set({ sections })
      .commit();

    return NextResponse.json({ updated: true, _id: existing._id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[sanity/build-overview] PUT ${id} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const client = getSanityClient();
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "buildOverview" && slug.current == $slug && !(_id in path("drafts.**"))][0] { _id }`,
      { slug: id },
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await client.delete(existing._id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[sanity/build-overview] DELETE ${id} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
