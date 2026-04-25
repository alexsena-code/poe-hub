// Session 32 (Frontend B): operator-friendly view of `GET /seo/posts/recommended`.
// SSR fetch through the existing /api/engine proxy (cookie-auth), then filter
// by `suggestedAction` in this Server Component before passing rows to the
// Client table — the engine endpoint doesn't accept that filter natively.

import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { PostsRecommendedFilters } from "@/components/seo/posts-recommended/posts-recommended-filters";
import { RecommendationsTable } from "@/components/seo/posts-recommended/recommendations-table";
import { SUGGESTED_ACTIONS } from "@/components/seo/posts-recommended/types";
import type {
  GameFilter,
  PostRecommendation,
  SuggestedAction,
} from "@/components/seo/posts-recommended/types";

interface PageProps {
  searchParams: Promise<{
    game?: string;
    suggestedAction?: string;
    targetPosition?: string;
    limit?: string;
  }>;
}

const GAME_VALUES: GameFilter[] = ["poe1", "poe2", "all"];
const ACTION_SET = new Set<SuggestedAction>(SUGGESTED_ACTIONS);

const TARGET_DEFAULT = 5;
const LIMIT_DEFAULT = 50;
const TARGET_RANGE = { min: 1, max: 10 };
const LIMIT_RANGE = { min: 1, max: 200 };

function clamp(n: number, range: { min: number; max: number }) {
  return Math.max(range.min, Math.min(range.max, n));
}

function parseGame(raw: string | undefined): GameFilter {
  if (raw && (GAME_VALUES as string[]).includes(raw)) return raw as GameFilter;
  return "all";
}

function parseActions(raw: string | undefined): SuggestedAction[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SuggestedAction => ACTION_SET.has(s as SuggestedAction));
}

interface ParsedFilters {
  game: GameFilter;
  actions: SuggestedAction[];
  targetPosition: number;
  limit: number;
}

function parseFilters(raw: {
  game?: string;
  suggestedAction?: string;
  targetPosition?: string;
  limit?: string;
}): ParsedFilters {
  const targetPosition = clamp(
    Number.parseInt(raw.targetPosition ?? "", 10) || TARGET_DEFAULT,
    TARGET_RANGE,
  );
  const limit = clamp(
    Number.parseInt(raw.limit ?? "", 10) || LIMIT_DEFAULT,
    LIMIT_RANGE,
  );
  return {
    game: parseGame(raw.game),
    actions: parseActions(raw.suggestedAction),
    targetPosition,
    limit,
  };
}

async function fetchRecommendations(filters: {
  game: GameFilter;
  targetPosition: number;
  limit: number;
}): Promise<PostRecommendation[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const params = new URLSearchParams({
    targetPosition: String(filters.targetPosition),
    limit: String(filters.limit),
  });
  // Engine treats absence of `game` as no filter; only forward when narrowing.
  if (filters.game !== "all") params.set("game", filters.game);

  const url = `${proto}://${host}/api/engine/seo/posts/recommended?${params.toString()}`;
  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`recommendations fetch failed: ${res.status} (${url})`);
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as PostRecommendation[]) : [];
}

function applyActionFilter(
  rows: PostRecommendation[],
  actions: SuggestedAction[],
): PostRecommendation[] {
  if (actions.length === 0) return rows;
  const allow = new Set(actions);
  return rows.filter((r) => allow.has(r.suggestedAction));
}

export default async function PostsRecommendedPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  let rows: PostRecommendation[];
  let fetchError: string | null = null;
  try {
    rows = await fetchRecommendations({
      game: filters.game,
      targetPosition: filters.targetPosition,
      limit: filters.limit,
    });
  } catch (e) {
    rows = [];
    fetchError = (e as Error).message;
  }

  const visibleRows = applyActionFilter(rows, filters.actions);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Recomendações de posts"
        description="Decisão final por keyword — 4 sinais independentes (Striking GSC, Difficulty SERP, Consolidated comunidade, Clicks30d ROI) + ação sugerida heurística. Operador escolhe quem entra no calendário."
        accent="var(--color-seo)"
        className="mb-2"
      />

      <div className="rounded-lg border border-border bg-surface p-4">
        <PostsRecommendedFilters
          initialGame={filters.game}
          initialActions={filters.actions}
          initialTargetPosition={filters.targetPosition}
          initialLimit={filters.limit}
          targetRange={TARGET_RANGE}
          limitRange={LIMIT_RANGE}
        />
      </div>

      {fetchError ? (
        <div className="bg-surface border border-border rounded-lg p-4 text-sm text-destructive">
          Falha ao carregar recomendações: {fetchError}
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {visibleRows.length} de {rows.length}{" "}
            {rows.length === 1 ? "recomendação" : "recomendações"} após filtro
            de ação.
          </div>
          <RecommendationsTable rows={visibleRows} />
        </>
      )}
    </div>
  );
}
