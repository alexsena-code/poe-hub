/**
 * Zod schema for the blog editor meta form.
 * Mirrors the required fields of the Sanity `post` document.
 *
 * Consumed by: editor-sidebar.tsx (form validation), editor-shell.tsx
 * (state typing), use-autosave.ts (payload assembly), use-publish.ts.
 *
 * The `gameVersion` enum uses Sanity's exact strings ('path-of-exile-1' | 'path-of-exile-2')
 * rather than the editor's internal shorthand ('poe1'|'poe2') so the form
 * value can be sent to the API without mapping.
 */

import { z } from "zod/v4";

export const editorMetaSchema = z.object({
  /** Post headline — mapped to Sanity post.title */
  title: z.string().min(3, "Título muito curto").max(200, "Título muito longo"),

  /**
   * SEO description — maps to Sanity post.metadata.
   * Kept ≥20 so it's useful for search snippets; ≤160 to fit SERP preview.
   */
  metadata: z
    .string()
    .min(20, "Descrição SEO muito curta (mínimo 20 chars)")
    .max(160, "Descrição SEO muito longa (máximo 160 chars)"),

  /**
   * URL slug — lowercase letters, digits, hyphens only.
   * Regex keeps it URL-safe without encoding.
   */
  slug: z
    .string()
    .min(1, "Slug obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug: apenas lowercase, números e hífens"),

  /** Sanity gameVersion enum value — not the editor shorthand. */
  gameVersion: z.enum(["path-of-exile-1", "path-of-exile-2"]),

  /** Sanity category document _id */
  categoryId: z.string().min(1, "Categoria obrigatória"),

  /** Sanity author document _id */
  authorId: z.string().min(1, "Autor obrigatório"),

  /**
   * Lowercase tag strings — hyphen-separated, no spaces.
   * At least one tag required; cap at 8 to stay manageable.
   */
  tags: z
    .array(
      z.string().regex(/^[a-z0-9-]+$/, "Tag: apenas lowercase, números e hífens"),
    )
    .min(1, "Pelo menos uma tag obrigatória")
    .max(8, "Máximo 8 tags"),

  /**
   * Sanity image asset reference (_ref from POST /api/sanity/upload).
   * Optional — posts can be published without a hero image.
   */
  mainImageAssetId: z.string().optional(),

  /** ISO 8601 datetime — defaults to publish time, operator-adjustable. */
  publishedAt: z.string().min(1, "Data de publicação obrigatória"),

  /** Controls which Sanity locale document is created/updated. */
  language: z.enum(["pt-br", "en"]),
});

/** Inferred TypeScript type for the form values. */
export type EditorMetaForm = z.infer<typeof editorMetaSchema>;

/** Default values — initialise the form with safe empty state. */
// datetime-local input expects "yyyy-MM-ddTHH:mm" (no Z, no ms) — slice the
// ISO string so the browser doesn't warn about format mismatch on first paint.
export const editorMetaDefaults: EditorMetaForm = {
  title: "",
  metadata: "",
  slug: "",
  gameVersion: "path-of-exile-1",
  categoryId: "",
  authorId: "",
  tags: [],
  mainImageAssetId: undefined,
  publishedAt: new Date().toISOString().slice(0, 16),
  language: "pt-br",
};
