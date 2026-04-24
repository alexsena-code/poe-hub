/**
 * Smoke test for Sanity publish flow — exercises real write token against
 * the live dataset, creating a throwaway post and cleaning it up.
 *
 * Skipped by default so the regular suite never hits Sanity. Opt-in via:
 *   SMOKE_SANITY=1 npx vitest run lib/sanity/__tests__/publish.smoke.test.ts
 *
 * Requires `SANITY_API_WRITE_TOKEN`, `SANITY_PROJECT_ID`, `SANITY_DATASET`,
 * `SANITY_API_VERSION` in the environment (already set in `.env` for the
 * local dev box; CI runners would need them piped in).
 *
 * Carryover 4 — session 11 → session 12.
 */

import { describe, it, expect } from "vitest";
import { getSanityClient } from "../client";
import { publishPost } from "../publish";
import type { SanityPostInput } from "../publish";

const ENABLED =
  process.env.SMOKE_SANITY === "1" && Boolean(process.env.SANITY_API_WRITE_TOKEN);

interface FirstRef {
  _id: string;
}

async function pickFirstRef(type: "category" | "author"): Promise<string> {
  const client = getSanityClient();
  const row = await client.fetch<FirstRef | null>(
    `*[_type == $type && !(_id in path("drafts.**"))][0]{ _id }`,
    { type },
  );
  if (!row?._id) {
    throw new Error(
      `[smoke] no published ${type} found in Sanity — seed one before running`,
    );
  }
  return row._id;
}

function buildMinimalPost(opts: {
  id: string;
  slug: string;
  categoryId: string;
  authorId: string;
}): SanityPostInput {
  return {
    _id: opts.id,
    _type: "post",
    language: "en",
    title: `Smoke test ${opts.slug}`,
    metadata: "Automated smoke test from hub — safe to delete.",
    gameVersion: "path-of-exile-1",
    category: { _type: "reference", _ref: opts.categoryId },
    slug: { _type: "slug", current: opts.slug },
    tags: ["smoke-test"],
    author: { _type: "reference", _ref: opts.authorId },
    publishedAt: new Date().toISOString(),
    body: [
      {
        _type: "block",
        _key: "block-smoke-1",
        style: "normal",
        markDefs: [],
        children: [
          {
            _type: "span",
            _key: "span-smoke-1",
            text: "Smoke test body content.",
            marks: [],
          },
        ],
      },
    ],
  };
}

describe.skipIf(!ENABLED)("Sanity publish smoke", () => {
  it("publishes a minimal post and cleans up", async () => {
    const client = getSanityClient();
    const timestamp = Date.now();
    const baseId = `smoke-${timestamp}`;
    const slug = `smoke-${timestamp}`;

    const [categoryId, authorId] = await Promise.all([
      pickFirstRef("category"),
      pickFirstRef("author"),
    ]);

    const doc = buildMinimalPost({ id: baseId, slug, categoryId, authorId });

    let publishedId: string | null = null;
    try {
      const published = await publishPost(doc);
      publishedId = published._id;

      expect(published._id).toBe(baseId);
      expect(published.slug.current).toBe(slug);
      expect(published.language).toBe("en");
      expect(published.title).toBe(`Smoke test ${slug}`);
    } finally {
      if (publishedId) {
        await client.delete(publishedId).catch((err) => {
          console.warn(
            `[smoke] cleanup failed for "${publishedId}": ${
              err instanceof Error ? err.message : err
            }`,
          );
        });
      }
    }
  }, 30_000);
});
