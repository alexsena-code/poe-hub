"use client";

/**
 * Portable Text components for the hub's preview pane.
 *
 * Port of poetrade-dev/components/portable-text/blockContentComponents.tsx.
 * Differences from the original:
 *   - `marked` (npm) replaced by a lightweight inline markdown renderer to
 *     avoid adding a dependency. The same token types are handled.
 *   - `urlBuilder(@sanity/image-url)` replaced by `imageUrlFor` from
 *     lib/sanity/image-url.ts (created by S08.a).
 *   - `@sanity/asset-utils` getImageDimensions replaced by reading width/height
 *     from the Sanity metadata when present, or falling back to a safe 16:9.
 *   - `PoeItemBlogCard` replaced by the hub's local `PoeItemCard`.
 *   - `CurrencyCta` not ported — poeCta blocks render a simple placeholder
 *     banner with the variant name and a link to pathoftrade.net instead.
 *   - `POE_CURRENCIES` auto-link removed — that enrichment is already done by
 *     the resolver (inline mention promotion + poeItem marks). Doing it again
 *     here would double-link resolved text.
 *
 * Session 08.d.
 */

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { imageUrlFor } from "@/lib/sanity/image-url";
import { PoeItemCard, type PoeItemCardValue } from "./poe-item-card";

// ─── Inline markdown renderer (replaces marked.Lexer) ────────────────────────

/**
 * Simple recursive inline markdown renderer.
 * Handles: **bold**, *em*, `code`, [link](url), and plain text.
 * Does NOT attempt to handle escaped chars or nested complex structures —
 * that's sufficient for LLM-generated prose.
 */
function renderInlineMarkdown(text: string, baseKey: string): React.ReactNode[] {
  if (!text) return [];

  // Split on inline marks in one pass. Regex alternation order matters.
  const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <React.Fragment key={`${baseKey}-t${idx++}`}>
          {text.slice(last, match.index)}
        </React.Fragment>,
      );
    }

    if (match[2] !== undefined) {
      // **bold**
      nodes.push(<strong key={`${baseKey}-b${idx++}`} className="font-bold text-white">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // *em*
      nodes.push(<em key={`${baseKey}-e${idx++}`}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // `code`
      nodes.push(
        <code key={`${baseKey}-c${idx++}`} className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-400 text-sm">
          {match[4]}
        </code>,
      );
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // [link](url)
      nodes.push(
        <a
          key={`${baseKey}-l${idx++}`}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
        >
          {match[5]}
        </a>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(
      <React.Fragment key={`${baseKey}-t${idx++}`}>
        {text.slice(last)}
      </React.Fragment>,
    );
  }

  return nodes;
}

// ─── Child processing helpers ─────────────────────────────────────────────────

function processChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, i) => {
    if (typeof child === "string") {
      return renderInlineMarkdown(child, `proc-${i}`);
    }
    return child;
  });
}

function getTextContent(children: React.ReactNode): { first: string | null; full: string | null } {
  const textParts: string[] = [];
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") textParts.push(child);
  });
  const first = textParts.find((t) => t.trim())?.trim() ?? null;
  const full = textParts.length > 0 ? textParts.join("\n").trim() : null;
  return { first, full };
}

// ─── Markdown table ───────────────────────────────────────────────────────────

function renderMarkdownTable(text: string): React.ReactNode {
  const lines = text.split("\n").filter((l) => l.trim());
  const dataRows = lines.filter((l) => {
    const trimmed = l.trim();
    return !(trimmed.match(/^\|[\s:-]+\|/) && !trimmed.replace(/[\s|:-]/g, ""));
  });
  if (!dataRows.length) return null;

  const headerCells = dataRows[0].split("|").filter((c) => c.trim() !== "");
  const colCount = headerCells.length;

  return (
    <div className="mb-6 ml-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/50">
            {headerCells.map((cell, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-semibold text-zinc-200">
                {renderInlineMarkdown(cell.trim(), `th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.slice(1).map((row, ri) => {
            const cells = row.split("|").filter((c) => c.trim() !== "");
            return (
              <tr key={ri} className="border-b border-zinc-800/30">
                {Array.from({ length: colCount }, (_, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-zinc-300">
                    {cells[ci] ? renderInlineMarkdown(cells[ci].trim(), `td-${ri}-${ci}`) : ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Normal block processor ───────────────────────────────────────────────────

const HEADING_CLASSES: Record<number, string> = {
  1: "text-3xl font-bold mt-10 mb-4 text-white",
  2: "text-2xl font-bold mt-8 mb-3 text-white",
  3: "text-xl font-semibold mt-6 mb-2 text-white",
  4: "text-lg font-semibold mt-4 mb-2 text-white",
};

function processNormalBlock(children: React.ReactNode): React.ReactNode {
  const { first: firstText, full: fullText } = getTextContent(children);

  if (firstText) {
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(firstText)) {
      return <hr className="my-8 border-zinc-800/50" />;
    }

    if (/^\|[\s:-]+\|/.test(firstText) && !firstText.replace(/[\s|:-]/g, "")) {
      return null;
    }

    if (/^\|.+\|/.test(firstText) && fullText) {
      const tableLines = fullText.split("\n").filter((l) => l.trim().startsWith("|"));
      if (tableLines.length > 1) return renderMarkdownTable(fullText);
    }

    const headingMatch = firstText.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4) as 1 | 2 | 3 | 4;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      return (
        <Tag className={HEADING_CLASSES[level]}>
          {renderInlineMarkdown(headingMatch[2], `hd-${level}`)}
        </Tag>
      );
    }

    if (fullText?.includes("\n")) {
      const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const isOrdered = lines.every((l) => /^\d+\.\s+/.test(l));
        const isBullet = lines.every((l) => /^[*-]\s+/.test(l));
        if (isOrdered || isBullet) {
          const items = lines.map((l) => l.replace(/^(?:\d+\.|[*-])\s+/, ""));
          if (isOrdered) {
            return (
              <ol className="list-decimal pl-6 mb-4 space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-zinc-300">
                    {renderInlineMarkdown(item, `oli-${i}`)}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul className="list-disc pl-6 mb-4 space-y-1">
              {items.map((item, i) => (
                <li key={i} className="text-zinc-300">
                  {renderInlineMarkdown(item, `uli-${i}`)}
                </li>
              ))}
            </ul>
          );
        }
      }
    }
  }

  return <p className="leading-relaxed mb-4">{processChildren(children)}</p>;
}

// ─── Image component ──────────────────────────────────────────────────────────

function ImageComponent({ value, isInline }: { value: Record<string, unknown>; isInline?: boolean }) {
  // Prefer metadata dimensions from Sanity; fall back to 1280×720 to avoid
  // CLS. @sanity/asset-utils is not installed in this repo.
  const metadata = value.asset as Record<string, unknown> | undefined;
  const metaDims = (metadata?.metadata as Record<string, unknown>)?.dimensions as Record<string, number> | undefined;
  const width = metaDims?.width ?? 1280;
  const height = metaDims?.height ?? 720;

  const src = imageUrlFor(value as Parameters<typeof imageUrlFor>[0])
    .fit("max")
    .auto("format")
    .url();

  return (
    <div className="my-10 overflow-hidden rounded-[15px]">
      <Image
        src={src}
        width={width}
        height={height}
        alt={(value.alt as string) || "blog image"}
        loading="lazy"
        style={{
          display: isInline ? "inline-block" : "block",
          aspectRatio: `${width} / ${height}`,
        }}
      />
    </div>
  );
}

// ─── Table component ──────────────────────────────────────────────────────────

function TableComponent({ value }: { value: Record<string, unknown> }) {
  if (!value?.rows || !Array.isArray(value.rows)) return null;

  return (
    <div className="my-10">
      <table>
        <tbody>
          {(value.rows as Array<{ _key: string; cells: string[] }>).map((row) => (
            <tr key={row._key}>
              {row.cells.map((cell, key) => (
                <td key={key} className="first:bg-zinc-800 max-w-[100px]">
                  <span className="px-4">{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CTA block (simplified for preview) ──────────────────────────────────────

function CtaPreviewBanner({
  value,
}: {
  value: { variant?: string; gameVersion?: string; leagueName?: string | null };
}) {
  const variant = value?.variant ?? "currency";
  const gameVersion = value?.gameVersion ?? "path-of-exile-1";
  const label = `[CTA: ${variant} — ${gameVersion}${value.leagueName ? ` (${value.leagueName})` : ""}]`;
  return (
    <div className="my-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-sm text-amber-400">
      {label}
    </div>
  );
}

// ─── Exported components ──────────────────────────────────────────────────────

/**
 * PortableTextComponents map for the hub's preview pane.
 * Mirrors blockContentComponents from poetrade-dev so preview is visually
 * faithful to the public blog render.
 */
export const previewComponents: PortableTextComponents = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) =>
      processNormalBlock(children),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-3xl font-bold mt-10 mb-4 text-white">{processChildren(children)}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-2xl font-bold mt-8 mb-3 text-white">{processChildren(children)}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-xl font-semibold mt-6 mb-2 text-white">{processChildren(children)}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-lg font-semibold mt-4 mb-2 text-white">{processChildren(children)}</h4>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-amber-500/50 pl-4 my-4 italic text-zinc-300">
        {processChildren(children)}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-zinc-300">{processChildren(children)}</li>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-zinc-300">{processChildren(children)}</li>
    ),
  },
  marks: {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-white">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => <em>{children}</em>,
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-amber-400 text-sm">
        {children}
      </code>
    ),
    link: ({ value, children }: { value?: { href?: string }; children?: React.ReactNode }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
      >
        {children}
      </a>
    ),
    /**
     * Inline PoE item reference injected by the placeholder resolver for
     * {{item:Name}}. The markDef carries rawText + iconUrl + item metadata.
     * Renders PoeItemCard — same chip+tooltip used by block-level poeItem.
     */
    poeItem: ({ value }: { value?: Record<string, unknown> }) => {
      if (!value?.rawText) return null;
      return (
        <PoeItemCard
          value={{
            _type: "poeItem",
            rawText: value.rawText as string,
            iconUrl: value.iconUrl as string | null,
            isCurrency: (value.isCurrency as boolean) ?? false,
            isGem: (value.isGem as boolean) ?? false,
            primaryAttribute:
              (value.primaryAttribute as PoeItemCardValue["primaryAttribute"]) ?? null,
            isAwakened: (value.isAwakened as boolean) ?? false,
            isVaal: (value.isVaal as boolean) ?? false,
          }}
        />
      );
    },
  },
  types: {
    image: ({ value }: { value: Record<string, unknown> }) => (
      <ImageComponent value={value} />
    ),
    table: ({ value }: { value: Record<string, unknown> }) => (
      <TableComponent value={value} />
    ),
    poeItem: ({ value }: { value: Record<string, unknown> }) => {
      if (!value?.rawText) return null;
      return (
        <PoeItemCard
          value={{
            _type: "poeItem",
            rawText: value.rawText as string,
            iconUrl: (value.iconUrl as string | null) ?? null,
          }}
        />
      );
    },
    /**
     * Block-level CTA from {{cta:variant|modifier}} — a simplified banner
     * rather than the full CurrencyCta widget (which depends on live data
     * we don't fetch in preview). Operator can see the variant and intent.
     */
    poeCta: ({ value }: { value: Record<string, unknown> }) => (
      <CtaPreviewBanner
        value={{
          variant: value.variant as string | undefined,
          gameVersion: value.gameVersion as string | undefined,
          leagueName: value.leagueName as string | null | undefined,
        }}
      />
    ),
  },
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

interface PreviewRendererProps {
  value: unknown;
}

/**
 * Render resolved Portable Text blocks using the hub's preview component map.
 *
 * @example
 * <PreviewRenderer value={resolvedBlocks} />
 */
export function PreviewRenderer({ value }: PreviewRendererProps) {
  if (!value) return null;
  return (
    <PortableText
      value={value as Parameters<typeof PortableText>[0]["value"]}
      components={previewComponents}
    />
  );
}

export type { PoeItemCardValue };

// Re-export Link for consumers that import from this module
export { Link };
