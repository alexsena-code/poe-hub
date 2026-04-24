# PoE Hub — Progress Tracker

Last updated: 2026-04-23 (session 03 landed — 3 more parallel god-file splits).

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

Session 03 landed (3 parallel god-file splits):
- **S03.a** — `/seo/youtube` 2120L → 443L orchestrator + 12 sub-files em
  `components/modules/seo/youtube/`.
- **S03.b** — `/seo/reddit` 924L → 197L orchestrator + 11 sub-files em
  `components/modules/seo/reddit/` + 16 testes novos (`helpers.test.ts`).
- **S03.c** — `store-prices-tab.tsx` 955L → 210L orchestrator + 9
  sub-files em `components/modules/hardware/store-prices/`.

Carryover para session 04: `/seo/research` rearquitetura (1289L → 3 rotas
reais, spec needed), Server Components audit (46 pages `'use client'`),
design consistency sweep (inputs manuais, spinner custom, cores inline
→ semantic tokens).

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
| [03](progress/session-03.md) | 2026-04-23 | **active** — carryover da session 02 (god files /seo/youtube, /seo/reddit, store-prices-tab) + /seo/research rearquitetura + RSC audit |
| [02](progress/session-02.md) | 2026-04-23 | 4 parallel refactors: BriefingForm/simulation-comparison/hardware splits + Phase 2 style (PageHeader backfill + SEO accent) |
| [01](progress/session-01.md) | 2026-04-23 | IA rework (5 domains) + admin/config fusion + engine-config split + style Phase 1 |

Pre-session history (flat, phase-by-phase) is preserved in
[`progress/legacy-phases.md`](progress/legacy-phases.md) — covers Fase 1
(infra + auth) through the current production state. Kept for reference;
new work lives in numbered sessions.

## Metrics

| Metric | Value | Since session 01 |
|---|---:|---|
| TS/TSX files | ~405 | +32 sub-components session 02 + 32 session 03 (seo/youtube, seo/reddit, hardware/store-prices), -1 store-prices-tab monolito |
| Routes | 70 | stable (none added; session 03 só split components) |
| `'use client'` pages | ~46 (app/) + ~104 (components/) | unchanged — RSC migration carryover session 04 |
| Vitest tests | ~398 | +9 `stitch-notes.test.ts` (session 02) + 16 `reddit/helpers.test.ts` (session 03) |
| Playwright E2E | 32 | unchanged |
| God files >1000L | 1 (seo/research 1289) | was 4 pre-session-02 — session 02 resolveu hardware+simulation-comparison; session 03 resolveu seo/youtube |
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
