import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { CompetitorFilters } from "./competitor-filters";
import { RawTextDialog } from "./raw-text-dialog";

// Raw-first contract (engine rewrite): pages no longer carry longevity or
// isPoeRelated — only structural fields + rawText from the crawl.
interface CompetitorPageRow {
  id: string;
  domain: string;
  url: string;
  title: string | null;
  slug: string | null;
  category: string | null;
  fetchedAt: string | null;
  lastCrawledAt: string | null;
  rawText: string | null;
}

interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FetchPagesResult {
  data: CompetitorPageRow[];
  meta: PageMeta;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    domain?: string;
    category?: string;
    search?: string;
    sortBy?: string;
  }>;
}

// Formats a date string as dd/mm/yyyy in pt-BR locale.
function formatDateBR(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function fetchPages(
  page: number,
  limit: number,
  domain: string,
  category: string,
  search: string,
  sortBy: string
): Promise<FetchPagesResult> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (domain) params.set("domain", domain);
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  if (sortBy) params.set("sortBy", sortBy);

  const url = `${proto}://${host}/api/engine/seo/competitors/pages?${params.toString()}`;

  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} (${url})`);
  }
  return res.json() as Promise<FetchPagesResult>;
}

function pageLabel(row: CompetitorPageRow): string {
  return row.title ?? row.slug ?? row.url.split("/").pop() ?? "Unknown";
}

export default async function CompetitorPagesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const page = parseInt(raw.page || "1", 10);
  const limit = parseInt(raw.limit || "50", 10);
  const domain = raw.domain || "";
  const category = raw.category || "";
  const search = raw.search || "";
  const sortBy = raw.sortBy || "";

  let result: FetchPagesResult | null = null;
  let error: string | null = null;
  try {
    result = await fetchPages(page, limit, domain, category, search, sortBy);
  } catch (e) {
    error = (e as Error).message;
  }

  const rows = result?.data ?? [];
  const meta: PageMeta = result?.meta ?? { total: 0, page: 1, limit: 50, totalPages: 1 };

  // Build pagination query preserving current filters.
  const paginationBase = new URLSearchParams();
  if (domain) paginationBase.set("domain", domain);
  if (category) paginationBase.set("category", category);
  if (search) paginationBase.set("search", search);
  if (sortBy) paginationBase.set("sortBy", sortBy);
  paginationBase.set("limit", String(limit));

  function pageHref(p: number) {
    const q = new URLSearchParams(paginationBase);
    q.set("page", String(p));
    return `?${q.toString()}`;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Competitor Pages"
        description="Páginas rastreadas dos concorrentes — conteúdo bruto (rawText) coletado pelo crawler."
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
                  <th className="px-4 py-3 font-medium">Título / URL</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Raw Text (preview)</th>
                  <th className="px-4 py-3 font-medium text-right">Coletado em</th>
                  <th className="px-4 py-3 font-medium text-right">Rastreado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma página encontrada.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-foreground/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{row.domain}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px] truncate">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {pageLabel(row)}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {row.category ? (
                          <span className="bg-foreground/10 text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {row.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        {row.rawText ? (
                          <RawTextDialog rawText={row.rawText} title={pageLabel(row)} />
                        ) : (
                          <span className="text-muted-foreground text-xs italic">sem conteúdo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {formatDateBR(row.fetchedAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {formatDateBR(row.lastCrawledAt)}
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
                  href={pageHref(meta.page - 1)}
                  className="px-3 py-1 bg-background border border-border rounded hover:bg-foreground/10"
                >
                  Anterior
                </a>
              )}
              {meta.page < meta.totalPages && (
                <a
                  href={pageHref(meta.page + 1)}
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
