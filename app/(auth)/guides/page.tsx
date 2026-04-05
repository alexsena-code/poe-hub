import Link from "next/link";
import { fetchPosts, type PostSummary } from "@/lib/content-api";
import { BookOpen, Pencil, Eye, FileEdit } from "lucide-react";

export const metadata = {
  title: "Posts | Path of Trade",
  description: "Manage all generated content — view, edit, and track status.",
};

function templateLabel(template: string): string {
  const labels: Record<string, string> = {
    build_guide: "Build Guide",
    mechanic_guide: "Mechanic Guide",
    tier_list: "Tier List",
    meta_report: "Meta Report",
    faq: "FAQ",
    qa_page: "Q&A",
    currency_guide: "Currency Guide",
    atlas_guide: "Atlas Guide",
    league_start: "League Start",
    crafting_guide: "Crafting Guide",
    patch_analysis: "Patch Analysis",
  };
  return labels[template] || template.replace(/_/g, " ");
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Rascunho", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    published: { label: "Publicado", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    reviewing: { label: "Revisao", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    archived: { label: "Arquivado", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  };
  const s = map[status] || { label: status, cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default async function GuidesPage() {
  let posts: PostSummary[] = [];
  let error: string | null = null;

  try {
    posts = await fetchPosts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load posts";
  }

  const templateCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const p of posts) {
    templateCounts[p.template] = (templateCounts[p.template] || 0) + 1;
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Posts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os posts gerados — visualize, edite e acompanhe o status.
            </p>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
              <div className="text-lg font-bold text-foreground">{posts.length}</div>
            </div>
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-4">
                <div className="w-px h-8 bg-border" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{status}</div>
                  <div className="text-lg font-bold text-foreground">{count}</div>
                </div>
              </div>
            ))}
            <div className="w-px h-8 bg-border" />
            <Link
              href="/new"
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors"
            >
              + Novo Post
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Verifique se a API do content engine esta rodando.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              Nenhum post gerado ainda.
            </p>
            <Link
              href="/new"
              className="mt-4 inline-flex px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors"
            >
              Criar primeiro post
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titulo</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.slug}
                  className="border-b border-border/50 hover:bg-surface transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-foreground">{post.title.en}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{post.title["pt-br"]}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-foreground/10 text-muted-foreground border border-border">
                      {templateLabel(post.template)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {statusBadge(post.status)}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {formatDate(post.generatedAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/guides/${post.slug}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                      <Link
                        href={`/editor/${post.slug}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Abrir no Co-Writer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Co-Writer
                      </Link>
                      <Link
                        href={`/guides/${post.slug}?edit=true`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Editar inline"
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
