import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { formatDistanceToNow } from "date-fns";
import { CompetitorFilters } from "./competitor-filters";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    domain?: string;
    category?: string;
    longevity?: string;
    isPoeRelated?: string;
    search?: string;
    sortBy?: string;
  }>;
}

async function fetchPages(
  page: number,
  limit: number,
  domain: string,
  category: string,
  longevity: string,
  isPoeRelated: string,
  search: string,
  sortBy: string
) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (domain) params.set('domain', domain);
  if (category) params.set('category', category);
  if (longevity) params.set('longevity', longevity);
  if (isPoeRelated) params.set('isPoeRelated', isPoeRelated);
  if (search) params.set('search', search);
  if (sortBy) params.set('sortBy', sortBy);

  const url = `${proto}://${host}/api/engine/seo/competitors/pages?${params.toString()}`;

  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  return res.json();
}

export default async function CompetitorPagesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const page = parseInt(raw.page || "1", 10);
  const limit = parseInt(raw.limit || "50", 10);
  const domain = raw.domain || "";
  const category = raw.category || "";
  const longevity = raw.longevity || "";
  const isPoeRelated = raw.isPoeRelated || "";
  const search = raw.search || "";
  const sortBy = raw.sortBy || "";

  let result = null;
  let error = null;
  try {
    result = await fetchPages(page, limit, domain, category, longevity, isPoeRelated, search, sortBy);
  } catch (e) {
    error = (e as Error).message;
  }

  const rows = result?.data || [];
  const meta = result?.meta || { total: 0, page: 1, limit: 50, totalPages: 1 };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Competitor Pages"
        description="Todas as páginas indexadas via rastreamento de sitemaps dos concorrentes."
        className="mb-2"
      />

      <CompetitorFilters />

      {error ? (
        <div className="bg-surface border border-border rounded-lg p-4 text-sm text-destructive">
          Falha ao carregar páginas: {error}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-background/50 border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Keywords</th>
                  <th className="px-4 py-3 font-medium">Relevance</th>
                  <th className="px-4 py-3 font-medium">Longevity</th>
                  <th className="px-4 py-3 font-medium text-right">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Crawled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma página encontrada.
                    </td>
                  </tr>
                ) : (
                  rows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-foreground/5 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{row.domain}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[300px] truncate">
                        <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {row.title || row.slug || row.url.split('/').pop() || 'Unknown'}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {row.keywords?.slice(0, 3).map((kw: string) => (
                            <span key={kw} className="bg-foreground/10 text-[10px] px-1.5 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                          {row.keywords?.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{row.keywords.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.isPoeRelated === true && <span className="text-emerald-400 text-xs">PoE</span>}
                        {row.isPoeRelated === false && <span className="text-red-400 text-xs">Off-topic</span>}
                        {row.isPoeRelated === null && <span className="text-muted-foreground text-xs">Pending</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.longevity === 'evergreen' && <span className="text-emerald-400 text-xs">Evergreen</span>}
                        {row.longevity === 'patch-specific' && <span className="text-blue-400 text-xs">Patch</span>}
                        {row.longevity === 'outdated' && <span className="text-red-400 text-xs">Outdated</span>}
                        {!row.longevity && <span className="text-muted-foreground text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {row.pageUpdatedAt ? formatDistanceToNow(new Date(row.pageUpdatedAt), { addSuffix: true }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {row.lastCrawledAt ? formatDistanceToNow(new Date(row.lastCrawledAt), { addSuffix: true }) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Mostrando {rows.length} de {meta.total} páginas
            </span>
            <div className="flex items-center gap-2">
              {meta.page > 1 && (
                <a 
                  href={`?${new URLSearchParams({ ...raw, page: String(meta.page - 1), limit: String(meta.limit) } as any).toString()}`} 
                  className="px-3 py-1 bg-background border border-border rounded hover:bg-foreground/10"
                >
                  Anterior
                </a>
              )}
              {meta.page < meta.totalPages && (
                <a 
                  href={`?${new URLSearchParams({ ...raw, page: String(meta.page + 1), limit: String(meta.limit) } as any).toString()}`} 
                  className="px-3 py-1 bg-background border border-border rounded hover:bg-foreground/10"
                >
                  Próxima
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
