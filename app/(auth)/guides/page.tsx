import Link from "next/link";
import { fetchPosts, type PostSummary } from "@/lib/content-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: "Guides | Path of Trade",
  description:
    "Browse Path of Exile guides — build guides, mechanic explanations, and more.",
  openGraph: {
    title: "Guides | Path of Trade",
    description:
      "Browse Path of Exile guides — build guides, mechanic explanations, and more.",
  },
};

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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function GuideCard({ post }: { post: PostSummary }) {
  return (
    <Link href={`/guides/${post.slug}`}>
      <Card className="h-full transition-colors hover:border-ring/50 hover:bg-card/80">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {templateLabel(post.template)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(post.generatedAt)}
            </span>
          </div>
          <CardTitle className="mt-2 text-lg leading-tight">
            {post.title.en}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{post.title["pt-br"]}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function GuidesPage() {
  let posts: PostSummary[] = [];
  let error: string | null = null;

  try {
    posts = await fetchPosts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load guides";
  }

  const templateCounts: Record<string, number> = {};
  for (const p of posts) {
    templateCounts[p.template] = (templateCounts[p.template] || 0) + 1;
  }

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Guides
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse Path of Exile guides — build guides, mechanic explanations, and more.
            </p>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Published</div>
              <div className="text-lg font-bold text-foreground">{posts.length}</div>
            </div>
            {Object.entries(templateCounts).map(([template, count]) => (
              <div key={template} className="flex items-center gap-4">
                <div className="w-px h-8 bg-border" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{templateLabel(template)}</div>
                  <div className="text-lg font-bold text-foreground">{count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure the content engine API is running.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              No published guides yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <GuideCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
