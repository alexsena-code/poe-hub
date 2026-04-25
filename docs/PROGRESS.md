# PoE Hub — Progress Tracker

Last updated: 2026-04-25 (session 16 — /seo bug fixes: `/admin/competitor-gaps` ganhou PipelineStatusBar com 4 contadores granulares + 4 botões inline (crawl/enrich/embed/full-pipeline) e o engine ganhou `runFullPipeline` encadeado; `/admin/auto-actions` ganhou multi-select com checkboxes + bulk approve/reject + reject-all-pending dialog + detail Sheet com metadata JSON e action-type-glossary, com 2 endpoints novos no engine (`bulk-decide` + `reject-all-pending`); `/seo/research` ganhou toggle "Show without signals" (default ON) que relaxa o gate hasSignal no engine — corrige a discrepância "995 totais / tabela vazia" quando keywords não têm GSC/Reddit/YouTube cross-ref + banner amarelo de discrepância + banner rosa de erro de fetch (substitui o `catch {}` mudo). Session 15 anterior — SEO i18n hreflang fix nos posts (`translation.metadata` resolve sibling slugs em vez de assumir slug compartilhado) + `og:locale` em 22 pages do `[locale]/`; bug em prod do `/workspace/blog` zerado (4 envs SANITY_* vazias na Vercel + `catch {}` mudo) corrigido com `console.error` + reset das envs via CLI; right rail polish (320→384, currency chips com ícone real, novo WidgetFilterInput, scrollbar-thin); + 2 commits paralelos do Session 32 (frontend B `posts-recommended` no hub, backend transcript-admin + keyword-analyzer no engine).

## Current status

Operational control panel consuming the `path-of-trade-content` engine
plus self-hosted PoE data pipelines. Live modules (post session 01 IA
rework): `/workspace` (content engine), `/seo`
(research/analysis/opportunities), `/farm` (bots/prices/sales/
simulations), `/admin` (config/observability/tasks), `/hardware`
(deals/builder), `/dashboard`.

Stack: Next.js 16 App Router + Prisma 6 + PostgreSQL 16 + shadcn/ui
(Tailwind v4, **neutral** base) + NextAuth credentials. Tests: Vitest
(**836 passing, 0 falhos**, 1 skipped smoke Sanity) + Playwright (32 E2E,
rodando fora do Vitest glob).

Session 01 landed: 5-domain IA, sidebar rewrite, admin/config fusion,
engine-config split (1944L → 182L + 9 tabs), style Phase 1 (neutral +
semantic colors + typography scale + linear charts).

Session 02 landed (4 parallel refactors):
- **S02.a** — PageHeader backfill + SEO accent sweep (PageHeader ganhou
  prop `accent?: string`; ~17 pages tocadas).
- **S02.b** — BriefingForm 710L → 460L orchestrator + 10 sub-files em
  `components/engine/briefing/` + teste puro `stitch-notes.test.ts`.
- **S02.c** — simulation-comparison 1379L → 11 sub-files em
  `components/modules/simulations/simulation-comparison/` (maior 287L).
- **S02.d** — hardware 2403L → 360L orchestrator + builder 1346L → 529L
  orchestrator + 10 sub-files em `components/modules/hardware/`.
- **Wrap** — `/admin/design-preview` deletado, sidebar entry removida.

Session 03 landed (3 parallel god-file splits + 3 parallel finalization):
- **S03.a** — `/seo/youtube` 2120L → 443L orchestrator + 12 sub-files em
  `components/modules/seo/youtube/`.
- **S03.b** — `/seo/reddit` 924L → 197L orchestrator + 11 sub-files em
  `components/modules/seo/reddit/` + 16 testes novos (`helpers.test.ts`).
- **S03.c** — `store-prices-tab.tsx` 955L → 210L orchestrator + 9
  sub-files em `components/modules/hardware/store-prices/`.
- **S03.d** — `/seo/research` 1289L → 3 rotas reais (research 197L,
  opportunities 131L, analysis 84L) + 17 sub-files em
  `components/modules/seo/{shared,research,opportunities,analysis}/`.
- **S03.e** — RSC audit read-only: 28 pages `'use client'` classificadas
  em 4 Tier 1 (EASY), 7 Tier 2 (HYBRID), 17 Tier 3 (LOCK).
- **Design sweep** — `<Spinner>` compartilhado criado + substituído em 13
  arquivos (agent absorveu também `Loader2` do lucide, não só SVG custom).

Session 04 landed (4 parallel workstreams):
- **S04.a** — Tier 1 RSC migrations: 3 pages RSC puras (/admin/observability,
  /dashboard, /workspace/guides/[slug]) + 1 híbrida (guides/[slug]/log com
  client island). Helper novo `lib/fetch-engine.ts`.
- **S04.b** — Inputs sweep: 9 arquivos migrados pra shadcn `<Input>`/`<Textarea>`.
- **S04.c** — ContentScorer UI em `/seo/analysis` (draft textarea + score card +
  gaps panel). POST `/seo/score` wired com `triggerAnalysisIfMissing`.
- **S04.d** — `/workspace/ideas` 929L → 229L + 9 sub-files em
  `components/modules/workspace/ideas/`. Side-effect: `components/ui/textarea.tsx`
  primitive criado.

Session 05 landed (4 parallel workstreams):
- **S05.a** — 5 pages RSC Tier 2 migradas (workspace/guides, workspace/people,
  admin/config/proxy, seo/keybert, farm/simulations/annual).
- **S05.b** — `<StatusBadge>` primitive (6 variants semânticos) + migração
  de 11 arquivos (color maps URGENCY/EFFORT/STATUS/SOURCE/INTENT/VICE).
  Identidade visual preservada (subreddit/channel colors).
- **S05.c** — pipelines-tab 700→40L + 6 sub-files. Eliminou um `any`.
- **S05.d** — hardware/settings 801→59L + 8 sub-files.
- **S05.e** — Proxy `/api/hardware/[...path]` (55L) + RSC migration das 2
  pages pendentes (`/hardware/recent` 347→31L + 352L island; `/hardware/alerts`
  374→36L + 378L island).

Session 06 landed (4 parallel workstreams — engine session 21 Fase C consumers):
- **S06.a** — `GeneratedPost.contentScore` + `slangReport` display: 2 RSC
  cards (content-score-card + slang-report-card) integrados em
  `guide-content.tsx`. Types centralizados em `lib/engine-types.ts`.
- **S06.b** — `/admin/gsc` page: RSC shell + client island (configured/
  siteUrl/info + sync trigger + error toast surfacing). Sidebar entry.
- **S06.c** — Slang bulk approve: `/workspace/slang` 478→366L + 3 sub-files
  (slang-card, bulk-action-bar, ingest-sidia-button). Ingest sidia button +
  checkboxes + sticky action bar + contextual approve-all por source/category.
- **S06.d** — `/admin/benchmark` page: 3 tabs (QA/Ideation/Content Gen)
  com forms + response panel (LLM/Qdrant events colapsáveis). 8 files em
  `components/modules/admin/benchmark/` + `lib/benchmark-types.ts`. Sidebar
  entry. Listing endpoint TBD (não existe no engine).

Session 07 landed (8 parallel workstreams — zeroing carryover pre-editor-rewrite):
- **S07.a** — workspace/templates 763→108L + 9 sub-files. 2 `any` eliminados.
- **S07.b** — simulation-editor 755→249L + 7 sub-files. `DisplayCurrency` type promovido a exported.
- **S07.c** — admin/config/costs 727→77L + 8 sub-files.
- **S07.d** — week-editor 718→301L + 6 sub-files (consumers preservados).
- **S07.e** — workspace/qa 663→82L + 8 sub-files (chat SSE + 2 hooks).
- **S07.f** — farm/simulations/annual/[id] 656→100L + 7 sub-files.
- **S07.g** — EditorShell inline contentScore/slangReport cards (+15L).
- **S07.h** — Sidebar Admin 11 entries flat → 3 sub-grupos
  (Operações/SEO Tools/Config); `NavGroup` recursivo.

Carryover para session 08 (pré-etapas grandes: editor novo + Sanity API):
- `SectionEditor.tsx` 676L mantido intencionalmente (será reescrito).
- Benchmark listing endpoint fica no engine repo.
- **Próxima etapa**: planejar editor novo + integração Sanity API pra
  publicação direta.

## Working agreement

- Each Claude Code session creates or appends to a file under
  `progress/session-NN.md`.
- Update the **Current status** block above when production state
  changes (new domain, new stack component, major feature shipped).
- Update the **Metrics** block below when numbers shift meaningfully.
- Keep this file under ~150 lines. If it grows, split more of it into
  `progress/` or `architecture/`.
- Read this index at session start, then the latest (or the active)
  session file for full context. Older sessions are archival.
- Numbering is **independent** from the engine's session tracker
  (`path-of-trade-content/docs/PROGRESS.md`). Cross-reference engine
  sessions as "engine session NN" when needed (e.g. this session 01
  consumes the ContentScorer API shipped in engine session 21 Fase C).

## Sessions

Most recent first.

| Session | Date | Theme |
|---------|------|-------|
| [16](progress/session-16.md) | 2026-04-25 | /seo bug fixes — competitor-gaps PipelineStatusBar (4 contadores + 4 botões + engine `runFullPipeline`), auto-actions multi-select + bulk approve/reject + reject-all-pending + detail Sheet + glossary (engine `bulk-decide` + `reject-all-pending`), research signal gate relaxável (`?withoutSignals=true` no engine + toggle no hub + banners de erro/discrepância) |
| [15](progress/session-15.md) | 2026-04-25 | SEO i18n hreflang fix (translation.metadata resolve sibling slugs, og:locale em 22 pages) + Sanity prod env bug (`/workspace/blog` zerado por catch mudo + envs vazias) + right rail polish (rail width, currency icons, novo WidgetFilterInput, scrollbar-thin) + Session 32 carry (posts-recommended page hub + transcript-admin engine) |
| [14](progress/session-14.md) | 2026-04-24 | bug fixes + UX polish do benchmark — fix do `[a]` slug conflict que causava 504 universal, ModelCombobox autocomplete com pricing OpenRouter, output final renderizado, preset shape normalization, pobUrl + skill opcional, banner global removido, engine prefix-match per-node override |
| [13](progress/session-13.md) | 2026-04-24 | benchmark infra — engine `modelOverrides` per-node + hub Prisma (Preset/Run/Evaluation) + 7 rotas API + OpenRouter live pricing + preset bar nos 3 forms + /history + /compare + Sonnet 4.6 judge (5 dimensions). 3 waves paralelizadas com 10 agents. +120 tests hub, +12 engine |
| [12](progress/session-12.md) | 2026-04-24 | carryovers da S11 liquidados — TS fix simulation-diff + monitor.factory, vi.mock sonner dedup, smoke E2E Sanity opt-in (`SMOKE_SANITY=1`), side panel Items/Gems/Passives com novo `/api/items/list` no engine (+ 6º widget no right rail), arquival justificado de BriefingForm/diff-versioning/section-workflow |
| [11](progress/session-11.md) | 2026-04-24 | dívida técnica S10 liquidada — schema zod estrito pro body (discriminated union dos 5 tipos Sanity) + converter Markdown via `@portabletext/block-tools` canônico (marked + jsdom + schema compilado). Dupla defesa contra silent drops tipo body=Empty |
| [10](progress/session-10.md) | 2026-04-24 | editor UI/UX overhaul — wizard Edit→Publish (rota /publish nova) + right rail de 5 widgets (Score/Slang/Q&A/Assets/Slang Lookup) + fix publish blocker (transform IDs→refs + slug collision per language) + importar guide LLM (markdown→Portable Text, 2 drafts PT-BR+EN automáticos) + toolbar completa (Undo/Redo, alignment, HR, table) + Spinner/EmptyState polish |
| [09](progress/session-09.md) | 2026-04-24 | carryover cleanup da session 08 (chip currency paridade iconUrl + vitest e2e exclude + migration retroativa 4 commits drift + tracker hygiene) |
| [08](progress/session-08.md) | 2026-04-23 | editor profissional (Tiptap) + publish direto no Sanity + drag-drop currencies + Q&A inline + preview render fiel do poetrade-dev |
| [07](progress/session-07.md) | 2026-04-23 | zerar carryover (6 god files médios splits + editor inline score + sidebar regroup) pré-editor-rewrite |
| [06](progress/session-06.md) | 2026-04-23 | engine session 21 Fase C consumers (post preview contentScore/slangReport, /admin/gsc, slang bulk approve, /admin/benchmark) |
| [05](progress/session-05.md) | 2026-04-23 | RSC Tier 2 (5 migradas + 2 via hardware proxy) + god files médios (pipelines-tab, hardware/settings) + StatusBadge semantic tokens |
| [04](progress/session-04.md) | 2026-04-23 | Tier 1 RSC migrations + inputs sweep + ContentScorer UI + workspace/ideas split |
| [03](progress/session-03.md) | 2026-04-23 | carryover da session 02 (god files /seo/youtube, /seo/reddit, store-prices-tab) + /seo/research rearquitetura + RSC audit |
| [02](progress/session-02.md) | 2026-04-23 | 4 parallel refactors: BriefingForm/simulation-comparison/hardware splits + Phase 2 style (PageHeader backfill + SEO accent) |
| [01](progress/session-01.md) | 2026-04-23 | IA rework (5 domains) + admin/config fusion + engine-config split + style Phase 1 |

Pre-session history (flat, phase-by-phase) is preserved in
[`progress/legacy-phases.md`](progress/legacy-phases.md) — covers Fase 1
(infra + auth) through the current production state. Kept for reference;
new work lives in numbered sessions.

## Metrics

| Metric | Value | Since session 01 |
|---|---:|---|
| TS/TSX files | ~645 | session 12 +3 (use-items-catalog, use-passives-catalog, assets-lookup-widget) + 3 novos tests |
| Routes | **76** | stable |
| `'use client'` pages | **20** (app/auth) | stable |
| Vitest tests | **836 passed / 0 failed / 1 skipped** | session 13 +120 (benchmark presets + runs + evaluate + UI), session 14 +10 (model-combobox). Engine benchmark: 12 → **17 passed** pós S14 prefix-match (+5) |
| Playwright E2E | 32 | stable |
| God files >1000L | **0** | stable |
| God files 500-1000L | **0** | session 10 deletou `editor-sidebar.tsx` 487L |
| Shared primitives | PageHeader, EmptyState, Spinner, Input, Textarea, StatusBadge, Tiptap editor (+ TextAlign + Table extensions), Sanity client + transform | incremental |
| Server Components in app/(auth) | 12 pages RSC puras + 1 híbrida | stable |
| Proxy routes | 2 catch-all | stable |
| Engine Fase C consumers | 4/4 + editor inline + right rail widgets | S10.a portou content-score + slang-report cards pra widgets |
| Editor body format | Portable Text canonical (autosave converte Tiptap→PT antes do PUT; mount converte PT→Tiptap) | S10 fix |
| Editor layout | Body + Right Rail (**6 widgets**) + toolbar leve com "Prosseguir →" | S12.f adicionou AssetsLookupWidget (Items/Gems/Passives tabs) entre Assets e SlangLookup |
| Engine endpoints consumidos pelo hub editor | `/api/items/list` (S12.f novo), `/api/items/currencies`, `/api/items/:name/raw`, `/api/tools/passives/*`, `/api/engine/knowledge/answer`, `/api/engine/slang?status=approved` | S12.f abriu o primeiro endpoint de listagem navegável de items |
| Sidebar Admin | 3 sub-grupos (Operações/SEO Tools/Config) | was 11 flat entries |
| Sidebar top-level | 6 (was 25+ flat) | stable |
| Theme base | neutral | stable |

## Architecture reference

- [`CLAUDE.md`](../CLAUDE.md) — code style, stack-specific rules, custom
  agents, progress tracking protocol.
- [`PRD.md`](../PRD.md) — product requirements, entity definitions,
  business rules.
- Engine sibling repo: `../path-of-trade-content` — the content engine
  whose HTTP API this hub consumes. When planning new hub features that
  need backend support, check engine's `docs/PROGRESS.md` for the
  matching module status.

## Release 1.0 pending

**Removido em session 11** (decisão do operador): o checklist legacy de
Release 1.0 foi retirado do progress tracker ativo. Itens como export CSV,
auditoria de auth em rotas, deploy Docker completo, rotação de secrets e
troca de senha admin são tarefas operacionais pontuais, não ficam mais no
radar de planning. Se virarem prioridade no futuro, renascem como session
dedicada.
