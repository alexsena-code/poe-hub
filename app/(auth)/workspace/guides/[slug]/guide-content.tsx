"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PostDetail, PostSection } from "@/lib/content-api";
import { updatePost } from "@/lib/content-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ClipboardList,
  List,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type Lang = "pt-br" | "en";

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function templateLabel(template: string): string {
  const labels: Record<string, string> = {
    build_guide: "Build Guide",
    mechanic_guide: "Mechanic Guide",
    tier_list: "Tier List",
    faq: "FAQ",
    patch_analysis: "Patch Analysis",
  };
  return labels[template] || template.replace(/_/g, " ");
}

function sectionAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// Editable section textarea
// ---------------------------------------------------------------------------

function SectionEditor({
  section,
  lang,
  value,
  onChange,
  isDirty,
}: {
  section: PostSection;
  lang: Lang;
  value: string;
  onChange: (val: string) => void;
  isDirty: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-resize
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    },
    [onChange]
  );

  // Auto-resize on mount
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value]
  );

  return (
    <section
      id={sectionAnchor(section.heading)}
      className={cn(
        "scroll-mt-20 rounded-lg border p-4 transition-colors",
        isDirty
          ? "border-l-4 border-l-primary border-border bg-card"
          : "border-border bg-card"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-xl font-bold">{section.heading}</h2>
        {isDirty && (
          <Badge variant="secondary" className="text-[10px]">
            Modified
          </Badge>
        )}
      </div>
      <textarea
        ref={setRef}
        value={value}
        onChange={handleInput}
        className={cn(
          "w-full resize-none rounded-md border border-border bg-background px-3 py-2",
          "font-mono text-sm leading-relaxed text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
          "min-h-[120px]"
        )}
        spellCheck={false}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer (view mode)
// ---------------------------------------------------------------------------

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-4 mt-6 text-2xl font-bold text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed text-foreground/90">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-4 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-foreground/80">{children}</em>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={cn("text-sm", className)}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-foreground/90">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-4 border-l-4 border-primary pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse border border-border text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border px-3 py-2 text-left text-sm font-medium text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-3 py-2 text-sm text-foreground/90">
      {children}
    </td>
  ),
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ""}
      className="my-4 max-w-full rounded-lg"
    />
  ),
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuideContent({ post }: { post: PostDetail }) {
  const [lang, setLang] = useState<Lang>("en");
  const [tocOpen, setTocOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const sortedSections = [...(post.sections || [])].sort(
    (a, b) => a.order - b.order
  );

  // Draft content keyed by sectionId+lang
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of sortedSections) {
      init[`${s.id}:en`] = s.content.en || "";
      init[`${s.id}:pt-br`] = s.content["pt-br"] || "";
    }
    return init;
  });

  // Original content for dirty detection
  const [originals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of sortedSections) {
      init[`${s.id}:en`] = s.content.en || "";
      init[`${s.id}:pt-br`] = s.content["pt-br"] || "";
    }
    return init;
  });

  const isDirty = useCallback(
    (sectionId: string) => {
      return (
        drafts[`${sectionId}:en`] !== originals[`${sectionId}:en`] ||
        drafts[`${sectionId}:pt-br`] !== originals[`${sectionId}:pt-br`]
      );
    },
    [drafts, originals]
  );

  const hasAnyChanges = sortedSections.some((s) => isDirty(s.id));

  const handleDraftChange = useCallback(
    (sectionId: string, langKey: Lang, value: string) => {
      setDrafts((prev) => ({ ...prev, [`${sectionId}:${langKey}`]: value }));
    },
    []
  );

  const handleCancel = useCallback(() => {
    // Reset drafts to originals
    setDrafts({ ...originals });
    setIsEditing(false);
    setSaveMessage(null);
  }, [originals]);

  const handleSave = useCallback(async () => {
    if (!hasAnyChanges) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Build sections payload with updated content
      const sections = sortedSections.map((s) => ({
        sectionId: s.id,
        title: s.heading,
        content: {
          en: drafts[`${s.id}:en`] ?? s.content.en,
          "pt-br": drafts[`${s.id}:pt-br`] ?? s.content["pt-br"],
        },
      }));

      await updatePost(post.slug, { sections });

      setSaveMessage({ type: "success", text: "Sections saved successfully." });

      // Update originals to match new drafts (so dirty detection resets)
      // We do this by reloading — simpler than mutating refs
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save changes";
      setSaveMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  }, [hasAnyChanges, sortedSections, drafts, post.slug]);

  const title = post.title[lang] || post.title.en;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/workspace/guides"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Guides</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Save message */}
            {saveMessage && (
              <span
                className={cn(
                  "text-xs",
                  saveMessage.type === "success"
                    ? "text-green-500"
                    : "text-destructive"
                )}
              >
                {saveMessage.text}
              </span>
            )}

            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasAnyChanges}
                >
                  {isSaving ? (
                    <Spinner size="sm" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  title="Ver audit log do pipeline"
                >
                  <Link href={`/workspace/guides/${post.slug}/log`}>
                    <ClipboardList className="h-4 w-4" />
                    Audit log
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setSaveMessage(null);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </>
            )}

            <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <TabsList>
                <TabsTrigger value="en">EN</TabsTrigger>
                <TabsTrigger value="pt-br">PT-BR</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Title block */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {templateLabel(post.template)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(post.generatedAt)}
            </span>
            {isEditing && (
              <Badge variant="outline" className="text-xs">
                Editing
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            {title}
          </h1>
          {post.meta?.description?.[lang] && (
            <p className="mt-3 text-lg text-muted-foreground">
              {post.meta.description[lang]}
            </p>
          )}
        </div>

        {/* Table of Contents */}
        {sortedSections.length > 1 && (
          <div className="mb-8 rounded-lg border border-border bg-card p-4">
            <button
              onClick={() => setTocOpen(!tocOpen)}
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground"
            >
              <List className="h-4 w-4" />
              Table of Contents
              <span className="ml-auto text-xs text-muted-foreground">
                {tocOpen ? "Hide" : "Show"}
              </span>
            </button>
            {tocOpen && (
              <nav className="mt-3 space-y-1 border-t border-border pt-3">
                {sortedSections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${sectionAnchor(section.heading)}`}
                    className={cn(
                      "block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      isEditing &&
                        isDirty(section.id) &&
                        "border-l-2 border-l-primary pl-3"
                    )}
                  >
                    {section.heading}
                    {isEditing && isDirty(section.id) && (
                      <span className="ml-2 text-[10px] text-primary">
                        modified
                      </span>
                    )}
                  </a>
                ))}
              </nav>
            )}
          </div>
        )}

        {/* Sections */}
        <article className="space-y-10">
          {sortedSections.map((section) => {
            if (isEditing) {
              return (
                <SectionEditor
                  key={section.id}
                  section={section}
                  lang={lang}
                  value={drafts[`${section.id}:${lang}`] ?? ""}
                  onChange={(val) => handleDraftChange(section.id, lang, val)}
                  isDirty={isDirty(section.id)}
                />
              );
            }

            const content =
              section.content[lang] || section.content.en || "";
            return (
              <section
                key={section.id}
                id={sectionAnchor(section.heading)}
                className="scroll-mt-20"
              >
                <h2 className="mb-4 text-2xl font-bold">{section.heading}</h2>
                <div className="markdown-content">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents as any}
                  >
                    {content}
                  </Markdown>
                </div>
              </section>
            );
          })}
        </article>

        {/* Empty state */}
        {sortedSections.length === 0 && (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              This guide has no content sections yet.
            </p>
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/workspace/guides"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all guides
          </Link>
        </div>
      </div>
    </div>
  );
}
