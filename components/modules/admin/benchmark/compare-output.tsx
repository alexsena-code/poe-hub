"use client";

/**
 * Side-by-side output diff renderer for the benchmark compare page.
 *
 * Renders result objects from two runs with a vertical dashed divider.
 * No char-by-char diff — whole blocks are shown per section so the reader
 * can scan prose differences without diff noise.
 *
 * Supported types:
 *   - content_generation: detects section keys and renders each as its own block
 *   - qa / ideation: renders the full result as a mono text block
 *
 * Session 01 — benchmark compare Wave 2 + 3.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BenchmarkType } from "@prisma/client";

interface CompareOutputProps {
  resultA: unknown;
  resultB: unknown;
  type: BenchmarkType;
}

// ---------------------------------------------------------------------------
// Content-gen section extraction
// ---------------------------------------------------------------------------

interface ContentSection {
  key: string;
  body: string;
}

function extractContentGenSections(result: unknown): ContentSection[] {
  if (!result || typeof result !== "object") {
    return [{ key: "result", body: JSON.stringify(result, null, 2) }];
  }

  const r = result as Record<string, unknown>;

  if (Array.isArray(r.sections)) {
    return r.sections.map((sec: unknown, i: number) => {
      if (!sec || typeof sec !== "object") return { key: `section-${i}`, body: "" };
      const s = sec as Record<string, unknown>;
      const key = String(s.title ?? s.sectionId ?? `section-${i}`);
      const content = s.content as Record<string, unknown> | string | undefined;
      let body: string;
      if (typeof content === "string") {
        body = content;
      } else if (content && typeof content === "object") {
        body = String(content["pt-br"] ?? content.en ?? JSON.stringify(content, null, 2));
      } else {
        body = JSON.stringify(s, null, 2);
      }
      return { key, body };
    });
  }

  // Flat object fallback: each top-level key becomes a section
  return Object.entries(r).map(([key, value]) => ({
    key,
    body: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  }));
}

function extractFlatText(result: unknown): string {
  if (result === null || result === undefined) return "[no result]";
  if (typeof result === "string") return result;

  const r = result as Record<string, unknown>;
  if (typeof r.answer === "string") return r.answer;
  if (Array.isArray(r.ideas)) {
    return r.ideas
      .map((idea: unknown, i: number) => {
        if (!idea || typeof idea !== "object") return `${i + 1}. [malformed]`;
        const it = idea as Record<string, unknown>;
        return `${i + 1}. ${it.title ?? "untitled"}\n${it.description ?? ""}`.trim();
      })
      .join("\n\n");
  }

  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// Section block (collapsible)
// ---------------------------------------------------------------------------

interface SectionBlockProps {
  sectionKey: string;
  bodyA: string;
  bodyB: string;
}

function SectionBlock({ sectionKey, bodyA, bodyB }: SectionBlockProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-md border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {sectionKey}
      </button>

      {open && (
        <div className="grid grid-cols-[1fr_1px_1fr] divide-x divide-border border-t border-border">
          <ScrollableBlock label="A" text={bodyA} />
          {/* dashed divider rendered via border-dashed on the grid column */}
          <div className="border-l border-dashed border-border" />
          <ScrollableBlock label="B" text={bodyB} />
        </div>
      )}
    </div>
  );
}

interface ScrollableBlockProps {
  label: "A" | "B";
  text: string;
}

function ScrollableBlock({ label, text }: ScrollableBlockProps) {
  const isEmpty = !text || text === "[no result]";

  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "px-3 py-1 text-[10px] font-bold tracking-widest uppercase",
          label === "A" ? "text-blue-400" : "text-amber-400",
        )}
      >
        Run {label}
      </span>
      <pre
        className={cn(
          "max-h-80 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed",
          isEmpty && "italic text-muted-foreground",
        )}
      >
        {isEmpty ? "(empty)" : text}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders side-by-side output blocks for two benchmark runs.
 *
 * For content_generation: each detected section gets its own collapsible block.
 * For qa/ideation: a single full-result block.
 */
export function CompareOutput({ resultA, resultB, type }: CompareOutputProps) {
  if (type === "content_generation") {
    const sectionsA = extractContentGenSections(resultA);
    const sectionsB = extractContentGenSections(resultB);

    // Union of all section keys, preserving order from A then B-only extras
    const allKeys = [
      ...sectionsA.map((s) => s.key),
      ...sectionsB.filter((s) => !sectionsA.some((sa) => sa.key === s.key)).map((s) => s.key),
    ];

    return (
      <div className="space-y-3">
        {allKeys.map((key) => {
          const bodyA = sectionsA.find((s) => s.key === key)?.body ?? "";
          const bodyB = sectionsB.find((s) => s.key === key)?.body ?? "";
          return <SectionBlock key={key} sectionKey={key} bodyA={bodyA} bodyB={bodyB} />;
        })}
      </div>
    );
  }

  // qa / ideation — flat text side by side
  const textA = extractFlatText(resultA);
  const textB = extractFlatText(resultB);

  return (
    <div className="rounded-md border border-border">
      <div className="grid grid-cols-[1fr_1px_1fr] divide-x divide-border">
        <ScrollableBlock label="A" text={textA} />
        <div className="border-l border-dashed border-border" />
        <ScrollableBlock label="B" text={textB} />
      </div>
    </div>
  );
}
