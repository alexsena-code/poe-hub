# Session 03 — Carryover da session 02 + rearquitetura /seo

Data inicial: 2026-04-23 (mesma data da session 02 — workflow intensivo).

## Contexto em 60s (pra próximo Claude retomando do zero)

Session 02 (HEAD antes = `874c980`) fechou com 4 refactors paralelos:

1. **S02.a** — PageHeader com prop `accent?: string` aplicado em ~17 pages;
   accent emerald nos 6 headers de `/seo`.
2. **S02.b** — BriefingForm 710→460L + 10 sub-files em
   `components/engine/briefing/` + 9 testes de `stitch-notes`.
3. **S02.c** — simulation-comparison 1379L → 11 sub-files em
   `components/modules/simulations/simulation-comparison/` (maior 287L).
4. **S02.d** — hardware 2403→360L + builder 1346→529L; 10 sub-files em
   `components/modules/hardware/`.
5. **Wrap** — `/admin/design-preview` deletado; sidebar entry removida.

**God files >500L restantes (wc -l raw)** — top 10 atual:

| Arquivo | Linhas |
|---|---:|
| `app/(auth)/seo/youtube/page.tsx` | 2120 |
| `app/(auth)/seo/research/page.tsx` | 1289 |
| `components/modules/hardware/store-prices-tab.tsx` | 955 |
| `app/(auth)/workspace/ideas/page.tsx` | 928 |
| `app/(auth)/seo/reddit/page.tsx` | 924 |
| `app/(auth)/hardware/settings/page.tsx` | 801 |
| `app/(auth)/workspace/templates/page.tsx` | 763 |
| `components/modules/simulations/simulation-editor.tsx` | 755 |
| `app/(auth)/admin/config/costs/page.tsx` | 727 |
| `components/modules/simulations/week-editor.tsx` | 718 |

## Sanity check antes de começar

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -5                             # Inclui 874c980 no topo
git status --short                               # Vazio
npx next build 2>&1 | tail -5                    # Exit 0
npx vitest run components/engine/briefing 2>&1 | tail -5  # 9/9 passed
```

## Tema

Fazer os carryovers da session 02: terminar de encolher god files
(`/seo/youtube`, `/seo/reddit`, `store-prices-tab`) e começar a
rearquitetura de `/seo/research` em 3 rotas reais. Server Components
audit como fase separada.

## Plano de fases

Ordem: mecânicos em paralelo primeiro, rearquitetura depois.

### S03.a — /seo/youtube split (2120L)
Maior god file restante. State denso: TrendingKeyword, AggregatedKeyword,
ActiveChannel, Video, YouTubeTrendsData, KeywordOpportunity — 6 tipos
principais. Página combina trends summary + aggregated keywords view +
videos list + channels active + opportunities integration.

Split proposto em `components/modules/seo/youtube/`:
- `types.ts`, `helpers.ts` (formatters), `use-youtube-state.ts` (hook).
- `trends-summary.tsx` (cards de métricas).
- `aggregated-keywords-table.tsx` (a tabela principal de keywords).
- `videos-list.tsx` (lista de videos recentes).
- `active-channels.tsx` (channels scannedz).
- `opportunities-integration.tsx` (KeywordOpportunity → promote-to-brief).
- `page.tsx` vira orchestrator ≤500L.

### S03.b — /seo/reddit split (924L)
State menor. Types: TopComment, RedditPost (+ RedditPostRaw raw shape).
Helpers: normalizePost, formatNumber, formatDate, timeAgo, subredditColor.
Página tem lista de posts + filters por subreddit + top comments expansíveis
+ PoB links detectados.

Split em `components/modules/seo/reddit/`:
- `types.ts`, `helpers.ts`, `use-reddit-state.ts`.
- `post-card.tsx` (card individual).
- `posts-list.tsx`.
- `subreddit-filter.tsx`.
- `comments-panel.tsx` (expanded top comments).
- `page.tsx` orchestrator ≤500L.

### S03.c — store-prices-tab split (955L)
Dentro de `components/modules/hardware/`. State: storeProducts, categoria,
filtros (search, price, spec-*), view (grid/table), sort, pagination, sync,
priceComparison, 12 spec filter states.

Split em `components/modules/hardware/store-prices/`:
- `types.ts` (locais do tab), `helpers.ts` (já existe no parent — aproveitar).
- `use-store-filters.ts` (hook com todos os filters + sort + page).
- `spec-filters.tsx` (os 12 spec selects).
- `product-grid.tsx`, `product-table.tsx`.
- `sync-actions.tsx` (sync, add-item, load-into-form).
- `price-comparison-panel.tsx`.
- `index.tsx` orchestrator ≤500L.

### S03.d — /seo/research rearquitetura em 3 rotas reais
**Não é só split** — envolve spec de features novas.

Estado atual:
- `/seo/research/page.tsx` (1289L) — keyword discovery, scan controls,
  VICE score list com filtros (cluster, source, game, intent).
- `/seo/analysis/page.tsx` — placeholder.
- `/seo/opportunities/page.tsx` — placeholder.

Spec proposta (revisar com operator antes de executar):

- **`/seo/research`** — keyword discovery puro. Scan controls (YouTube,
  Reddit, GSC), VICE score list com filtros. Reduzir removendo tudo
  que não é research. Target ≤500L.
- **`/seo/analysis`** — SerpAnalysis fetch por keyword. ContentScorer
  output (score + missing entities/headings). Gap fill trigger. Consome
  endpoints `/api/engine/seo/serp/*` + `/api/engine/seo/score`.
- **`/seo/opportunities`** — striking distance keywords + GSC
  underperformers + priority queue. Lista ranqueada com actions
  (promote to brief, dismiss).

**Dependência**: engine session 21 Fase C já shipou ContentScorer; Fase
D (Gap Filler) talvez precise confirmação antes de linkar action.
Verificar em `../path-of-trade-content/docs/PROGRESS.md`.

### S03.e — Server Components audit
Hoje: 46 `'use client'` em `app/`, 104 em `components/`. Target (do
carryover): ≤50 total em pages.

Audit read-only primeiro: identificar pages que:
- Fazem apenas data fetching inicial + render (candidatas a RSC).
- São puramente estáticas/markdown (óbvio RSC).
- Precisam de 'use client' por hooks/handlers (manter).

Depois: migrar ~10-20 pages pra RSC em um chunk, re-audit.

Não entra nesta fase imediata — deixar pra após os 4 splits mecânicos.

## Changelog

### S03.b — /seo/reddit split (924L → 197L orchestrator + 11 sub-files)

Arquivos criados em `components/modules/seo/reddit/`:
- `types.ts` (77L) — TopComment, RedditPost, RedditPostRaw, RedditGlobalStats, RedditScanProgress, Tab, TABS, SortDir, SORT_FIELD_MAP, PAGE_SIZE.
- `helpers.ts` (205L) — normalizePost, formatNumber, formatDate, timeAgo, subredditColor, flairColor, computeTrendingPhrases, groupPostsByFlair, getDateFrom.
- `helpers.test.ts` (197L) — 16 testes: normalizePost (4 casos: snake, camel, defaults, precedência), timeAgo (5), formatNumber (3), getDateFrom (4).
- `use-reddit-state.ts` (204L) — hook central com todo o state + fetch + scan + filters + pagination.
- `reddit-primitives.tsx` (107L) — RedditBadge, Tip, SortHeader, useClientSort.
- `scan-controls.tsx` (33L) — botões Scan + Refresh.
- `subreddit-filter.tsx` (112L) — popover com filtros subreddit/flair/period.
- `comments-panel.tsx` (65L) — expanded row: meta, selftext preview, top comments.
- `posts-list.tsx` (165L) — tabela paginada Recent/Top Posts com SortHeaders.
- `build-posts-tab.tsx` (121L) — tabela Build Posts com client-side sort.
- `trending-topics-tab.tsx` (90L) — trending phrases cloud + posts-by-flair table.

`app/(auth)/seo/reddit/page.tsx`: 924L → 197L.

Validação:
- `wc -l` — maior sub-file: helpers.ts (205L). Nenhum >550L.
- `npx next build` — ✓ Compiled successfully + /seo/reddit listado.
- `npx vitest run components/modules/seo/reddit` — 16/16 passed.
- `npx vitest run` — 6 failed | 20 passed (baseline era 6 failed | 19 passed; +1 file = novo helpers.test.ts; 38 pré-existentes unchanged).

### S03.c — store-prices-tab split (955L → 9 sub-files)

- Deleted: `components/modules/hardware/store-prices-tab.tsx` (955L).
- Created: `components/modules/hardware/store-prices/` with 9 files:
  - `types.ts` (20L) — `StoreSortField`, `STORE_PAGE_SIZE`, `STORE_CATEGORIES`, `StoreCategory`.
  - `use-store-filters.ts` (176L) — all 12 spec filter states + search/price/sort/pagination, `buildSpecOptions`, `filteredProducts` derivation.
  - `use-store-state.ts` (99L) — fetch lifecycle, sync, priceComparison; calls `onCategoryChange` to reset filters without circular dep.
  - `spec-filters.tsx` (205L) — category-conditional spec selects via `SpecSelect` helper; mirrors original show/hide logic.
  - `store-controls.tsx` (166L) — category select, search bar, price range, spec-filters composition, view toggle, refresh + sync buttons.
  - `product-grid.tsx` (132L) — responsive 4-col card grid with `ProductCard` and `SpecBadge` helpers.
  - `product-table.tsx` (195L) — dense table view with `SortableHead`, `SpecsCell`, inline base_model edit.
  - `sync-panel.tsx` (34L) — sync results badge banner.
  - `price-comparison-panel.tsx` (92L) — Used vs New comparison table with `SavingsBadge`.
  - `index.tsx` (210L) — orchestrator; `useRef` bridges resetSpecs circular dep.
- Updated: `app/(auth)/hardware/page.tsx` import from `./store-prices-tab` → `./store-prices`.
- All files ≤210L, well under 550L limit. Orchestrator 210L (ideal range met).
- Validation: `npx next build` exit 0; `npx vitest run` 39 failed / 319 passed (all failures pre-existing — e2e infra, cost-configs, simulations; zero hardware failures).

### S03.a — /seo/youtube split (2120L → 443L orchestrator + 12 sub-files)

Deletado o conteúdo inline de `app/(auth)/seo/youtube/page.tsx` (2120L).
Criado `components/modules/seo/youtube/` com 12 arquivos:
- `types.ts` (160L) — todos os tipos: TrendingKeyword, AggregatedKeyword, AggregatedKeywordsResponse, ActiveChannel, Video, YouTubeTrendsData, KeywordOpportunity, ScanRecordRaw, ScanRecord, CompareResult, NewUploadVideo, MonitoredChannel, Tab, SortDir, TimeRange.
- `helpers.ts` (129L) — scoreColor, channelColor, formatNumber, formatDate, formatDuration, timeAgo, intentColor, viceColor, statusColor, mapScanRecord, POE_ENTITIES, extractVideoKeywords.
- `primitives.tsx` (124L) — YtBadge, Tip, SortHeader, useSort (client-only; reusados por todos os tabs).
- `scan-progress.tsx` (117L) — componente de streaming progress bar com step indicators e log viewer.
- `trending-tab.tsx` (388L) — tab principal: fetch de aggregated keywords, tabela com expand-row (KeywordDetailRow + ExpandableVideoList), displayLimit controls.
- `top-videos-tab.tsx` (271L) — scan selector (latest/all/specific), merge de videos de múltiplos scans, tabela com view bar.
- `channels-tab.tsx` (156L) — tabela de channels com painel lateral de videos do canal selecionado.
- `videos-tab.tsx` (121L) — tabela simples de videos recentes sortable.
- `db-keywords-tab.tsx` (157L) — tabela de KeywordOpportunity do DB (YouTube source) com VICE score.
- `scan-history-tab.tsx` (438L) — lista de scans com compare-two-scans feature + CompareResults (rising/new/declining).
- `new-uploads-tab.tsx` (177L) — card list com thumbnails YouTube, filtros por time range + tipo.
- `manage-channels-tab.tsx` (180L) — add/remove monitored channels.

Page.tsx final: 443L. PageHeader com `accent="var(--color-seo)"` confirmado.
Ajuste notável: `ManageChannelsTab` corrigiu bug da lógica de `confirmDelete` — original usava `ch.channelId || ch.channel_id` sem resolver para variável estável.
Validação:
- `wc -l` — maior sub-file: trending-tab.tsx (388L), scan-history-tab.tsx (438L). Todos ≤500L.
- `npx next build` — ✓ exit 0, `/seo/youtube` listado como Dynamic.
- `npx vitest run` — 6 failed | 20 passed / 38 failed | 320 passed (baseline: 38 failed; zero regressões).

### S03.d — /seo research rearquitetura (1289L → 3 rotas reais)

**Auto-spec executada (Opção B, autonomia concedida)**: redistribuiu os 7 tabs do
antigo `/seo/research` em 3 rotas com propósito distinto.

**Pages finais**:
- `app/(auth)/seo/research/page.tsx` — 197L (was 1289L). Discovery & pipeline:
  All Keywords (server-paginated), Scan History, Blacklist. Header actions:
  suggest scan, competitor crawl, import gaps.
- `app/(auth)/seo/opportunities/page.tsx` — 131L (was 14L placeholder). Priority
  views: Striking Distance, CTR Problems, Ramping. Lazy load por tab.
- `app/(auth)/seo/analysis/page.tsx` — 84L (was 15L placeholder). Deep dive por
  keyword: input → SERP snapshot + Competitor Analysis side-by-side.

**Sub-files** (17 em `components/modules/seo/`):
- `shared/` — `types.ts` (121L), `helpers.ts` (86L), `seo-primitives.tsx` (149L).
- `research/` — `use-research-state.ts` (246L), `filters-bar.tsx` (129L),
  `scan-actions.tsx` (88L), `keywords-tab.tsx` (252L), `scan-history-tab.tsx`
  (66L), `blacklist-tab.tsx` (81L).
- `opportunities/` — `use-opportunities-state.ts` (87L), `striking-distance-tab.tsx`
  (76L), `ctr-problems-tab.tsx` (64L), `ramping-tab.tsx` (112L).
- `analysis/` — `use-analysis-state.ts` (94L), `keyword-input.tsx` (61L),
  `serp-results-table.tsx` (76L), `competitor-analysis-panel.tsx` (157L).

Maior arquivo: `keywords-tab.tsx` (252L). Todos os 7 tabs originais preservados
na redistribuição. ContentScorer stubbed — precisa textarea de draft pra gap
fill (marked TODO engine session N).

Endpoints confirmados: `/seo/dashboard`, `/seo/keywords`, `/seo/keywords/count`,
`/seo/striking-distance`, `/seo/ctr-problems`, `/seo/keywords/ramping`,
`/seo/scans`, `/seo/blacklist` GET/POST/DELETE, `/seo/scan/suggest`,
`/seo/competitors/crawl`, `/seo/competitors/import-gaps`, `/seo/serp/latest`,
`/seo/serp/analyze`, `/seo/analyze/keyword`.

### Design sweep — Spinner compartilhado (2026-04-23)

Triggered pelo feedback do operator (memory: design-project-wide).

Criado `components/ui/spinner.tsx` com prop `size` (xs/sm/md/lg) + `className`
+ `ariaLabel`. Usa `currentColor` — herda cor do container.

Substituído em 13 arquivos (agent também identificou `Loader2` do lucide-react
como pattern equivalente, além do SVG custom):
- `components/engine/briefing/submit-button.tsx`, `OutlineEditor.tsx`,
  `editor/SectionEditor.tsx`.
- `app/(auth)/dashboard/page.tsx`, `farm/prices/page.tsx`, `workspace/guides/
  [slug]/guide-content.tsx`.
- `app/(auth)/admin/config/{leagues,proxy,users}/page.tsx`.
- `components/modules/tasks/{task-list,kanban-board}.tsx`.
- `components/modules/prices/{price-chart,cross-league-price-chart}.tsx`.

Skipped:
- `/seo/*` (S03.d concorrente).
- `components/ui/sonner.tsx` (Loader2Icon usado como toast icon, não spinner).
- Vários com `RefreshCw` conditional `animate-spin` (ícone de refresh, não
  spinner de loading — semântica diferente).

### S03.e — RSC audit read-only (2026-04-23)

Audit de 28 pages `'use client'` em `app/(auth)/` classificou em 3 tiers:

**Tier 1 (EASY, 4 files)** — migração trivial, chunk único:
- `/admin/observability/page.tsx` (tab orchestrator, tabs internos ficam client).
- `/dashboard/page.tsx` (um fetch inicial + KPI cards).
- `/workspace/guides/[slug]/log/page.tsx` (useParams + fetch único).
- `/workspace/guides/[slug]/page.tsx` (useParams + fetch + passa pra `<GuideContent>`).

**Tier 2 (HYBRID, 7 files)** — RSC shell + client island, um por PR:
- `/hardware/recent`, `/hardware/alerts` — fetch + filter/sort local.
- `/workspace/guides`, `/workspace/people`, `/admin/config/proxy` — fetch + simples CRUD.
- `/seo/keybert` — polling + dispatch.
- `/farm/simulations/annual` — useRouter + dialogs.

**Tier 3 (LOCK, 17 files)** — manter client:
- 6 com react-hook-form (config/costs, config/users, config/leagues, workspace/templates, workspace/slang, farm/simulations/annual/[id] — partial).
- 4 com recharts (hardware/analytics, farm/prices, farm/simulations/annual/[id], hardware/builder — partial).
- 5 com heavy interactive state (seo/youtube, seo/reddit, hardware/page, hardware/builder, seo/research).
- 2 com streaming/SSE (farm/prices, workspace/qa).
- Engine config page (10 lazy-loaded tabs), workspace/ideas (streaming briefs).

### Final wrap (2026-04-23)

Validação integrada dos 3 agents (S03.a + S03.b + S03.c) rodando em paralelo:
- `npx next build` — exit 0, 6.0s, 92/92 pages.
- `npx vitest run` — 6 failed files / 20 passed files; 38 failed / **320 passed** tests.
  Baseline pré-session 03 era 304 passed; +16 novos testes (`components/modules/seo/reddit/helpers.test.ts`).
  38 failures são as DB integration pre-existentes.

Three god files resolvidos: `/seo/youtube` 2120→443L, `/seo/reddit` 924→197L,
`store-prices-tab` 955→210L. God files >1000L restantes: **1** (`/seo/research`
1289L, scope de S03.d — rearquitetura em 3 rotas).

## Carryover para session 04

**RSC Batch 1 (Tier 1 migrations)** — audit feito, execução pendente. 4
candidatos imediatos (trabalho ~2h com cuidado):
- `/admin/observability/page.tsx` — se converter pra shadcn Tabs
  `defaultValue` (sem state explícito), page vira RSC.
- `/dashboard/page.tsx` — fetch `/api/dashboard` → RSC com `headers()`
  forward do cookie pra auth.
- `/workspace/guides/[slug]/page.tsx` — idem (`/api/engine/content/
  posts/[slug]`).
- `/workspace/guides/[slug]/log/page.tsx` — page RSC faz fetch, timeline
  vira client island (`expanded: Set` state).

Considerar primeiro extrair função shared `fetchEngine(path, opts)` que
resolve host + forward cookie — evita repetir o boilerplate em cada RSC.

**Design sweep — pendências**:
- **Inputs manuais**: 19+ arquivos com `rounded-lg border border-border
  bg-surface` pattern. Substituir por shadcn `<Input>` — ~1h scope.
- **Cores hardcoded**: 66 arquivos com `bg-{red,green,orange,amber,blue,
  purple,emerald,zinc}-{100..900}`. Migrar pra semantic tokens. Escopo
  grande — separar em waves: status badges primeiro, depois
  background/border colors.

**God files 500-1000L** (não críticos, só se crescerem):
- `/workspace/ideas` (928L), `/hardware/settings` (801L), `/workspace/
  templates` (763L), `simulation-editor` (755L), `/admin/config/costs`
  (727L), `week-editor` (718L), `pipelines-tab` (700L).

**Outros carryover**:
- ContentScorer UI: textarea de draft + POST `/seo/score` pra gap fill.
- Create-brief-from-analysis action: integrar `/seo/analysis` com
  `/workspace/new?briefId=X` (endpoint de creation precisa ser confirmado
  no engine).

## Notas

- `/seo/youtube` (2120L) não estava listado nas métricas originais do
  session 01 audit — discovery tardia. Já resolvido.
- `deals-tab.tsx` (555L) marginal acima do target (550) — decisão:
  **skip**. Só split se crescer.
- RSC audit + design sweep são fases próprias porque requerem decisão
  caso-a-caso, não são trabalho mecânico.
