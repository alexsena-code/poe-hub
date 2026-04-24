/**
 * Tests for lib/sanity/transform.ts
 *
 * Covers editorMetaToSanityPost (forward) and sanityPostToEditorMeta (reverse).
 * No Sanity client mocking needed — pure transformation logic.
 */

import { describe, it, expect } from "vitest";
import { editorMetaToSanityPost, sanityPostToEditorMeta } from "../transform";
import type { EditorMetaForm } from "@/components/editor/editor-meta-schema";
import type { PortableTextContent } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFullMeta(overrides: Partial<EditorMetaForm> = {}): EditorMetaForm {
  return {
    title: "Guia de Divine Orbs",
    metadata: "Tudo sobre divine orbs no Path of Exile 2.",
    slug: "guia-divine-orbs",
    gameVersion: "path-of-exile-2",
    categoryId: "cat-001",
    authorId: "author-001",
    tags: ["currency", "divine", "poe2"],
    mainImageAssetId: "image-asset-001",
    publishedAt: "2026-04-24T10:00:00.000Z",
    language: "pt-br",
    ...overrides,
  };
}

const sampleBody: PortableTextContent[] = [
  {
    _type: "block",
    _key: "b1",
    style: "normal",
    children: [{ _type: "span", _key: "s1", text: "Conteúdo.", marks: [] }],
    markDefs: [],
  },
];

const DRAFT_ID = "post-abc123";

// ─── editorMetaToSanityPost ───────────────────────────────────────────────────

describe("editorMetaToSanityPost", () => {
  it("happy path: full meta + body → correct SanityPostInput shape", () => {
    const result = editorMetaToSanityPost(makeFullMeta(), sampleBody, {
      draftId: DRAFT_ID,
      isPublish: true,
    });

    expect(result._type).toBe("post");
    expect(result._id).toBe(DRAFT_ID);
    expect(result.title).toBe("Guia de Divine Orbs");
    expect(result.category).toEqual({ _type: "reference", _ref: "cat-001" });
    expect(result.author).toEqual({ _type: "reference", _ref: "author-001" });
    expect(result.mainImage).toEqual({
      _type: "image",
      asset: { _type: "reference", _ref: "image-asset-001" },
    });
    expect(result.slug).toEqual({ _type: "slug", current: "guia-divine-orbs" });
    expect(result.tags).toEqual(["currency", "divine", "poe2"]);
    expect(result.language).toBe("pt-br");
    expect(result.body).toHaveLength(1);
  });

  it("omits mainImage when mainImageAssetId is absent", () => {
    const meta = makeFullMeta({ mainImageAssetId: undefined });
    const result = editorMetaToSanityPost(meta, sampleBody, {
      draftId: DRAFT_ID,
      isPublish: true,
    });

    expect("mainImage" in result).toBe(false);
  });

  it("omits mainImage when mainImageAssetId is empty string", () => {
    const meta = makeFullMeta({ mainImageAssetId: "" });
    const result = editorMetaToSanityPost(meta, sampleBody, {
      draftId: DRAFT_ID,
      isPublish: true,
    });

    expect("mainImage" in result).toBe(false);
  });

  it("preserves slug with hyphens and no transformation", () => {
    const meta = makeFullMeta({ slug: "guia-completo-divine-orbs-2026" });
    const result = editorMetaToSanityPost(meta, sampleBody, {
      draftId: DRAFT_ID,
      isPublish: true,
    });

    expect(result.slug).toEqual({
      _type: "slug",
      current: "guia-completo-divine-orbs-2026",
    });
  });

  it("_id is bare draftId when isPublish=true", () => {
    const result = editorMetaToSanityPost(makeFullMeta(), sampleBody, {
      draftId: DRAFT_ID,
      isPublish: true,
    });
    expect(result._id).toBe(DRAFT_ID);
    expect(result._id?.startsWith("drafts.")).toBe(false);
  });

  it("_id has drafts. prefix when isPublish=false (draft save)", () => {
    const result = editorMetaToSanityPost(makeFullMeta(), sampleBody, {
      draftId: DRAFT_ID,
      isPublish: false,
    });
    expect(result._id).toBe(`drafts.${DRAFT_ID}`);
  });

  it("language pt-br passes through unchanged", () => {
    const result = editorMetaToSanityPost(
      makeFullMeta({ language: "pt-br" }),
      sampleBody,
      { draftId: DRAFT_ID, isPublish: true },
    );
    expect(result.language).toBe("pt-br");
  });

  it("language en passes through unchanged", () => {
    const result = editorMetaToSanityPost(
      makeFullMeta({ language: "en" }),
      sampleBody,
      { draftId: DRAFT_ID, isPublish: true },
    );
    expect(result.language).toBe("en");
  });

  it("throws with useful message when categoryId is empty", () => {
    const meta = makeFullMeta({ categoryId: "" });
    expect(() =>
      editorMetaToSanityPost(meta, sampleBody, { draftId: DRAFT_ID }),
    ).toThrow('[sanity.transform] categoryId must not be empty (got: "")');
  });

  it("throws with useful message when authorId is empty", () => {
    const meta = makeFullMeta({ authorId: "" });
    expect(() =>
      editorMetaToSanityPost(meta, sampleBody, { draftId: DRAFT_ID }),
    ).toThrow('[sanity.transform] authorId must not be empty (got: "")');
  });

  it("throws with useful message when draftId is empty", () => {
    expect(() =>
      editorMetaToSanityPost(makeFullMeta(), sampleBody, { draftId: "" }),
    ).toThrow('[sanity.transform] draftId must not be empty (got: "")');
  });
});

// ─── sanityPostToEditorMeta ───────────────────────────────────────────────────

describe("sanityPostToEditorMeta", () => {
  it("extracts all fields from a complete Sanity post document", () => {
    const doc = {
      _id: "drafts.post-abc123",
      _type: "post",
      title: "Guia completo",
      metadata: "SEO description here.",
      slug: { _type: "slug", current: "guia-completo" },
      gameVersion: "path-of-exile-1",
      category: { _type: "reference", _ref: "cat-002" },
      author: { _type: "reference", _ref: "author-002" },
      tags: ["build", "poe1"],
      mainImage: {
        _type: "image",
        asset: { _type: "reference", _ref: "image-asset-002" },
      },
      publishedAt: "2026-04-20T08:00:00.000Z",
      language: "en",
    };

    const meta = sanityPostToEditorMeta(doc);

    expect(meta.title).toBe("Guia completo");
    expect(meta.metadata).toBe("SEO description here.");
    expect(meta.slug).toBe("guia-completo");
    expect(meta.gameVersion).toBe("path-of-exile-1");
    expect(meta.categoryId).toBe("cat-002");
    expect(meta.authorId).toBe("author-002");
    expect(meta.tags).toEqual(["build", "poe1"]);
    expect(meta.mainImageAssetId).toBe("image-asset-002");
    expect(meta.publishedAt).toBe("2026-04-20T08:00:00.000Z");
    expect(meta.language).toBe("en");
  });

  it("returns empty/default values for a completely empty document", () => {
    const meta = sanityPostToEditorMeta({});

    expect(meta.title).toBe("");
    expect(meta.metadata).toBe("");
    expect(meta.slug).toBe("");
    expect(meta.categoryId).toBe("");
    expect(meta.authorId).toBe("");
    expect(meta.tags).toEqual([]);
    expect(meta.mainImageAssetId).toBeUndefined();
    expect(meta.gameVersion).toBe("path-of-exile-1");
    expect(meta.language).toBe("pt-br");
  });

  it("omits mainImageAssetId when mainImage is absent", () => {
    const doc = { title: "Test", mainImage: undefined };
    const meta = sanityPostToEditorMeta(doc);
    expect(meta.mainImageAssetId).toBeUndefined();
  });
});
