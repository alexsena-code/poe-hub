/**
 * Shared types for the Tiptap-based blog editor (session 08).
 *
 * Consumed by: extensions (NodeView attrs), hooks, shell, serializer (S08.c),
 * and the Sanity publish layer (S08.h).
 *
 * Keep this file free of React imports — it's pure TS and used in both
 * server and client contexts.
 */

// ---------------------------------------------------------------------------
// PoE node attribute types
// Mirrors the HTML data-* attrs emitted by renderHTML in each extension.
// ---------------------------------------------------------------------------

/** Attrs for poe-item-node — inline item reference, e.g. {{item:Mageblood|rare}} */
export interface PoeItemNodeAttrs {
  itemName: string;
  modifier?: string;
  /** CDN icon URL cached at insert time — optional, falls back to placeholder */
  iconUrl?: string;
}

/** Attrs for poe-price-node — inline price query, e.g. {{price:Mageblood|divine}} */
export interface PoePriceNodeAttrs {
  itemName: string;
  /** Currency unit: 'divine' | 'chaos' | 'usd' | 'exalt' */
  modifier?: string;
}

/** Attrs for poe-currency-node — inline currency, e.g. {{item:Divine Orb}} */
export interface PoeCurrencyNodeAttrs {
  currencyName: string;
  /** CDN icon URL cached at insert time */
  iconUrl?: string;
}

/**
 * Attrs for poe-cta-node — block-level call-to-action banner.
 * Serializes to {{cta:variant|modifier}} in Portable Text.
 */
export interface PoeCtaNodeAttrs {
  /** Content category the CTA promotes */
  variant: "currency" | "builds" | "items" | "maps";
  /** Game version qualifier */
  modifier: "poe1" | "poe2";
}

/** Attrs for poe-passive-node — inline passive skill tree reference */
export interface PoePassiveNodeAttrs {
  passiveName: string;
}

// ---------------------------------------------------------------------------
// Editor meta — fields required by the Sanity `post` schema
// Used by editor-sidebar (S08.e) and the publish route (S08.h).
// ---------------------------------------------------------------------------

/**
 * All metadata a blog post needs before publishing to Sanity.
 * Mirrors poetrade-dev's `post` schema required fields.
 */
export interface EditorMeta {
  title: string;
  /** SEO description — maps to Sanity post.metadata */
  metadata: string;
  /** Auto-generated from title, operator-editable */
  slug: string;
  gameVersion: "poe1" | "poe2";
  /** Sanity category document reference ID */
  categoryRef: string;
  /** Sanity author document reference ID */
  authorRef: string;
  /** Lowercase tag strings */
  tags: string[];
  /** Sanity image asset reference for the hero image */
  mainImageRef?: string;
  /** ISO 8601 datetime; defaults to Date.now() at publish time */
  publishedAt: string;
  /** Controls which Sanity locale document is created */
  language: "pt-br" | "en";
}

// ---------------------------------------------------------------------------
// Editor lifecycle phase
// ---------------------------------------------------------------------------

/**
 * Tracks the post's publication state within the editor shell.
 * - draft: unsaved or autosaved draft (Sanity `drafts.*` prefix)
 * - preview: preview pane visible; editor locked for editing
 * - published: post is live on the site (no `drafts.` prefix in Sanity)
 */
export type EditorPhase = "draft" | "preview" | "published";

// ---------------------------------------------------------------------------
// Slash commands — consumed by slash-commands.ts (S08.g)
// Defined here so that the extension and the menu UI share one shape.
// ---------------------------------------------------------------------------

/**
 * One entry in the slash-command menu.
 *
 * @example
 * const item: SlashCommandItem = {
 *   id: 'heading-1',
 *   label: 'Heading 1',
 *   description: 'Large section title',
 *   category: 'formatting',
 *   icon: 'Heading1',
 *   execute: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
 * };
 */
export interface SlashCommandItem {
  /** Unique ID — used as React key */
  id: string;
  /** Display label in the menu */
  label: string;
  /** Short description shown below the label */
  description: string;
  /**
   * Menu group.
   * - formatting: headings, lists, blockquote, code block
   * - poe: currency, item, gem, passive, cta
   * - ai: ask (Q&A pane)
   * - embed: image, table
   */
  category: "formatting" | "poe" | "ai" | "embed";
  /** Lucide icon name (string key from lucide-react) */
  icon: string;
  /**
   * Imperative command executed when the operator selects this item.
   * Receives the Tiptap editor instance.
   */
  execute: (editor: import("@tiptap/core").Editor) => void;
}
