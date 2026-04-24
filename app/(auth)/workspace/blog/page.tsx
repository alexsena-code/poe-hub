/**
 * Blog post list — RSC.
 *
 * Queries Sanity for draft posts (drafts.** path) and published posts
 * and renders them in two cards side-by-side.
 *
 * Language filter: ?lang=pt-br|en|all (default "all"). Implemented via
 * search params + Link buttons so it stays RSC without any client state.
 *
 * Dates formatted as dd/mm/yyyy pt-BR per user preference (MEMORY.md).
 * Session 08 S08.h; filter added S10.d.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSanityClient } from "@/lib/sanity/client";
import {
  LIST_DRAFTS_QUERY,
  LIST_PUBLISHED_QUERY,
  type DraftListItem,
  type PublishedListItem,
} from "@/lib/sanity/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Globe } from "lucide-react";
import { PostRow } from "@/components/modules/workspace/blog/post-row";

// ─── Language filter types ────────────────────────────────────────────────────

type LangFilter = "all" | "pt-br" | "en";

// ─── Empty row ───────────────────────────────────────────────────────────────

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">{label}</p>
  );
}

// ─── Language filter pills ────────────────────────────────────────────────────

/** Parses the raw ?lang= query param into a typed filter value. */
function parseLangFilter(raw: string | undefined): LangFilter {
  if (raw === "pt-br" || raw === "en") return raw;
  return "all";
}

interface LangFilterBarProps {
  current: LangFilter;
}

function LangFilterBar({ current }: LangFilterBarProps) {
  const options: { value: LangFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pt-br", label: "PT-BR" },
    { value: "en", label: "EN" },
  ];

  return (
    <div className="flex items-center gap-1">
      {options.map(({ value, label }) => (
        <Link
          key={value}
          href={value === "all" ? "/workspace/blog" : `/workspace/blog?lang=${value}`}
          className={cn(
            "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
            current === value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

// ─── Post filter helpers ──────────────────────────────────────────────────────

function applyLangFilter<T extends { language?: string }>(
  posts: T[],
  lang: LangFilter,
): T[] {
  if (lang === "all") return posts;
  return posts.filter((p) => p.language === lang);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  // Best-effort: if Sanity is unreachable, render empty lists so the page
  // doesn't hard-error. Operator is notified via the empty state messaging.
  let drafts: DraftListItem[] = [];
  let published: PublishedListItem[] = [];

  try {
    const client = getSanityClient();
    [drafts, published] = await Promise.all([
      client.fetch<DraftListItem[]>(LIST_DRAFTS_QUERY),
      client.fetch<PublishedListItem[]>(LIST_PUBLISHED_QUERY),
    ]);
  } catch {
    // Sanity unreachable — empty state renders below
  }

  const { lang: langRaw } = await searchParams;
  const langFilter = parseLangFilter(langRaw);
  const visibleDrafts = applyLangFilter(drafts, langFilter);
  const visiblePublished = applyLangFilter(published, langFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Posts em rascunho e publicados no Sanity."
        accent="var(--color-blue-500, #3b82f6)"
        actions={
          <div className="flex items-center gap-3">
            <LangFilterBar current={langFilter} />
            <Button asChild size="sm">
              <Link href="/workspace/blog/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo post
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Drafts card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-amber-400" />
              Rascunhos
              <Badge variant="secondary" className="ml-auto text-xs">
                {visibleDrafts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {visibleDrafts.length === 0 ? (
              <EmptyRow label="Nenhum rascunho salvo." />
            ) : (
              <div className="divide-y divide-border">
                {visibleDrafts.map((post) => (
                  <PostRow key={post._id} post={post} isDraft />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Published card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-emerald-400" />
              Publicados
              <Badge variant="secondary" className="ml-auto text-xs">
                {visiblePublished.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {visiblePublished.length === 0 ? (
              <EmptyRow label="Nenhum post publicado ainda." />
            ) : (
              <div className="divide-y divide-border">
                {visiblePublished.map((post) => (
                  <PostRow key={post._id} post={post} isDraft={false} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
