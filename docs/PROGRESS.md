# PoE Hub — Progress Tracker

Last updated: 2026-04-23 (session 01 — IA rework, pre-work + phase plan).

## Current status

Operational control panel consuming the `path-of-trade-content` engine
plus self-hosted PoE data pipelines. Live modules: dashboard, bots,
sales, prices, simulations, tasks, settings, engine-config, hardware
deals, seo (research/analysis/opportunities consuming engine API),
logs, llm-logs, analytics, monitor.

Stack: Next.js 16 App Router + Prisma 6 + PostgreSQL 16 + shadcn/ui
(Tailwind v4) + NextAuth credentials. Tests: Vitest (~373 tests) +
Playwright (32 E2E).

**Active session:** [session-01](progress/session-01.md) — Track B from
engine session 21: IA rework, route consolidation, god component
decomposition. Kicked off 2026-04-23 after the engine-side Track A
(SEO splits + ContentGapFillNode) landed.

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
| [01](progress/session-01.md) | 2026-04-23 | **active** — IA rework (5 domains), admin/config fusion, god component split |

Pre-session history (flat, phase-by-phase) is preserved in
[`progress/legacy-phases.md`](progress/legacy-phases.md) — covers Fase 1
(infra + auth) through the current production state. Kept for reference;
new work lives in numbered sessions.

## Metrics

| Metric | Value |
|---|---:|
| TS/TSX files | 304 |
| Routes | 48 |
| `'use client'` pages | 147 (Server Components: 0) |
| Vitest tests | ~373 |
| Playwright E2E | 32 |
| God files >1000L | 5 (hardware 2403, engine-config 1944, simulation-comparison 1379, hardware/builder 1346, seo 1291) |
| God files 500-1000L | 2 (BriefingForm 710, SectionEditor 676) |
| Sidebar items | 25+ (no hierarchy — target <15) |

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
