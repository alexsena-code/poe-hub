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
  body: z.array(z.unknown()).min(1, "body must contain at least one block"),
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
 * Publishes a post to Sanity (no `drafts.` prefix).
 * Uses `createOrReplace` so it works for both new posts and updates.
 * Validates the post shape before writing.
 *
 * The `_id` on the returned doc will not have the `drafts.` prefix —
 * callers should update their local state accordingly.
 */
export async function publishPost(post: unknown): Promise<SanityPost> {
  const validated = validatePost(post);
  const client = getSanityClient();

  // Ensure the _id never has a drafts. prefix when publishing.
  const baseId = (validated._id ?? "").replace(/^drafts\./, "");
  const doc = {
    ...validated,
    _id: baseId || undefined,
    _type: "post" as const,
  };

  try {
    const result = await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
    return result as unknown as SanityPost;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[sanity.publish] createOrReplace failed for "${validated.title}": ${message}`);
  }
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
 * Publishes a draft to production:
 * 1. Fetches the draft document by ID.
 * 2. Validates it against the full schema.
 * 3. Creates/replaces the published doc (bare ID, no `drafts.` prefix).
 * 4. Deletes the draft.
 *
 * Returns the published document.
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

  // publishPost validates + strips the drafts. prefix from _id
  const published = await publishPost({ ...draft, _id: baseId });

  // Delete draft after successful publish — if this fails, we log but don't
  // undo the publish (published state is preferred over draft state).
  try {
    await client.delete(draftId);
  } catch (err) {
    console.error(
      `[sanity.publish] warning: published "${baseId}" but failed to delete draft "${draftId}":`,
      err instanceof Error ? err.message : err
    );
  }

  return published;
}
