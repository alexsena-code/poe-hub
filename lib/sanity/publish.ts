import { z } from "zod";
import { getSanityClient } from "./client";
import type { SanityPost } from "./types";

// ─── Zod schema ────────────────────────────────────────────────────────────────

const sanityReferenceSchema = z.object({
  _type: z.literal("reference"),
  _ref: z.string().min(1, "reference._ref must not be empty"),
});

const sanitySlugSchema = z.object({
  _type: z.literal("slug"),
  current: z
    .string()
    .min(1, "slug.current must not be empty")
    .regex(/^[a-z0-9-]+$/, "slug.current must be lowercase alphanumeric with hyphens"),
});

const gameVersionSchema = z.enum(["path-of-exile-1", "path-of-exile-2"]);
const languageSchema = z.enum(["pt-br", "en"]);

// ─── Portable Text block sub-schemas ──────────────────────────────────────────
// These mirror the 5 accepted types in poetrade-dev/sanity/schemas/blockContent.ts.
// Any _type outside this set is silently dropped by Sanity Studio — zod catches
// it here client-side first. (Session 10 regression: poeCurrency et al. caused
// silent body drops because they were not in this allowed set.)

const portableTextSpanSchema = z.object({
  _type: z.literal("span"),
  _key: z.string().min(1, "span._key must not be empty"),
  text: z.string(),
  marks: z.array(z.string()),
});

const portableTextLinkMarkSchema = z.object({
  _type: z.literal("link"),
  _key: z.string().min(1, "link markDef._key must not be empty"),
  href: z.string().min(1, "link markDef.href must not be empty"),
  blank: z.boolean().optional(),
});

const portableTextPoeItemMarkSchema = z.object({
  _type: z.literal("poeItem"),
  _key: z.string().min(1, "poeItem markDef._key must not be empty"),
  rawText: z.string().min(1, "poeItem markDef.rawText must not be empty"),
  iconUrl: z.string().optional(),
});

const portableTextMarkDefSchema = z.discriminatedUnion("_type", [
  portableTextLinkMarkSchema,
  portableTextPoeItemMarkSchema,
]);

const portableTextBlockSchema = z.object({
  _type: z.literal("block"),
  _key: z.string().min(1, "block._key must not be empty"),
  style: z.enum(["normal", "h1", "h2", "h3", "h4", "blockquote"]),
  listItem: z.enum(["bullet", "number"]).optional(),
  level: z.number().int().min(1).optional(),
  children: z.array(portableTextSpanSchema).min(1, "block.children must contain at least one span"),
  markDefs: z.array(portableTextMarkDefSchema),
});

const portableTextImageBlockSchema = z.object({
  _type: z.literal("image"),
  _key: z.string().min(1, "image block._key must not be empty"),
  asset: sanityReferenceSchema,
  hotspot: z
    .object({ x: z.number(), y: z.number(), height: z.number(), width: z.number() })
    .optional(),
  crop: z
    .object({ top: z.number(), bottom: z.number(), left: z.number(), right: z.number() })
    .optional(),
  alt: z.string().optional(),
});

const portableTextCodeBlockSchema = z.object({
  _type: z.literal("code"),
  _key: z.string().min(1, "code block._key must not be empty"),
  code: z.string(),
  language: z.string().optional(),
});

const portableTextTableRowSchema = z.object({
  _type: z.literal("row"),
  _key: z.string().min(1, "table row._key must not be empty"),
  cells: z.array(z.string()),
});

const portableTextTableBlockSchema = z.object({
  _type: z.literal("table"),
  _key: z.string().min(1, "table block._key must not be empty"),
  rows: z.array(portableTextTableRowSchema).min(1, "table block must have at least one row"),
});

const poeItemBlockSchema = z.object({
  _type: z.literal("poeItem"),
  _key: z.string().min(1, "poeItem block._key must not be empty"),
  rawText: z.string().min(1, "poeItem block.rawText must not be empty"),
  iconUrl: z.string().optional(),
});

/**
 * Discriminated union of the 5 block types accepted by the Sanity Studio
 * blockContent schema. Zod will report the offending `_type` in the error
 * message when an unknown type (e.g. 'poeCurrency') is encountered.
 */
const portableTextContentSchema = z.discriminatedUnion("_type", [
  portableTextBlockSchema,
  portableTextImageBlockSchema,
  portableTextCodeBlockSchema,
  portableTextTableBlockSchema,
  poeItemBlockSchema,
]);

/**
 * Zod schema for a SanityPost write. Mirrors the required fields from
 * poetrade-dev/sanity/schemas/post.ts.
 * `mainImage` is optional per the schema (validation commented out there).
 * `_id`, `_rev`, `_createdAt`, `_updatedAt` are server-assigned and optional here.
 */
export const sanityPostSchema = z.object({
  _id: z.string().optional(),
  _type: z.literal("post"),
  _rev: z.string().optional(),
  _createdAt: z.string().optional(),
  _updatedAt: z.string().optional(),
  language: languageSchema,
  title: z.string().min(1, "title is required"),
  metadata: z.string().min(1, "metadata (SEO description) is required"),
  gameVersion: gameVersionSchema,
  category: sanityReferenceSchema,
  slug: sanitySlugSchema,
  tags: z
    .array(z.string().regex(/^[a-z0-9-]+$/, "tags must be lowercase alphanumeric with hyphens"))
    .min(1, "at least one tag is required"),
  author: sanityReferenceSchema,
  mainImage: z
    .object({
      _type: z.literal("image"),
      asset: sanityReferenceSchema,
    })
    .optional(),
  publishedAt: z.string().min(1, "publishedAt is required"),
  body: z
    .array(portableTextContentSchema)
    .min(1, "body must contain at least one block"),
});

export type SanityPostInput = z.infer<typeof sanityPostSchema>;

// ─── Validation helper ─────────────────────────────────────────────────────────

/**
 * Validates a post object against the zod schema.
 * Throws an Error with a newline-joined list of validation issues if invalid.
 * Called before any write to Sanity so we get clear errors client-side
 * rather than cryptic Sanity API errors.
 */
function validatePost(post: unknown): SanityPostInput {
  const result = sanityPostSchema.safeParse(post);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`[sanity.publish] validation failed:\n${issues}`);
  }
  return result.data;
}

// ─── Operations ────────────────────────────────────────────────────────────────

/**
 * Publishes a post to Sanity (no `drafts.` prefix) atomically with draft cleanup.
 *
 * Session 10 bug fix (2026-04-24): uses a Sanity transaction to createOrReplace
 * the published doc AND delete `drafts.<baseId>` in the same commit. Previously
 * the published write was isolated and the client fired a best-effort DELETE
 * after — if that failed (network, navigation, race with autosave), the draft
 * lingered. Sanity Studio renders `drafts.*` on top of the published doc, so
 * the operator would see body=Empty when in fact the published doc was fine,
 * they were looking at the zombie draft. Transaction makes publish+cleanup
 * atomic.
 *
 * Read-back via getDocument so the caller receives server-assigned `_rev` and
 * `_updatedAt`.
 */
export async function publishPost(post: unknown): Promise<SanityPost> {
  const validated = validatePost(post);
  const client = getSanityClient();

  const baseId = (validated._id ?? "").replace(/^drafts\./, "");
  if (!baseId) {
    throw new Error(
      `[sanity.publish] missing _id for publish (required so drafts.<id> can be deleted atomically): ${JSON.stringify(validated._id)}`,
    );
  }
  const doc = {
    ...validated,
    _id: baseId,
    _type: "post" as const,
  };
  const draftId = `drafts.${baseId}`;

  try {
    await client
      .transaction()
      .createOrReplace(doc as Parameters<typeof client.createOrReplace>[0])
      .delete(draftId)
      .commit();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[sanity.publish] transaction commit failed for "${validated.title}" (baseId="${baseId}"): ${message}`,
    );
  }

  const published = await client.getDocument(baseId);
  if (!published) {
    throw new Error(
      `[sanity.publish] read-back failed for "${baseId}" — document missing after commit`,
    );
  }
  return published as unknown as SanityPost;
}

/**
 * Saves or updates a draft document in Sanity.
 * Draft IDs use the `drafts.` prefix convention.
 * If `id` is provided, the draft is updated (createOrReplace);
 * otherwise, a new draft is created and its generated ID is returned.
 *
 * Does NOT validate the full schema — partial drafts are allowed.
 * Only validates that `_type == 'post'` is present.
 */
export async function saveDraft(
  post: Partial<SanityPost> & { _type: "post"; id?: string }
): Promise<{ id: string }> {
  const client = getSanityClient();
  const rawId = post.id ?? "";
  const baseId = rawId.replace(/^drafts\./, "");
  const draftId = baseId ? `drafts.${baseId}` : undefined;

  const doc = {
    ...post,
    _type: "post" as const,
    ...(draftId ? { _id: draftId } : {}),
  };

  // Remove the helper `id` field before writing — it's not a Sanity field.
  const { id: _discarded, ...cleanDoc } = doc as typeof doc & { id?: string };

  try {
    let result;
    if (draftId) {
      result = await client.createOrReplace(cleanDoc as Parameters<typeof client.createOrReplace>[0]);
    } else {
      result = await client.create({ ...cleanDoc, _type: "post" });
    }
    return { id: result._id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[sanity.publish] saveDraft failed for id="${draftId ?? "new"}": ${message}`
    );
  }
}

/**
 * Deletes a draft document from Sanity.
 * Accepts either the bare ID or the `drafts.` prefixed ID.
 */
export async function deleteDraft(id: string): Promise<void> {
  const client = getSanityClient();
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  try {
    await client.delete(draftId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[sanity.publish] deleteDraft failed for "${draftId}": ${message}`);
  }
}

/**
 * Deletes both the draft (`drafts.<id>`) and the published (`<id>`) variants
 * of a post in a single Sanity transaction.
 *
 * Why a transaction: leaving one variant alive while removing the other
 * produces zombie state — Sanity Studio renders `drafts.*` on top of the
 * published doc, so a published with no draft and a draft without a
 * published behave very differently in the UI. Atomic delete avoids that.
 *
 * Accepts either the bare ID or the `drafts.`-prefixed ID. Sanity ignores
 * delete operations for non-existent documents, so calling this on a
 * post-with-only-draft (or only-published) is safe.
 */
export async function deletePost(id: string): Promise<void> {
  const client = getSanityClient();
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  try {
    await client.transaction().delete(draftId).delete(baseId).commit();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[sanity.publish] deletePost failed for "${baseId}" (draft + published): ${message}`,
    );
  }
}

/**
 * Publishes a draft to production:
 * 1. Fetches the draft document by ID.
 * 2. Validates it and atomically publishes + deletes the draft via publishPost.
 *
 * Draft deletion is atomic with the published write (transaction), so there's
 * no need for a separate delete step — see publishPost's JSDoc for the
 * session 10 bug that motivated this change.
 */
export async function publishDraft(id: string): Promise<SanityPost> {
  const client = getSanityClient();
  const baseId = id.replace(/^drafts\./, "");
  const draftId = `drafts.${baseId}`;

  let draft: Record<string, unknown> | null = null;
  try {
    const fetched = await client.getDocument(draftId);
    draft = (fetched as Record<string, unknown> | null | undefined) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[sanity.publish] failed to fetch draft "${draftId}": ${message}`);
  }

  if (!draft) {
    throw new Error(`[sanity.publish] draft not found: "${draftId}"`);
  }

  return publishPost({ ...draft, _id: baseId });
}
