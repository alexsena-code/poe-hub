/**
 * Bidirectional transform between EditorMetaForm (hub form values) and
 * the Sanity post document shape (SanityPostInput / SanityPost).
 *
 * WHY this file exists: the editor stores references as bare IDs
 * (categoryId, authorId, mainImageAssetId) but Sanity requires the
 * `{ _type: 'reference', _ref }` shape. This module is the single
 * place where that mapping lives — publish route and draft route both
 * import from here so the two sides stay consistent.
 *
 * Session 10.c.
 */

import type { EditorMetaForm } from "@/components/editor/editor-meta-schema";
import type { SanityPostInput } from "./publish";
import type { PortableTextContent, SanityReference, SanityImageRef, Language } from "./types";

// ─── Helper types ─────────────────────────────────────────────────────────────

/** Options controlling _id assignment. */
export interface TransformOptions {
  /** The base document ID (without `drafts.` prefix). */
  draftId: string;
  /**
   * When true, _id is set to `draftId` (bare — publish mode).
   * When false, _id is `drafts.<draftId>` (draft save mode).
   */
  isPublish?: boolean;
}

// ─── Forward transform (form → Sanity) ───────────────────────────────────────

/**
 * Converts a fully-populated EditorMetaForm + body into a SanityPostInput
 * ready to pass to `client.createOrReplace`.
 *
 * Throws if required ID fields are empty strings — callers receive a
 * message that includes the offending field name and value.
 *
 * @example
 * const doc = editorMetaToSanityPost(meta, body, { draftId: 'abc', isPublish: true });
 * sanityPostSchema.parse(doc); // passes
 */
export function editorMetaToSanityPost(
  meta: EditorMetaForm,
  body: PortableTextContent[],
  { draftId, isPublish = false }: TransformOptions,
): SanityPostInput {
  assertNonEmpty(meta.categoryId, "categoryId");
  assertNonEmpty(meta.authorId, "authorId");
  assertNonEmpty(draftId, "draftId");

  const docId = isPublish ? draftId : `drafts.${draftId}`;

  const categoryRef: SanityReference = {
    _type: "reference",
    _ref: meta.categoryId,
  };

  const authorRef: SanityReference = {
    _type: "reference",
    _ref: meta.authorId,
  };

  const mainImage = buildMainImageRef(meta.mainImageAssetId);

  return {
    _id: docId,
    _type: "post",
    language: meta.language,
    title: meta.title,
    metadata: meta.metadata,
    gameVersion: meta.gameVersion,
    category: categoryRef,
    slug: { _type: "slug", current: meta.slug },
    tags: meta.tags,
    author: authorRef,
    ...(mainImage ? { mainImage } : {}),
    publishedAt: meta.publishedAt,
    body,
  };
}

// ─── Reverse transform (Sanity → form) ───────────────────────────────────────

/**
 * Extracts EditorMetaForm-compatible values from a raw Sanity post document.
 * Used by GET /api/sanity/draft/[id] to return editor-friendly shapes.
 *
 * Gracefully handles missing/partial fields — returns empty strings so
 * the form can still mount without crashing on an incomplete draft.
 *
 * @example
 * const meta = sanityPostToEditorMeta(draftDoc);
 * // { title: '...', categoryId: 'cat-001', ... }
 */
export function sanityPostToEditorMeta(
  doc: Record<string, unknown>,
): EditorMetaForm {
  const category = doc.category as SanityReference | undefined;
  const author = doc.author as SanityReference | undefined;
  const slugField = doc.slug as { _type: string; current: string } | undefined;
  const mainImage = doc.mainImage as SanityImageRef | undefined;

  return {
    title: asString(doc.title),
    metadata: asString(doc.metadata),
    slug: slugField?.current ?? "",
    gameVersion: asGameVersion(doc.gameVersion),
    categoryId: category?._ref ?? "",
    authorId: author?._ref ?? "",
    tags: asStringArray(doc.tags),
    mainImageAssetId: mainImage?.asset?._ref ?? undefined,
    publishedAt: asString(doc.publishedAt) || new Date().toISOString().slice(0, 16),
    language: asLanguage(doc.language),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Throws if `value` is an empty string. */
function assertNonEmpty(value: string, field: string): void {
  if (value.trim() === "") {
    throw new Error(
      `[sanity.transform] ${field} must not be empty (got: "${value}")`,
    );
  }
}

/** Builds a mainImage field from an optional asset ID. Returns undefined if absent. */
function buildMainImageRef(assetId: string | undefined): SanityImageRef | undefined {
  if (!assetId || assetId.trim() === "") return undefined;
  return {
    _type: "image",
    asset: { _type: "reference", _ref: assetId },
  };
}

/** Coerces an unknown value to a string (empty string fallback). */
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Coerces an unknown value to a string array (empty array fallback). */
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string");
}

/** Coerces an unknown value to a valid Language (defaults to 'pt-br'). */
function asLanguage(v: unknown): Language {
  if (v === "pt-br" || v === "en") return v;
  return "pt-br";
}

/** Coerces an unknown value to a valid GameVersion (defaults to 'path-of-exile-1'). */
function asGameVersion(
  v: unknown,
): "path-of-exile-1" | "path-of-exile-2" {
  if (v === "path-of-exile-1" || v === "path-of-exile-2") return v;
  return "path-of-exile-1";
}
