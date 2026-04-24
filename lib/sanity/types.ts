/**
 * TypeScript interfaces mirroring the poetrade-dev Sanity schema.
 * Source of truth: poetrade-dev/sanity/schemas/{post,author,category,blockContent,poe-item,code,table}.ts
 *
 * These types are used by lib/sanity/publish.ts (write path) and
 * lib/sanity/queries.ts (read path). They do NOT import any Sanity SDK
 * types so they stay portable and testable without credentials.
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

export type GameVersion = "path-of-exile-1" | "path-of-exile-2";

export type Language = "pt-br" | "en";

/**
 * A Sanity reference — `{ _type: 'reference', _ref: 'document-id' }`.
 * Used for category, author, and image asset references.
 */
export interface SanityReference {
  _type: "reference";
  _ref: string;
}

/**
 * A Sanity image field — contains an `asset` reference plus optional
 * hotspot/crop metadata. The `asset` is always a reference to the image
 * asset document in the `sanity.imageAsset` collection.
 */
export interface SanityImageRef {
  _type: "image";
  asset: SanityReference;
  hotspot?: {
    x: number;
    y: number;
    height: number;
    width: number;
  };
  crop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

// ─── Portable Text blocks ─────────────────────────────────────────────────────

/** A link annotation mark (href + optional blank target). */
export interface LinkMark {
  _type: "link";
  _key: string;
  href: string;
  blank?: boolean;
}

/** A poeItem inline mark — carries raw item data as an annotation. */
export interface PoeItemMark {
  _type: "poeItem";
  _key: string;
  rawText: string;
  iconUrl?: string;
}

export type PortableTextMarkDef = LinkMark | PoeItemMark;

/** A span of text with optional mark keys referencing markDefs entries. */
export interface PortableTextSpan {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

/**
 * A standard Portable Text block (paragraph, heading, blockquote, etc.).
 * `style` maps to Sanity's blockContent styles: normal|h1|h2|h3|h4|blockquote.
 * `listItem` is present for bullet/numbered list items.
 */
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal" | "h1" | "h2" | "h3" | "h4" | "blockquote";
  listItem?: "bullet" | "number";
  level?: number;
  children: PortableTextSpan[];
  markDefs: PortableTextMarkDef[];
}

/** An image block within blockContent. */
export interface PortableTextImageBlock {
  _type: "image";
  _key: string;
  asset: SanityReference;
  hotspot?: SanityImageRef["hotspot"];
  crop?: SanityImageRef["crop"];
  alt?: string;
}

/** A code block — matches the `code` schema type. */
export interface PortableTextCodeBlock {
  _type: "code";
  _key: string;
  code: string;
  language?: string;
}

/** A table block — matches the `table` schema type. */
export interface PortableTextTableRow {
  _type: "row";
  _key: string;
  cells: string[];
}

export interface PortableTextTableBlock {
  _type: "table";
  _key: string;
  rows: PortableTextTableRow[];
}

/**
 * A block-level PoE item — matches the `poeItem` schema object type.
 * Holds raw clipboard text from the game + optional icon URL.
 */
export interface PoeItemBlock {
  _type: "poeItem";
  _key: string;
  rawText: string;
  iconUrl?: string;
}

export type PortableTextContent =
  | PortableTextBlock
  | PortableTextImageBlock
  | PortableTextCodeBlock
  | PortableTextTableBlock
  | PoeItemBlock;

// ─── Document types ───────────────────────────────────────────────────────────

/**
 * A Sanity author document.
 * Matches poetrade-dev/sanity/schemas/author.ts.
 */
export interface SanityAuthor {
  _id: string;
  _type: "author";
  _updatedAt?: string;
  name: string;
  /** Slug object — { _type: 'slug', current: 'string' } */
  slug: { _type: "slug"; current: string };
  image?: SanityImageRef;
  bio?: string;
}

/**
 * A Sanity category document.
 * Matches poetrade-dev/sanity/schemas/category.ts.
 */
export interface SanityCategory {
  _id: string;
  _type: "category";
  _updatedAt?: string;
  language?: Language;
  slug: { _type: "slug"; current: string };
  tagname: string;
  title?: string;
  description?: string;
  ogImage?: SanityImageRef;
}

/**
 * The full Sanity post document shape as stored in the dataset.
 * Matches poetrade-dev/sanity/schemas/post.ts.
 *
 * Required fields (enforced by zod in lib/sanity/publish.ts):
 *   title, metadata, gameVersion, category, slug, tags, author,
 *   publishedAt, body, language.
 *
 * `mainImage` is optional per the schema (commented-out validation).
 */
export interface SanityPost {
  _id: string;
  _type: "post";
  _rev?: string;
  _createdAt?: string;
  _updatedAt?: string;
  language: Language;
  title: string;
  metadata: string;
  gameVersion: GameVersion;
  category: SanityReference;
  slug: { _type: "slug"; current: string };
  tags: string[];
  author: SanityReference;
  mainImage?: SanityImageRef;
  publishedAt: string; // ISO 8601 datetime string
  body: PortableTextContent[];
}

// ─── Lightweight reference shapes returned by GROQ projection queries ─────────

/** Returned by FETCH_AUTHORS_QUERY — minimal author ref for autocomplete. */
export interface AuthorRef {
  _id: string;
  name: string;
  slug: string; // flattened slug.current
  image?: SanityImageRef;
}

/** Returned by FETCH_CATEGORIES_QUERY — minimal category ref for autocomplete. */
export interface CategoryRef {
  _id: string;
  tagname: string;
  title?: string;
  slug: string; // flattened slug.current
}
