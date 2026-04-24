'use client';

import Link from "next/link";
import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Pencil,
  Eye,
  FileEdit,
  RefreshCw,
  AlertCircle,
  Trash2,
  Activity,
} from "lucide-react";

const API = '/api/engine';

export interface PostSummary {
  slug: string;
  title: { "pt-br": string; en: string };
  template: string;
  status: string;
  generatedAt: string;
  pendingHumanCount?: number;
}

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

interface GuidesClientProps {
  initialPosts: PostSummary[];
}

export function GuidesClient({ initialPosts }: GuidesClientProps) {
  const [posts, setPosts] = useState<PostSummary[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const onlyPending = searchParams.get('pending') === '1';

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/content/posts`);
      if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  async function deletePost(slug: string, title: string) {
    if (!confirm(`Excluir o post "${title}"?\nOs arquivos JSON/MD serão removidos do disco.`)) return;
    try {
      const res = await fetch(`${API}/content/posts/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
    } catch (e) {
      alert(`Falha ao excluir: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  const templateCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const p of posts) {
    templateCounts[p.template] = (templateCounts[p.template] || 0) + 1;
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }
  const pendingTotal = posts.reduce((acc, p) => acc + (p.pendingHumanCount ?? 0), 0);
  const visiblePosts = onlyPending
    ? posts.filter((p) => (p.pendingHumanCount ?? 0) > 0)
    : posts;

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
            {pendingTotal > 0 && (
              <Link
                href={onlyPending ? '/workspace/guides' : '/workspace/guides?pending=1'}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  onlyPending
                    ? 'border-amber-500/60 bg-amber-900/40 text-amber-100'
                    : 'border-amber-700/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40'
                }`}
                title={onlyPending ? 'Mostrar todos' : 'Filtrar: aguardando seu input'}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {onlyPending ? `Filtrando: ${pendingTotal} pendente(s)` : `${pendingTotal} aguardam você`}
              </Link>
            )}
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
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/workspace/new"
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
        ) : loading ? (
          <div className="py-16 text-center text-muted-foreground">Carregando...</div>
        ) : visiblePosts.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              Nenhum post gerado ainda.
            </p>
            <Link
              href="/workspace/new"
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
              {visiblePosts.map((post) => (
                <tr
                  key={post.slug}
                  className={`border-b border-border/50 hover:bg-surface transition-colors ${
                    (post.pendingHumanCount ?? 0) > 0 ? 'bg-amber-950/10' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{post.title.en}</span>
                        {(post.pendingHumanCount ?? 0) > 0 && (
                          <span
                            title={`${post.pendingHumanCount} seção(ões) aguardando seu input`}
                            className="inline-flex items-center gap-1 rounded border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {post.pendingHumanCount}
                          </span>
                        )}
                      </div>
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
                        href={`/workspace/guides/${post.slug}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                      <Link
                        href={`/workspace/editor/${post.slug}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Abrir no Co-Writer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Co-Writer
                      </Link>
                      <Link
                        href={`/workspace/guides/${post.slug}?edit=true`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Editar inline"
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                      <Link
                        href={`/workspace/guides/${post.slug}/trace`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Ver trace de geração (prompts, chunks, decisões)"
                      >
                        <Activity className="h-3.5 w-3.5" />
                        Trace
                      </Link>
                      <button
                        type="button"
                        onClick={() => deletePost(post.slug, post.title.en || post.title["pt-br"] || post.slug)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir post"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
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
