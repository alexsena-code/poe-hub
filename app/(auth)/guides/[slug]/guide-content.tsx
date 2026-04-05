"use client";

import { useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PostDetail } from "@/lib/content-api";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, List } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function GuideContent({ post }: { post: PostDetail }) {
  const [lang, setLang] = useState<Lang>("en");
  const [tocOpen, setTocOpen] = useState(false);

  const sortedSections = [...(post.sections || [])].sort(
    (a, b) => a.order - b.order
  );

  const title = post.title[lang] || post.title.en;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/guides"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Guides</span>
            </Link>
          </div>
          <Tabs
            value={lang}
            onValueChange={(v) => setLang(v as Lang)}
          >
            <TabsList>
              <TabsTrigger value="en">EN</TabsTrigger>
              <TabsTrigger value="pt-br">PT-BR</TabsTrigger>
            </TabsList>
          </Tabs>
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
                    className="block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {section.heading}
                  </a>
                ))}
              </nav>
            )}
          </div>
        )}

        {/* Sections */}
        <article className="space-y-10">
          {sortedSections.map((section) => {
            const content = section.content[lang] || section.content.en || "";
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
                    components={{
                      h1: ({ children }) => (
                        <h1 className="mb-4 mt-6 text-2xl font-bold text-foreground">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-3 mt-5 text-xl font-semibold text-foreground">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-4 leading-relaxed text-foreground/90">
                          {children}
                        </p>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-primary underline underline-offset-4 hover:text-primary/80"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-foreground/80">{children}</em>
                      ),
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        if (isBlock) {
                          return (
                            <code className={cn("text-sm", className)}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                          {children}
                        </pre>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-4 list-disc space-y-1 pl-6 text-foreground/90">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-4 list-decimal space-y-1 pl-6 text-foreground/90">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="mb-4 border-l-4 border-primary pl-4 text-muted-foreground italic">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-6 border-border" />,
                      table: ({ children }) => (
                        <div className="mb-4 overflow-x-auto">
                          <table className="w-full border-collapse border border-border text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="border border-border px-3 py-2 text-left text-sm font-medium text-foreground">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-border px-3 py-2 text-sm text-foreground/90">
                          {children}
                        </td>
                      ),
                      img: ({ src, alt }) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={alt || ""}
                          className="my-4 max-w-full rounded-lg"
                        />
                      ),
                    }}
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
            href="/guides"
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
