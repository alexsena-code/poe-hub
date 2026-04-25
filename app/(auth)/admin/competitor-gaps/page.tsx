import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { GapFiltersBar } from "@/components/admin/competitor-gaps/gap-filters-bar";
import { GapsTable } from "@/components/admin/competitor-gaps/gaps-table";
import { ImportGapsButton } from "@/components/admin/competitor-gaps/import-gaps-button";
import type { GapRow } from "@/components/admin/competitor-gaps/types";

interface PageProps {
  searchParams: Promise<{
    minCompetitors?: string;
    limit?: string;
    onlyUncovered?: string;
  }>;
}

const MIN_COMP_DEFAULT = 2;
const LIMIT_DEFAULT = 50;
const MIN_COMP_RANGE = { min: 1, max: 20 };
const LIMIT_RANGE = { min: 1, max: 500 };

function clamp(n: number, range: { min: number; max: number }) {
  return Math.max(range.min, Math.min(range.max, n));
}

function parseFilters(raw: { minCompetitors?: string; limit?: string; onlyUncovered?: string }) {
  const minComp = clamp(
    Number.parseInt(raw.minCompetitors ?? "", 10) || MIN_COMP_DEFAULT,
    MIN_COMP_RANGE,
  );
  const limit = clamp(
    Number.parseInt(raw.limit ?? "", 10) || LIMIT_DEFAULT,
    LIMIT_RANGE,
  );
  const onlyUncovered = raw.onlyUncovered ? raw.onlyUncovered !== "false" : true;
  return { minComp, limit, onlyUncovered };
}

async function fetchGaps(filters: {
  minComp: number;
  limit: number;
  onlyUncovered: boolean;
}): Promise<GapRow[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const params = new URLSearchParams({
    minCompetitors: String(filters.minComp),
    limit: String(filters.limit),
    onlyUncovered: String(filters.onlyUncovered),
  });
  const url = `${proto}://${host}/api/engine/seo/competitors/gaps?${params.toString()}`;

  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`gaps fetch failed: ${res.status} (${url})`);
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as GapRow[]) : [];
}

export default async function CompetitorGapsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  let rows: GapRow[];
  let fetchError: string | null = null;
  try {
    rows = await fetchGaps(filters);
  } catch (e) {
    rows = [];
    fetchError = (e as Error).message;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Competitor gaps"
        description="Tópicos cobertos por N+ competidores que ainda não temos coverage. Use os filtros para refinar e importe como keyword opportunities em lote."
        className="mb-2"
      />

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <GapFiltersBar
          initialMinComp={filters.minComp}
          initialLimit={filters.limit}
          initialOnlyUncovered={filters.onlyUncovered}
          minRange={MIN_COMP_RANGE}
          limitRange={LIMIT_RANGE}
        />
        <ImportGapsButton uncoveredCount={rows.filter(r => !r.ourCoverage).length} />
      </div>

      {fetchError ? (
        <div className="bg-surface border border-border rounded-lg p-4 text-sm text-destructive">
          Falha ao carregar gaps: {fetchError}
        </div>
      ) : (
        <GapsTable rows={rows} />
      )}
    </div>
  );
}
