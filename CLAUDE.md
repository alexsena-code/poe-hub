# CLAUDE.md — PoE Hub

## Project overview

Operational control panel for the Path of Trade solo operator. Consumes
the `path-of-trade-content` engine's HTTP API (content generation, SEO
research, ideation) and runs its own PoE-adjacent data pipelines
(G2G competitor price collection, hardware deals monitoring, bot
management, sales tracking, simulation planning).

**What it does.** Replaces a multi-tab spreadsheet operation with a
single authenticated web app. Modules in production today:

- `/dashboard` — KPIs (live prices, active bots, MTD revenue)
- `/bots` — bot instance management (config, proxies, schedules)
- `/sales` — revenue tracking per bot + per buyer
- `/farm/prices` — Divine Orb price on G2G (competitor intel, USD)
- `/simulations` — scenario modeling (optimistic/expected/pessimistic)
- `/tasks` — kanban board
- `/settings/*` — proxy, leagues, users, global costs
- `/engine-config` — YAML editor for the engine (templates, prompts,
  style guide) — the hub is the UI for the engine's YAML configs
- `/hardware` — PCBuildWizard BR deals feed + OLX monitoring
- `/seo` — research / analysis / opportunities — consumes engine SEO API
- `/logs`, `/llm-logs`, `/analytics`, `/monitor` — observability

**Why.** Operator is solo, vibe-coding with Claude Code. Ops surface
needs to be LEGIBLE enough for operator + future Claude sessions to
navigate without drowning. Current pain (April 2026): 48 routes
scattered across 6 admin entry points, 25+ sidebar items without
hierarchy, 5 god components over 1000L each. Track B of engine session
21 kicks off the IA rework (see `docs/progress/session-01.md`).

**Operator.** Solo (`icaroberger00@gmail.com`) — same operator as
`path-of-trade-content`. No other users.

Read `PRD.md` for product requirements and entity definitions. Read
`docs/PROGRESS.md` for current status and session continuity.

## Current status

Production stack: Next.js 16 App Router + Prisma 6 + PostgreSQL 16 +
NextAuth credentials + Tailwind v4 + shadcn/ui + Vitest + Playwright.
Deployed via Docker Compose. Dark mode default (operation is largely
nocturnal).

Tests: ~373 Vitest unit/integration + 32 Playwright E2E.

Session 01 (2026-04-23) is the IA rework Track B — see
`docs/PROGRESS.md` for details.

## Code style

Rules below apply to all app code. Enforce them in new code; fix nearby
violations when you touch a file; flag big violations as refactor tasks
rather than silently rewriting unrelated areas.

- **Functions**: 4-20 lines. Split if longer.
- **Files**: target 500 lines, ±10% margin (effective 450-550). Over 550
  is a must-split; 450-550 is a judgement call — split only when SRP is
  also being violated. Counting is raw `wc -l` (code + comments +
  whitespace all count — comments carry intent, don't subsidize them).
- **One thing per function, one responsibility per module (SRP)**.
- **Names**: specific and unique. Avoid `data`, `handler`, `Manager`.
  Prefer names that return <5 grep hits in the codebase.
- **Types**: explicit. No `any` in TypeScript. Prefer `unknown` + narrow
  over `any`. Component props always typed; hooks always annotated.
- **No code duplication**. Extract shared logic into a function/module.
  Hotspots: modules under `components/modules/*` (historical drift from
  early feature-by-feature implementation) and the `app/(auth)/*` pages
  that became god components.
- **Early returns over nested ifs**. Max 2 levels of indentation per
  function.
- **Exception messages must include the offending value and expected
  shape**. `throw new Error(\`bad price cents: ${n} (expected >= 0)\`)`
  — not `throw new Error("bad input")`.

## Comments

- Keep your own comments. Don't strip them on refactor — they carry
  intent and provenance from prior sessions.
- Write WHY, not WHAT. Skip `// increment counter` above `i++`.
- JSDoc on exported functions that aren't self-explanatory: intent +
  one usage example.
- Reference issue numbers / commit SHAs when a line exists because of a
  specific bug or upstream constraint (e.g. "Discord exporter emits
  `\n` inside code blocks — see legacy-phases.md Fase 4").

## Tests

- Test runner is Vitest. Run with `npx vitest run` (one-shot) or
  `npx vitest` (watch mode). Playwright E2E via `npx playwright test`.
- Every new function gets a test. Bug fixes get a regression test.
- Mock external services (engine API, exchange rate APIs, Discord) with
  named fake classes or `vi.mock()` — not inline stubs.
- **Never mock Prisma for integration tests** — use the real test DB
  (`potc_test`, isolated from dev). Migrations run before the suite.
- Tests must be F.I.R.S.T: fast, independent, repeatable,
  self-validating, timely.
- Factories live in `tests/factories/` — reuse them, don't inline test
  data that's shaped like a real entity.

## Dependencies

- Inject dependencies through parameters (hooks, function args) — not
  global imports or module singletons. The Prisma client singleton in
  `lib/prisma.ts` is the one intentional exception; everything else
  passes through.
- Wrap third-party libs behind a thin interface owned by this project.
  Example pattern: `lib/engine-client.ts` wraps the engine's HTTP API
  so route handlers don't fetch it directly — if the engine contract
  changes, only this file updates.
- Server Components fetch data directly (no hook layer); Client
  Components consume via props or SWR. Don't wrap `fetch` in a custom
  hook for single-use reads — keep it inline and server-side.

## Structure

- Follow Next.js App Router convention: `app/<route>/page.tsx` for
  routes, `app/<route>/layout.tsx` for scoped layouts, `app/api/<path>/
  route.ts` for Route Handlers.
- **Server Components by default**. `'use client'` only when the
  component needs hooks, event handlers, browser APIs, or third-party
  client-only libs (recharts, dnd-kit).
- Co-locate module-specific components in `components/modules/<module>/`.
  Generic primitives live under `components/ui/` (shadcn). Shared
  cross-module components under `components/layout/` or
  `components/shared/`.
- Predictable paths: if you grep for a domain name, the match should
  land under `components/modules/<domain>/`, `app/(auth)/<domain>/`, or
  `app/api/<domain>/`. No other location.
- Prefer small focused modules over god files. If an app page exceeds
  500L, split into sub-routes or extract feature components.

## Formatting

- Use prettier for TS/TSX/JSON/YAML. Don't discuss style beyond that.
- Line length: 100. Tailwind classes that blow past 100 are fine if
  breaking them hurts readability — prettier wraps them automatically.

## Logging

- Use `console.error` / `console.warn` for operator-visible errors in
  Route Handlers. Structured JSON is overkill for single-operator
  tooling — prefer readable strings with context (`[bots] failed to
  start instance ${id}: ${err.message}`).
- No `console.log` in production paths — route through `console.debug`
  (filtered out in prod by default) or remove before commit.
- Frontend debugging: prefer React DevTools + Network tab over
  `console.log` scattering.

## Tech stack

- **Framework**: Next.js 16 (App Router) — `app/`
- **Styling**: Tailwind CSS v4 + shadcn/ui — `components/ui/`
- **ORM**: Prisma 6 — `prisma/schema.prisma`
- **Database**: PostgreSQL 16 (operator entities, prices, sales,
  simulations, bot configs, tasks)
- **Auth**: NextAuth.js (credentials provider, JWT strategy) —
  `lib/auth.ts`
- **Encryption**: AES-256-GCM for sensitive fields — `lib/crypto.ts`
- **Forms**: react-hook-form + zod — validation schemas co-located
  with forms
- **Charts**: recharts — `'use client'` islands only
- **Drag-and-drop**: @hello-pangea/dnd (kanban, reorderable lists)
- **Toast**: sonner
- **Engine client**: `lib/engine-client.ts` — typed wrapper for the
  `path-of-trade-content` HTTP API
- **Tests**: Vitest + React Testing Library (unit/component/integration)
  + Playwright (E2E)
- **Container**: Docker Compose — `docker-compose.yml`
- **Price collector**: standalone CLI — `scripts/g2g-price-collector/`.
  In production it runs as a **Coolify Scheduled Task** hitting
  `POST /api/prices/g2g` with `CRON_SECRET` — not a container of its own.
  G2G's own API is public and needs no credentials.

## Key commands

```bash
# Dev server
npm run dev

# Prisma
npx prisma migrate dev              # create/apply migration
npx prisma generate                 # regenerate client
npx prisma studio                   # visual DB browser
npx prisma db seed                  # seed dev data

# Tests
npx vitest run                      # unit + integration (one-shot)
npx vitest                          # watch mode
npx playwright test                 # E2E

# Docker
docker compose up -d                # full stack (app + db)
docker compose up -d db             # DB only (for local dev)

# Coletor de preço da concorrência (manual)
npx tsx scripts/g2g-price-collector/index.ts --dry-run

# Custom agents (Claude Code)
# /agents                           list available
# /agents create                    create new interactively
```

## Stack-specific rules

These extend (never override) the generic code-style rules above.

### General
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Never hardcode secrets — use `.env` only.
- Database changes go through Prisma migrations
  (`npx prisma migrate dev`).

### Next.js App Router
- Server Components by default; `'use client'` only when needed.
  Historical state (session 01 audit): 147 `'use client'` pages, zero
  Server Components. Any new page starts as a Server Component unless
  there's a concrete reason.
- Data fetching in Server Components: call Prisma or the engine client
  directly — no fetch layer in between.
- Mutations via Server Actions where possible; Route Handlers (`app/
  api/.../route.ts`) for anything cross-origin or used by scripts/bots.
- All Route Handlers must validate auth via `getServerSession()` before
  any DB operation.
- Route Handler responses are typed — never return raw Prisma objects
  that leak encrypted/sensitive fields.
- Pagination via query params: `?page=1&limit=20`.

### Forms
- react-hook-form + zod. Schema co-located with the form component.
- shadcn `Form` primitives for layout consistency.
- Toast on submit success/failure via sonner.

### UI
- shadcn/ui primitives first: Table, Card, Dialog, Form, Select,
  Input, Badge, Tabs, Accordion, Chart. Don't install competing libs.
- Tailwind only — no inline styles, no CSS modules.
- Responsive: desktop-first (operator is on a desktop 99% of the time),
  but must be usable on mobile for ops on the go.
- Dark mode is default + only theme for now. Zinc palette via shadcn
  CSS variables.

### Database
- Schema in `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
- UUIDs for all primary keys (`@id @default(uuid())`).
- `createdAt` + `updatedAt` on every table (`@updatedAt`).
- Prisma enums for status fields, currencies, roles.
- snake_case for DB columns via `@map`, camelCase in Prisma models.
- Encrypted fields (bot passwords, proxy credentials) use
  `lib/crypto.ts` — never stored in plain text, never logged.

### Engine integration
- All calls to the engine's HTTP API go through `lib/engine-client.ts`.
  Never `fetch()` the engine inline from a route/page.
- Briefing/content types shared with the engine are currently
  **divergent** — there's a planned reconciliation (shared-types
  package or OpenAPI-generated client). Until then, the engine-client
  wrapper owns type adapters.

### Tests
- Unit tests for pure logic (simulation calculations, crypto, parsers,
  zod schemas): co-located or in `__tests__/`.
- Integration tests for Route Handlers: real `potc_test` DB, full CRUD
  cycle, auth 401, validation 400.
- Component tests for interactive UI: form validation, user events,
  conditional rendering.
- Playwright E2E for critical flows only (log in → dashboard → create
  sale → verify in DB). Don't recreate unit tests at E2E level.
- Coverage targets: 100% for calculations/crypto, 90%+ for Route
  Handlers and parser, 70%+ for components.

## Environment variables

See `.env.example` for the full list. Key variables:

```env
# Database
DATABASE_URL=postgresql://poth:poth@localhost:5432/poth

# NextAuth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Encryption (AES-256-GCM for sensitive fields)
ENCRYPTION_KEY=<openssl rand -hex 32>

# Engine API (sibling repo)
ENGINE_API_URL=http://localhost:3001
ENGINE_API_KEY=                     # matches engine's API_KEY env

# Admin seed
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
```

## Progress tracking (CRITICAL)

Progress is stored as one file per session under `docs/progress/`.
`docs/PROGRESS.md` is a short **index** — status, metrics, and links to
the per-session files. Do not grow it beyond ~150 lines.

Each session file (`docs/progress/session-NN.md`) contains:
- Theme of the session (one sentence).
- Changelog per completed chunk (what landed, file paths, validation
  command run).
- What's left (specific, not vague).
- Design decisions, deviations from PRD, known issues.

Session numbering is **independent** from the engine. If referencing
engine work, call it "engine session NN".

Legacy history (Fases 1-N, flat format) lives in
`docs/progress/legacy-phases.md` — preserved for reference, not active.
New work starts in numbered sessions.

When starting a new Claude Code session:
1. Read `docs/PROGRESS.md` (index).
2. Read the latest or active `docs/progress/session-NN.md` for details.
3. Read `PRD.md` for the relevant product section.
4. Verify the last completed task still works (`npm run dev` + smoke).
5. Create or append to `docs/progress/session-NN.md` as you work;
   update the index when status/metrics change.

**Before any non-trivial `git commit`** (feature landing, refactor
chunk, bug fix of substance — not `docs:` or typo-only commits):
- Append a short entry to the active `docs/progress/session-NN.md`
  describing what landed, file paths touched, and the validation
  command run (tests, build, smoke).
- Stage the progress file in the same commit as the code change, so
  the history stays coherent.

## Custom agents

Custom subagents live in `.claude/agents/` (Markdown files, one per
agent). Invoke via `/agents` in Claude Code. Preserved agents:

- **db-architect** — Prisma schema evolution, migrations, indexes.
- **frontend-dev** — Next.js pages/components, shadcn/ui, forms.
- **api-dev** — Route Handlers, zod validation, auth enforcement.
- **qa-reviewer** — read-only code audit before merging.
- **test-engineer** — Vitest + RTL test authoring after each feature.

Agent definitions are in-repo at `.claude/agents/*.md` — edit there
when responsibilities drift. Don't inline them in this file.
