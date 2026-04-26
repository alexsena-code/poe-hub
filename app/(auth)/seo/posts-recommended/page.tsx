// Session 32 (Frontend B): operator-friendly view of `GET /seo/posts/recommended`.
// SSR fetch through the existing /api/engine proxy (cookie-auth), then filter
// by `suggestedAction` in this Server Component before passing rows to the
// Client table — the engine endpoint doesn't accept that filter natively.
//
// Session 36 Phase O: engine moved to a paginated envelope shape
// (`{ items, total, limit, offset }`). Page now reads `offset` from the URL,
// forwards it to the engine, and renders a Previous/Next pager below the
// table. Action filter (`suggestedAction`) still runs after fetch — it
// narrows the visible slice but doesn't shift `total`, so the pager remains
// driven by the engine's pre-action total.
//
// Backward-compat fallback in `parseEngineResponse` keeps an older bare-array
// engine deploy working: if `data` is an array we wrap it as a single-page
// envelope. Removed once engine is confirmed at session-36 commit.

import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { PostsRecommendedFilters } from "@/components/seo/posts-recommended/posts-recommended-filters";
import { RecommendationsTable } from "@/components/seo/posts-recommended/recommendations-table";
import { RecommendationsPager } from "@/components/seo/posts-recommended/recommendations-pager";
import { SUGGESTED_ACTIONS } from "@/components/seo/posts-recommended/types";
import type {
  GameFilter,
  PostRecommendation,
  PostRecommendationPage,
  SuggestedAction,
} from "@/components/seo/posts-recommended/types";

interface PageProps {
  searchParams: Promise<{
    game?: string;
    suggestedAction?: string;
    targetPosition?: string;
    limit?: string;
    offset?: string;
  }>;
}

const GAME_VALUES: GameFilter[] = ["poe1", "poe2", "all"];
const ACTION_SET = new Set<SuggestedAction>(SUGGESTED_ACTIONS);

const TARGET_DEFAULT = 5;
const LIMIT_DEFAULT = 50;
const OFFSET_DEFAULT = 0;
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
  offset: number;
}

function parseFilters(raw: {
  game?: string;
  suggestedAction?: string;
  targetPosition?: string;
  limit?: string;
  offset?: string;
}): ParsedFilters {
  const targetPosition = clamp(
    Number.parseInt(raw.targetPosition ?? "", 10) || TARGET_DEFAULT,
    TARGET_RANGE,
  );
  const limit = clamp(
    Number.parseInt(raw.limit ?? "", 10) || LIMIT_DEFAULT,
    LIMIT_RANGE,
  );
  const offsetParsed = Number.parseInt(raw.offset ?? "", 10);
  const offset = Number.isFinite(offsetParsed) && offsetParsed > 0
    ? offsetParsed
    : OFFSET_DEFAULT;
  return {
    game: parseGame(raw.game),
    actions: parseActions(raw.suggestedAction),
    targetPosition,
    limit,
    offset,
  };
}

/**
 * Coerce engine response into the envelope shape. Session 36 Phase O ships
 * `{ items, total, limit, offset }`; older deploys returned a bare array.
 * Treat the array case as a single-page envelope so the UI doesn't crash
 * during a partial deploy window.
 */
function parseEngineResponse(
  data: unknown,
  fallbackLimit: number,
  fallbackOffset: number,
): PostRecommendationPage {
  if (Array.isArray(data)) {
    const items = data as PostRecommendation[];
    return {
      items,
      total: items.length,
      limit: fallbackLimit,
      offset: fallbackOffset,
    };
  }
  if (data && typeof data === "object" && "items" in data) {
    return data as PostRecommendationPage;
  }
  return { items: [], total: 0, limit: fallbackLimit, offset: fallbackOffset };
}

async function fetchRecommendations(filters: {
  game: GameFilter;
  targetPosition: number;
  limit: number;
  offset: number;
}): Promise<PostRecommendationPage> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const params = new URLSearchParams({
    targetPosition: String(filters.targetPosition),
    limit: String(filters.limit),
    offset: String(filters.offset),
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
  return parseEngineResponse(data, filters.limit, filters.offset);
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

  let page: PostRecommendationPage;
  let fetchError: string | null = null;
  try {
    page = await fetchRecommendations({
      game: filters.game,
      targetPosition: filters.targetPosition,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (e) {
    page = { items: [], total: 0, limit: filters.limit, offset: filters.offset };
    fetchError = (e as Error).message;
  }

  const visibleRows = applyActionFilter(page.items, filters.actions);

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
            Página {Math.floor(page.offset / page.limit) + 1} —{" "}
            {visibleRows.length} de {page.items.length}{" "}
            {page.items.length === 1 ? "recomendação" : "recomendações"}{" "}
            {filters.actions.length > 0 ? "após filtro de ação" : "nesta página"}
            {" · "}
            {page.total} no total
          </div>
          <RecommendationsTable rows={visibleRows} />
          <RecommendationsPager
            total={page.total}
            limit={page.limit}
            offset={page.offset}
          />
        </>
      )}
    </div>
  );
}
