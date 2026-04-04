import Link from "next/link";
import { fetchPosts, type PostSummary } from "@/lib/content-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowLeft } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Guides</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
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
      </main>
    </div>
  );
}
