/**
 * GROQ queries for the hub's Sanity integration.
 * All queries are typed via the corresponding TypeScript interfaces in types.ts.
 *
 * Naming convention: LIST_* for collections, FETCH_* for single docs,
 * *_QUERY suffix to disambiguate from other exports in the same file.
 */

import type { SanityPost, AuthorRef, CategoryRef } from "./types";

// Re-export for consumers that want result types alongside queries.
export type { SanityPost, AuthorRef, CategoryRef };

// ─── Draft queries ─────────────────────────────────────────────────────────────

/**
 * All documents in the `drafts.**` path, type=post, newest first.
 * Sanity stores drafts with `_id` prefixed `drafts.` — querying the `path()`
 * function is the canonical way to fetch them.
 */
export const LIST_DRAFTS_QUERY = `
  *[_id in path("drafts.**") && _type == "post"]
  | order(_updatedAt desc) {
    _id,
    _type,
    _updatedAt,
    language,
    title,
    metadata,
    gameVersion,
    slug,
    tags,
    publishedAt,
    author,
    category,
    mainImage
  }
`.trim();

export type DraftListItem = Pick<
  SanityPost,
  | "_id"
  | "_type"
  | "_updatedAt"
  | "language"
  | "title"
  | "metadata"
  | "gameVersion"
  | "slug"
  | "tags"
  | "publishedAt"
  | "author"
  | "category"
  | "mainImage"
>;

// ─── Published queries ─────────────────────────────────────────────────────────

/**
 * All published posts (no `drafts.` prefix), newest publishedAt first.
 * Does not include `body` to keep list responses lightweight.
 */
export const LIST_PUBLISHED_QUERY = `
  *[_type == "post" && !(_id in path("drafts.**"))]
  | order(publishedAt desc) {
    _id,
    _type,
    _updatedAt,
    language,
    title,
    metadata,
    gameVersion,
    slug,
    tags,
    publishedAt,
    author,
    category,
    mainImage
  }
`.trim();

export type PublishedListItem = DraftListItem;

// ─── Single post ───────────────────────────────────────────────────────────────

/**
 * Fetch a single post by `_id`. Accepts both draft and published IDs —
 * pass the bare ID (e.g. `"abc123"`) and this query matches either
 * `"abc123"` (published) OR `"drafts.abc123"` (draft).
 *
 * Parameters: `{ id: string }`
 */
export const FETCH_POST_QUERY = `
  *[_type == "post" && (_id == $id || _id == "drafts." + $id)][0] {
    _id,
    _type,
    _rev,
    _createdAt,
    _updatedAt,
    language,
    title,
    metadata,
    gameVersion,
    slug,
    tags,
    publishedAt,
    author,
    category,
    mainImage,
    body
  }
`.trim();

export type FetchPostResult = SanityPost | null;

// ─── Authors ───────────────────────────────────────────────────────────────────

/**
 * All author documents — minimal projection for autocomplete / dropdowns.
 * Returns flattened `slug` string (slug.current).
 */
export const FETCH_AUTHORS_QUERY = `
  *[_type == "author"] {
    _id,
    name,
    "slug": slug.current,
    image
  }
`.trim();

// ─── Categories ────────────────────────────────────────────────────────────────

/**
 * Categories filtered by language — minimal projection for dropdowns.
 * Returns flattened `slug` string (slug.current).
 *
 * Parameters: `{ language: string }`
 */
export const FETCH_CATEGORIES_QUERY = `
  *[_type == "category" && language == $language] {
    _id,
    tagname,
    title,
    "slug": slug.current
  }
`.trim();

// ─── Build Overview queries ──────────────────────────────────────────────────

export const LIST_BUILD_OVERVIEWS_QUERY = `
  *[_type == "buildOverview" && !(_id in path("drafts.**"))]
  | order(_updatedAt desc) {
    _id,
    _type,
    _updatedAt,
    "slug": slug.current,
    "sectionCount": count(sections)
  }
`.trim();

export type BuildOverviewListItem = {
  _id: string;
  _type: "buildOverview";
  _updatedAt: string;
  slug: string;
  sectionCount: number;
};

export const FETCH_BUILD_OVERVIEW_BY_SLUG_QUERY = `
  *[_type == "buildOverview" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
    _id,
    _type,
    _rev,
    _createdAt,
    _updatedAt,
    slug,
    sections[] {
      _key,
      _type,
      heading,
      body
    }
  }
`.trim();
