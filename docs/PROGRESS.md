# PoE Hub — Progress Tracker

Last updated: 2026-04-23 (session 02 kicked off — Track B continuation).

## Current status

Operational control panel consuming the `path-of-trade-content` engine
plus self-hosted PoE data pipelines. Live modules (post session 01 IA
rework): `/workspace` (content engine), `/seo`
(research/analysis/opportunities), `/farm` (bots/prices/sales/
simulations), `/admin` (config/observability/tasks), `/hardware`
(deals/builder), `/dashboard`.

Stack: Next.js 16 App Router + Prisma 6 + PostgreSQL 16 + shadcn/ui
(Tailwind v4, **neutral** base) + NextAuth credentials. Tests: Vitest
(~373 tests) + Playwright (32 E2E).

Session 01 landed: 5-domain IA, sidebar rewrite, admin/config fusion,
engine-config split (1944L → 182L + 9 tabs), style Phase 1 (neutral +
semantic colors + typography scale + linear charts).

**Active session:** [session-02](progress/session-02.md) — Track B
continuation: god component decomposition (BriefingForm, simulation-
comparison, hardware), Phase 2 style (PageHeader backfill, SEO accent
sweep), B4 `/seo/research` rearquitetura.

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
| [02](progress/session-02.md) | 2026-04-23 | **active** — god component decomposition (BriefingForm/simulation-comparison/hardware) + Phase 2 style + B4 rearquitetura |
| [01](progress/session-01.md) | 2026-04-23 | IA rework (5 domains) + admin/config fusion + engine-config split + style Phase 1 |

Pre-session history (flat, phase-by-phase) is preserved in
[`progress/legacy-phases.md`](progress/legacy-phases.md) — covers Fase 1
(infra + auth) through the current production state. Kept for reference;
new work lives in numbered sessions.

## Metrics

| Metric | Value | Since session 01 |
|---|---:|---|
| TS/TSX files | ~340 | +9 engine tabs, +2 UI components, +placeholders |
| Routes | 71 | stable (5-domain IA, /llm deleted) |
| `'use client'` pages | 147 (Server Components: 0) | unchanged — RSC migration in session 02 B7 |
| Vitest tests | ~373 | unchanged |
| Playwright E2E | 32 | unchanged (URLs updated in B1) |
| God files >1000L | 4 | was 5 — engine-config 1944L → 182L split |
| God files 500-1000L | 2 (BriefingForm 710, pipelines-tab 700) | SectionEditor already split pre-session; pipelines-tab flagged from S01.d |
| Sidebar top-level | 6 (was 25+ flat) | Dashboard + Workspace + SEO + Farm + Admin + Hardware, target ≤15 met |
| Theme base | neutral (was zinc) | session 01 S01.f, operator preference |

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
