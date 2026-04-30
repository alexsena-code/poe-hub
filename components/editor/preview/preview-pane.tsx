"use client";

/**
 * Preview pane for the blog editor.
 *
 * Shown when the editor shell transitions to the "preview" phase.
 * Uses SWR to cache resolved blocks — key is a hash of the body JSON so
 * unchanged content is not re-resolved on each toggle.
 *
 * States:
 *   loading  — spinner centred in the container
 *   resolved — PortableText rendered with previewComponents (same as poetrade-dev)
 *   error    — fallback in prose + toast notification
 *
 * Session 08.d.
 */

import React, { useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { resolveBlocks } from "./resolve-blocks";
import { PreviewRenderer } from "./portable-text-components";
import type { PortableTextContent } from "@/lib/sanity/types";
import type { ResolveContext } from "./types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PreviewPaneProps {
  title: string;
  body: PortableTextContent[];
  /** SEO description rendered below the title as a subtitle. */
  metadata?: string;
  /** Hero image URL — shown above the article when supplied. */
  mainImageUrl?: string;
  gameVersion: "path-of-exile-1" | "path-of-exile-2";
  /** Locale for link resolution inside resolveBlocks. Defaults to 'pt-br'. */
  locale?: string;
  /** Active league name for price lookups. Defaults to 'Mirage'. */
  league?: string;
}

// ─── SWR key + fetcher ────────────────────────────────────────────────────────

/**
 * Deterministic hash of the body array and context so SWR caches per unique
 * body content. Using JSON.stringify is fine here — preview bodies are small
 * (<50 blocks typically) and we only re-hash on toggle.
 */
function makePreviewKey(
  body: PortableTextContent[],
  ctx: ResolveContext,
): string {
  const bodyHash = JSON.stringify(body);
  return `preview:${ctx.locale}:${ctx.gameVersion}:${ctx.league}:${bodyHash}`;
}

async function resolveBlocksFetcher([, body, ctx]: [
  string,
  PortableTextContent[],
  ResolveContext,
]): Promise<PortableTextContent[]> {
  return resolveBlocks(body, ctx);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Preview pane — resolves Portable Text placeholders and renders the post
 * as it will appear on the public blog.
 *
 * @example
 * <PreviewPane
 *   title="Guide to Divine Orbs"
 *   body={blocks}
 *   gameVersion="path-of-exile-1"
 * />
 */
export function PreviewPane({
  title,
  body,
  metadata,
  mainImageUrl,
  gameVersion,
  locale = "pt-br",
  league = "Mirage",
}: PreviewPaneProps) {
  const ctx: ResolveContext = { locale, gameVersion, league };
  const swrKey = makePreviewKey(body, ctx);

  const { data: resolved, error, isLoading } = useSWR(
    // Tuple key so SWR passes all args to fetcher
    [swrKey, body, ctx] as const,
    resolveBlocksFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5-min dedup — re-resolve on body change
      onError: (err: Error) => {
        console.error("[preview] resolve failed:", err.message);
        toast.error("Falha ao resolver preview", {
          description: "Engine offline ou erro interno. Mostrando placeholders literais.",
        });
      },
    },
  );

  // Manual revalidation trigger — operator can force a re-resolve
  const revalidate = useCallback(() => {
    // SWR key change triggers re-fetch — nothing extra needed here since
    // body changes bubble through the key. This hook is a no-op placeholder
    // for the shell to call via ref if needed in the future.
  }, []);
  void revalidate; // suppress unused-vars lint

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // ── Error state — render body as literal text (fail-soft) ────────────────────
  if (error && !resolved) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ArticleHeader title={title} metadata={metadata} mainImageUrl={mainImageUrl} />
        <div className="text-zinc-400 text-sm italic mt-6">
          Preview indisponível — engine offline. Placeholders literais exibidos abaixo.
        </div>
        <div className="mt-4 space-y-2">
          {body.map((block, i) => {
            const children = "children" in block ? block.children : undefined;
            const text = children?.map((c) => c.text).join("") ?? `[${block._type}]`;
            return (
              <p key={block._key ?? i} className="text-zinc-300 text-sm font-mono">
                {text}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Resolved state ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ArticleHeader title={title} metadata={metadata} mainImageUrl={mainImageUrl} />
      <article className="markdown-body max-w-none mt-8">
        <PreviewRenderer value={resolved ?? body} />
      </article>
    </div>
  );
}

// ─── Article header ───────────────────────────────────────────────────────────

interface ArticleHeaderProps {
  title: string;
  metadata?: string;
  mainImageUrl?: string;
}

function ArticleHeader({ title, metadata, mainImageUrl }: ArticleHeaderProps) {
  return (
    <header>
      {mainImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mainImageUrl}
          alt={title}
          className="w-full rounded-xl object-cover mb-6 max-h-72"
        />
      )}
      <h1 className="text-3xl font-bold text-white leading-tight">{title}</h1>
      {metadata && (
        <p className="mt-2 text-zinc-400 text-base leading-relaxed">{metadata}</p>
      )}
    </header>
  );
}
