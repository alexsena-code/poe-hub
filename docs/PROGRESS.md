# PoE Hub — Progress Tracker

Last updated: 2026-04-23 (session 05 landed — RSC Tier 2 + god files médios + StatusBadge).

## Current status

Operational control panel consuming the `path-of-trade-content` engine
plus self-hosted PoE data pipelines. Live modules (post session 01 IA
rework): `/workspace` (content engine), `/seo`
(research/analysis/opportunities), `/farm` (bots/prices/sales/
simulations), `/admin` (config/observability/tasks), `/hardware`
(deals/builder), `/dashboard`.

Stack: Next.js 16 App Router + Prisma 6 + PostgreSQL 16 + shadcn/ui
(Tailwind v4, **neutral** base) + NextAuth credentials. Tests: Vitest
(~382 tests, +9 novos em `stitch-notes.test.ts`) + Playwright (32 E2E).

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

Carryover para session 06: 7 god files médios restantes (workspace/templates
763L, simulation-editor 755L, admin/config/costs 727L, week-editor 718L,
SectionEditor 676L, workspace/qa 663L, farm/simulations/annual/[id] 656L).
Tier 3 ficaram locked (forms, charts, streaming) — RSC migration não aplicável.

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
| TS/TSX files | ~480 | session 05 adicionou 5 client islands (workspace/guides+people, admin/config/proxy, seo/keybert, farm/simulations/annual) + 6 sub-files pipelines + 8 sub-files hardware/settings + `components/ui/status-badge.tsx` |
| Routes | 70 | stable |
| `'use client'` pages | **17** (app/auth) | was 24 — 7 Tier 2 migradas pra RSC (S05.a: 5 + S05.e: 2 via hardware proxy) |
| Vitest tests | ~398 | unchanged |
| Playwright E2E | 32 | unchanged |
| God files >1000L | **0** | stable — all eliminated pre-session-04 |
| God files 500-1000L | 7 | was 9 — pipelines-tab + hardware/settings resolvidos |
| Shared primitives | PageHeader, EmptyState, Spinner, Input, Textarea, StatusBadge | +StatusBadge session 05 (6 variants semânticos) |
| Server Components in app/(auth) | 11 pages RSC puras + 1 híbrida | was 4 pure + 1 híbrida (7 Tier 2 migradas) |
| Proxy routes | 2 catch-all (`/api/engine/*`, `/api/hardware/*`) | +hardware session 05 S05.e |
| God files 500-1000L | 10+ (store-prices-tab 955, workspace/ideas 928, seo/reddit 924, hardware/settings 801, workspace/templates 763, simulation-editor 755, admin/config/costs 727, week-editor 718, pipelines-tab 700, SectionEditor 676, workspace/qa 663, simulations/annual/[id] 656, hardware/analytics 621, guide-content 559, deals-tab 555, hardware/builder 529, admin/config/users 521) | BriefingForm resolvido; novos flagged de discovery |
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

## Carryover (cross-session TODOs)

- [ ] Reconcile Briefing type between engine and hub (divergent shape —
      flagged in engine session 21 pre-work audit).
- [ ] Centralize shared types (engine DTOs ↔ hub consumers) — planned
      shared-types package or generated client from OpenAPI.
- [ ] Server Components migration audit — the 147 `'use client'` count
      is a baseline; target is ≤50 after IA rework lands.
- [ ] shadcn/ui audit — inconsistent usage across modules, several
      primitives are under-used (Tabs, Accordion, Chart).

## Release 1.0 pending (from legacy)

Still open from `progress/legacy-phases.md`:

- [ ] Export vendas para CSV
- [ ] Revisar todos os TODO/FIXME no código
- [ ] Verificar que todas as rotas validam auth
- [ ] Testar deploy via Docker Compose completo (app + db + scraper)
- [ ] Gerar NEXTAUTH_SECRET + ENCRYPTION_KEY de produção
- [ ] Trocar senha admin padrão (admin123)
