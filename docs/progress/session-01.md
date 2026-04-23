# Session 01 (2026-04-23) — Track B: IA rework + god component split

Tema: reorganizar o poe-hub em domínios coerentes (fusão de 6 entradas
de admin dispersas), decompor 5 god files >1000L e 2 de 600-710L, e
deixar a sidebar com ≤15 itens em hierarquia clara. Counterpart do
Track A concluído no engine (`path-of-trade-content` session 21).

Session ativa (em andamento).

## Pre-work (audit recap)

Herdado da auditoria consolidada do engine session 21 (pre-work):

**Inventário**
- 304 arquivos TS/TSX, 48 rotas.
- 147 páginas `'use client'`, **zero Server Components** — oportunidade
  grande pro refactor converter pelo menos o shell de cada god page.
- 507 `useState` nas páginas de app — data fetching disperso.
- sidebar com 25+ itens sem hierarquia visual.

**God files**
| Arquivo | Linhas |
|---------|-------:|
| `app/(auth)/hardware/page.tsx` | 2403 |
| `app/(auth)/engine-config/page.tsx` | 1944 |
| `components/simulation-comparison.tsx` | 1379 |
| `app/(auth)/hardware/builder/page.tsx` | 1346 |
| `app/(auth)/seo/page.tsx` | 1291 |
| `components/BriefingForm.tsx` | 710 |
| `components/SectionEditor.tsx` | 676 |

**Rotas dispersas** (6 entradas de admin hoje): `/engine-config`,
`/settings/*`, `/logs`, `/llm-logs`, `/analytics`, `/monitor`.

**Tipos engine↔hub divergentes** (Briefing shape) — flagged pra
reconciliar numa fase futura (shared-types package ou OpenAPI
generated client).

## Design refinements proposed

O plano original do engine session 21 especificou 5 domínios:
`/workspace`, `/seo`, `/ops`, `/admin`, `/docs`. Lendo o estado real do
hub eu proponho 3 ajustes — **nenhum é mandatório**, só quero levantar
antes de começar a mexer. Se você não concordar, seguimos com o
plano original.

### 1. Dropar `/docs` — ficar em 4 domínios

O `/docs` no plano original seria pra servir docs read-only dentro da
app web. Mas as docs reais vivem no filesystem (`docs/`, `CLAUDE.md`,
`PRD.md`, `PROGRESS.md`) e são editadas fora do app. Servir elas numa
rota web duplica superficie sem ganho claro (operador solo já tem os
arquivos abertos no editor).

**Proposta**: dropar `/docs`. Se futuramente quiser um viewer embutido,
abrimos — mas não antes de ter demanda real.

Resultado: 4 domínios — `/workspace`, `/seo`, `/ops`, `/admin`.

### 2. Dividir `/ops` — farming vs hardware vs meta

`/ops` no plano original agregaria bots + prices + simulations +
hardware + tasks — 5 subdomínios bem diferentes. Farming ops
(bots/prices/simulations) é um mental state diferente de hardware
deals (totalmente independente do jogo) e de tasks (meta-work do
operador, não ops PoE).

**Proposta alternativa** (2 variantes, escolho o que achar mais
natural):

**Variante A — 3 domínios em vez de 4**:
- `/workspace` — content engine (briefing, write, critique)
- `/seo` — research/analysis/opportunities
- `/farm` — bots + sales + prices + simulations (tudo PoE direto)
- `/admin` — config + observability + tasks + hardware deals

**Variante B — 4 domínios como original, mas com subgrupos claros na
sidebar**:
- `/workspace` (content engine)
- `/seo` (research/analysis/opportunities)
- `/ops` — com subgrupos:
  - "Farming": bots, sales, prices, simulations
  - "Hardware": deals feed, builder, price history
  - "Tasks": kanban
- `/admin` (config + observability)

Eu prefiro **Variante A** (3 domínios + 1 admin). Hardware deals e
tasks são meta-ops, caem naturalmente em /admin. Mas se o operador
mentalmente separa hardware como domínio próprio ("quando vou comprar
uma GPU, entro em X"), Variante B faz mais sentido.

### 3. Clean break com `/moved` page temporária

Plano original: clean break nas URLs, sem redirect. Concordo —
operador solo, sem usuários externos. Mas um bookmark antigo ou link
compartilhado no passado bate em 404 silencioso.

**Proposta**: sem redirect de fato, mas criar `/moved` page (rota
catch-all pra URLs que sumiram) com uma tabela `old_url → new_url`.
Sidebar nova não mostra old URLs. Primeira semana mantemos; depois
removemos.

## Plano de fases

Ordem pensada pra **destravar o máximo cedo** (sidebar nova + fusões
primeiro, god components depois — nessa ordem porque split de god file
sem saber o layout final geraria retrabalho).

### B1 — Nova sidebar + router skeleton
- Definir domínios (3 ou 4 + /admin — decisão da refinement #2).
- Criar novos route groups em `app/(auth)/` com páginas de placeholder
  (cada uma renderiza um "moved from X" enquanto migração não termina).
- Nova sidebar com hierarquia (domínio pai + sub-items expandíveis).
- Migração das rotas antigas (renames em massa) — cada rota continua
  servindo o mesmo componente atual, só muda de URL.
- `/moved` page catch-all.
- **Validação**: `npm run dev` + smoke manual de todas as rotas novas.
  Todos os 32 Playwright E2E devem passar com URL updates — se a
  sidebar é usada nos E2E (provavelmente), eles atualizam junto.

### B2 — Fusão `/admin/observability`
- Novo route group `app/(auth)/admin/observability/` com tabs:
  Logs | LLM Logs | Analytics | Monitor.
- Extrair componentes reutilizáveis (table views, filter bar,
  date-range picker) pra `components/modules/admin/observability/`.
- Remover as 4 rotas antigas (`/logs`, `/llm-logs`, `/analytics`,
  `/monitor`) — adicionar entradas no `/moved`.
- **Validação**: Vitest component tests + E2E nas 4 tabs.

### B3 — Fusão `/admin/config`
- Novo `app/(auth)/admin/config/` com tabs:
  Engine YAML | App Settings | Leagues | Users | Proxies | Costs.
- Split do `engine-config/page.tsx` (1944L) enquanto migra — extrair
  editor de YAML, validator, diff viewer em componentes separados.
  **Esse split não precisa ir até 500L linha-por-linha** — o objetivo
  é tornar cada YAML section (templates, style_guide, prompt_templates,
  seo.yaml) um sub-component independente.
- Migrar `/settings/*` como tabs irmãs.
- **Validação**: todos os YAMLs carregam/salvam, testes de Vitest dos
  editors, E2E do flow "edit YAML → save → reload confirms".

### B4 — Split `/seo/page.tsx` (1291L) em 3 rotas
- `/seo/research` — keyword discovery, suggest expansion, trending
  terms consolidator output.
- `/seo/analysis` — SerpAnalysis por keyword, content scorer, gap
  reports (consome `ContentScoreReport` novo do engine).
- `/seo/opportunities` — striking distance, GSC underperformers,
  priority queue.
- Cada rota é um Server Component fininho com ilhas Client pras
  tabelas e filtros.
- **Validação**: cada rota renderiza dados reais, testes E2E dos
  3 fluxos principais.

### B5 — Decompor componentes centrais do content flow
- `components/BriefingForm.tsx` (710L) → split por section (base
  fields, PoB importer, data sources picker, custom outline editor).
- `components/SectionEditor.tsx` (676L) → split editor / toolbar /
  actions / critique panel.
- Esses são **centrais** ao `/workspace/new` flow — vem antes dos
  outros god components porque qualquer fase futura (tipos
  compartilhados, Server Components migration) toca neles.
- **Validação**: Vitest component tests + E2E do flow completo
  briefing → write → optimize.

### B6 — Decompor `simulation-comparison.tsx` (1379L)
- Component usado em múltiplas páginas de `/farm/simulations/*`.
- Split por concern: scenario chart, delta table, overrides inheritance
  visualizer, export buttons.
- **Validação**: Vitest component tests; E2E das comparações de
  cenário que já existem.

### B7 — Decompor `hardware/page.tsx` (2403L) + `hardware/builder/page.tsx` (1346L)
- Rotas isoladas, baixo risco pro resto do app.
- Split por concern: deals feed, filter bar, price history chart,
  alerts config; e pro builder: parts picker, compatibility checker,
  total cost summary.
- Oportunidade de virar Server Components — fetch inicial do
  PCBuildWizard API no server, ilha client pras interações.
- **Validação**: E2E do flow "abrir /hardware → filtrar → abrir
  builder → escolher parts → ver total".

### B8 — Clean break + cleanup
- Remover código legacy das rotas antigas após 1 semana.
- Remover `/moved` page.
- Atualizar `docs/PROGRESS.md` com métricas finais (deve bater:
  `'use client'` pages ~50, god files >500L = 0 ou 1, sidebar 15 itens).

### Carryover (não-bloqueante durante B1-B7, mas anotar)
- Reconciliação Briefing engine↔hub (shared-types ou OpenAPI gen).
- shadcn audit — Tabs e Accordion sub-utilizados.
- Migração mais ampla pra Server Components nas pages que **não** são
  god (pequeno win por página, mas 100+ páginas).

## Decisões

- **Numeração de sessions independente do engine** — cada repo tem
  seu tracker. Referências cruzadas via "engine session NN" quando
  necessário (ex: esta session 01 consome `ContentScoreReport` shipado
  no engine session 21 Fase C/D).
- **Progress tracking migrado pra `docs/progress/`** — index em
  `docs/PROGRESS.md` ≤150L, sessão nova em `docs/progress/session-NN.md`.
  Legacy preservado em `docs/progress/legacy-phases.md` (git mv, history
  intacta).
- **CLAUDE.md rewrite** alinhado com o do engine — code style (funções
  4-20L, files 500L ±10%, SRP, names, types, early returns, exception
  messages com offending value), comments, tests, dependencies,
  structure, formatting, logging, stack-specific rules, progress
  tracking, custom agents.
- **Escopo atualizado no "Project overview"** — antes dizia só "bots
  farming"; hoje o hub tem 14 módulos incluindo integração com o
  engine, SEO dashboard, hardware deals.

## Changelog

### S01.a — Progress infra + CLAUDE.md rewrite — DONE

- `PROGRESS.md` → `docs/progress/legacy-phases.md` via `git mv` (642L,
  fases 1-N preservadas).
- `docs/PROGRESS.md` novo (index ≤150L): current status, working
  agreement, sessions table, metrics block, architecture reference,
  carryover.
- `CLAUDE.md` rewrite: Project overview atualizado (14 módulos em
  produção), Code style (funções 4-20L, files 500L ±10%), Comments,
  Tests (vitest), Dependencies, Structure (App Router convention,
  Server Components default), Formatting (prettier), Logging, Tech
  stack (Next 16 + Prisma 6 + Tailwind v4 + shadcn/ui + NextAuth +
  Vitest + Playwright), Key commands, Stack-specific rules (Next.js,
  forms, UI, DB, engine integration, tests), Environment variables,
  Progress tracking (CRITICAL), Custom agents (preservados —
  apontados pra `.claude/agents/*.md`).
- `docs/progress/session-01.md` (este arquivo): tema, pre-work,
  design refinements proposed (3), plano de fases B1-B8.

Validação: leitura manual; progresso registrado antes de código
começar (requisito CLAUDE.md).

## O que resta na session 01

**Bloqueio**: aguardando decisão do operador sobre os 3 design
refinements acima:
1. Dropar `/docs` (4 vs 5 domínios)?
2. `/farm` vs `/ops` com subgrupos (Variante A ou B)?
3. `/moved` page temporária (sim/não)?

Após decisão, **começa B1** (nova sidebar + router skeleton).

Fases pendentes: B1 → B8 (descrito acima). Estimativa: ~2-3 fases
grandes por session Claude Code. Session 01 cobre B1 + talvez B2;
session 02 B3-B4; session 03 B5-B6; session 04 B7-B8.
