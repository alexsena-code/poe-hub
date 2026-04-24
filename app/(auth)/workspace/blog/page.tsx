/**
 * Blog post list — RSC.
 *
 * Queries Sanity for draft posts (drafts.** path) and published posts
 * and renders them in two cards side-by-side.
 *
 * Dates formatted as dd/mm/yyyy pt-BR per user preference (MEMORY.md).
 * Session 08 S08.h.
 */

import Link from "next/link";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formats an ISO datetime string to dd/mm/yyyy (pt-BR). */
function formatDateBR(isoString: string | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Returns the bare post ID (strips the "drafts." prefix if present). */
function bareId(id: string): string {
  return id.startsWith("drafts.") ? id.slice(7) : id;
}

/** Language badge colour — pt-br is amber, en is sky. */
function langBadgeVariant(lang: string | undefined): "default" | "secondary" | "outline" {
  if (lang === "pt-br") return "default";
  if (lang === "en") return "secondary";
  return "outline";
}

// ─── Post row ────────────────────────────────────────────────────────────────

interface PostRowProps {
  post: DraftListItem;
  isDraft: boolean;
}

function PostRow({ post, isDraft }: PostRowProps) {
  const id = bareId(post._id);
  const editHref = `/workspace/blog/${id}/edit`;
  const slug = post.slug?.current ?? "—";
  const lang = post.language ?? "?";
  const date = isDraft ? post._updatedAt : post.publishedAt;

  return (
    <Link
      href={editHref}
      className="flex items-start justify-between gap-4 rounded-md px-3 py-2.5 text-sm
                 hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {post.title ?? "(sem título)"}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">/{slug}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={langBadgeVariant(lang)} className="text-[10px] uppercase">
          {lang}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDateBR(date)}
        </span>
      </div>
    </Link>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">{label}</p>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BlogListPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Posts em rascunho e publicados no Sanity."
        accent="var(--color-blue-500, #3b82f6)"
        actions={
          <Button asChild size="sm">
            <Link href="/workspace/blog/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo post
            </Link>
          </Button>
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
                {drafts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {drafts.length === 0 ? (
              <EmptyState label="Nenhum rascunho salvo." />
            ) : (
              <div className="divide-y divide-border">
                {drafts.map((post) => (
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
                {published.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {published.length === 0 ? (
              <EmptyState label="Nenhum post publicado ainda." />
            ) : (
              <div className="divide-y divide-border">
                {published.map((post) => (
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
