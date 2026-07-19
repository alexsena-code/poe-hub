import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSanityClient } from "@/lib/sanity/client";
import { LIST_BUILD_OVERVIEWS_QUERY } from "@/lib/sanity/queries";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = getSanityClient();
    const docs = await client.fetch(LIST_BUILD_OVERVIEWS_QUERY);
    return NextResponse.json(docs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[sanity/build-overview] GET failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug } = body;
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be a lowercase alphanumeric string with hyphens" },
      { status: 400 },
    );
  }

  try {
    const client = getSanityClient();
    const doc = await client.create({
      _type: "buildOverview",
      slug: { _type: "slug", current: slug },
      sections: [],
    });
    return NextResponse.json({ _id: doc._id, slug }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[sanity/build-overview] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
