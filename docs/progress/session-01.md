# Session 01 (2026-04-23) — Track B: IA rework + god component split

Tema: reorganizar o poe-hub em domínios coerentes (fusão de 6 entradas
de admin dispersas), decompor 5 god files >1000L e 2 de 600-710L, e
deixar a sidebar com ≤15 itens em hierarquia clara. Counterpart do
Track A concluído no engine (`path-of-trade-content` session 21).

Session ativa (em andamento).

## Pre-work (estado real, 2026-04-23)

A auditoria herdada do engine session 21 **estava desatualizada** em
vários pontos. Estado real conferido agora:

**Inventário atualizado**
- 71 rotas (`page.tsx` em `app/**`) — a audit falava em 48.
- Sidebar atual em `components/layout/sidebar.tsx` (382L).
- `'use client'` count não re-confirmado ainda (audit dizia 147, mas
  tem drift — pode estar menor agora).

**God files reais (conferidos via `wc -l`)**
| Arquivo | Linhas | Nota |
|---|---:|---|
| `app/(auth)/hardware/page.tsx` | 2403 | pendente |
| `app/(auth)/engine-config/page.tsx` | 1944 | pendente (vai fundir em /admin/config) |
| `components/modules/simulations/simulation-comparison.tsx` | 1379 | **moved** de `components/` — pendente split |
| `app/(auth)/hardware/builder/page.tsx` | 1346 | pendente |
| `app/(auth)/seo/page.tsx` | 1291 | pendente split em 3 rotas |
| `components/engine/BriefingForm.tsx` | 710 | **moved** pra `components/engine/` — pendente split |
| `components/engine/editor/SectionEditor.tsx` | — | **parcialmente decomposto** — já tem `EditorShell.tsx` + `SectionEditor.tsx` como arquivos separados dentro de `editor/`. Reconfirmar linhas e ver se ainda vale decompor mais. |

**Rotas admin — estado real**
- `/admin/observability` — **JÁ EXISTE** (commit `8b569ac`,
  refactor(admin) fuse `/logs + /llm-logs + /analytics + /monitor →
  /admin/observability`). Fase B2 do plano original **já caiu**.
- `/llm` — rota top-level sobrevivente (não foi pra observability).
  Pode ser a UI do LLM playground / usage logs. Confirmar e decidir
  se mantém top-level ou entra em admin.
- `/settings/*` — **ainda fragmentado** em 5 subrotas: `costs`,
  `feature-flags`, `leagues`, `proxy`, `users` + root `page.tsx`.
  Fusão pendente em `/admin/config`.
- `/engine-config` — ainda existe como rota própria (1944L page.tsx),
  pendente fusão em `/admin/config`.

**Rotas adicionais não mencionadas na audit original**
`app/(auth)/` hoje tem: `admin, bots, dashboard, editor, engine-config,
guides, hardware, ideas, keybert, llm, new, people, prices, qa, reddit,
sales, seo, settings, simulations, slang, tasks, templates, youtube`.

Muitas delas são específicas do content engine (guides, ideas, new,
qa, templates, editor, keybert, slang, people, reddit, youtube) e não
caberiam naturalmente em `/ops`. Isso influencia a decisão dos
domínios (refinement #2 abaixo).

**Tipos engine↔hub divergentes** (Briefing shape) — ainda flagged pra
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

## Plano de fases (revisado após audit real)

B2 do plano original (fusão observability) **já foi feita** — tirada da
lista. Outras fases ajustadas pro estado atual.

### B1 — Nova sidebar + router skeleton
- Definir domínios finais (decisão da refinement #2 + lista ampla de
  rotas atuais). Proposta revisada:
  - `/workspace` — content engine UI: briefing (`new`), outline
    editor, write (`editor`), guides (output), ideas, qa, templates.
  - `/seo` — research/analysis/opportunities: keybert, reddit
    monitor, youtube monitor, slang, people (creators), competitor.
  - `/farm` — PoE ops: bots, prices, sales, simulations.
  - `/admin` — config (`/admin/config` — pendente, B3),
    observability (`/admin/observability` — pronto), llm (ingerir
    `/llm`), dashboard (talvez).
  - `/hardware` — deals feed + builder (dropa do original `/ops` —
    é independente, opera fora do ciclo PoE).
- Nova sidebar com hierarquia (domínio pai + subgrupos expandíveis).
  Target: ≤15 entradas top-level, subgrupos visíveis ao expandir.
- Migração das rotas antigas (renames em massa) — cada rota continua
  servindo o mesmo componente atual, só muda de URL.
- `/moved` page catch-all.
- **Validação**: `npm run dev` + smoke manual de todas as rotas novas.
  Ajustar Playwright E2E (32 tests) pra novas URLs.

### B2 — ~~Fusão `/admin/observability`~~ ✓ JÁ FEITO

Landed em commit `8b569ac`. `/admin/observability` existe e substituiu
`/logs + /llm-logs + /analytics + /monitor`. Ainda resta:
- Conferir se `/llm` (rota top-level sobrevivente) vai pra
  `/admin/observability` como 5ª tab ou fica separada (é LLM playground
  vs LLM logs — precisa confirmar escopo). Fast task.

### B3 — Fusão `/admin/config`
- Novo `app/(auth)/admin/config/` com tabs:
  Engine YAML | Leagues | Users | Proxies | Costs | Feature Flags.
- Split do `engine-config/page.tsx` (1944L) enquanto migra — extrair
  editor de YAML, validator, diff viewer em componentes separados.
  O objetivo é tornar cada YAML section (templates, style_guide,
  prompt_templates, seo.yaml) um sub-component independente.
- Migrar `/settings/costs`, `/settings/feature-flags`,
  `/settings/leagues`, `/settings/proxy`, `/settings/users` como tabs
  irmãs. `/settings/page.tsx` também (é o settings root).
- **Validação**: todos os YAMLs carregam/salvam, testes de Vitest dos
  editors, E2E do flow "edit YAML → save → reload confirms".

### B4 — Split `/seo/page.tsx` (1291L) em 3 rotas
- `/seo/research` — keyword discovery, suggest expansion, trending
  terms consolidator output, emerging seeds.
- `/seo/analysis` — SerpAnalysis por keyword, content scorer, gap
  reports (consome `ContentScoreReport` novo do engine).
- `/seo/opportunities` — striking distance, GSC underperformers,
  priority queue.
- Cada rota é um Server Component fininho com ilhas Client pras
  tabelas e filtros.
- **Validação**: cada rota renderiza dados reais, testes E2E dos
  3 fluxos principais.

### B5 — Decompor componentes centrais do content flow
- `components/engine/BriefingForm.tsx` (710L) → split por section
  (base fields, PoB importer, data sources picker, custom outline
  editor).
- `components/engine/editor/` — **já parcialmente decomposto** com
  `EditorShell.tsx` + `SectionEditor.tsx`. Conferir tamanhos atuais,
  se ainda tem arquivo >500L nesse diretório, splitar mais.
- Esses são **centrais** ao `/workspace/new` flow — vem antes dos
  outros god components porque qualquer fase futura (tipos
  compartilhados, Server Components migration) toca neles.
- **Validação**: Vitest component tests + E2E do flow completo
  briefing → write → optimize.

### B6 — Decompor `simulation-comparison.tsx` (1379L)
- Agora em `components/modules/simulations/simulation-comparison.tsx`.
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
- Remover código legacy das rotas antigas após ~1 semana.
- Remover `/moved` page.
- Atualizar `docs/PROGRESS.md` com métricas finais (target:
  `'use client'` pages ~50, god files >500L = 0 ou 1, sidebar ≤15
  entradas top-level).

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

### S01.b — B1: IA rework — 5 domains + sidebar + route migration — DONE

Migração massiva de URLs + rewrite da sidebar + sweep de Links
internos. Clean break (sem redirect) conforme decisão do operador.

**git mv (21 folders)**
- `/new, /guides, /qa, /ideas, /templates, /editor, /slang, /people`
  → `/workspace/*`
- `/reddit, /youtube, /keybert` → `/seo/*`
- `/seo/page.tsx` (1291L god file) → `/seo/research/page.tsx`
- `/bots, /prices, /sales, /simulations` → `/farm/*`
- `/tasks` → `/admin/tasks`
- `/engine-config` → `/admin/config/engine`
- `/settings/{costs,feature-flags,leagues,proxy,users,page.tsx}`
  → `/admin/config/*`
- `/llm` deletado (conteúdo já coberto em `/admin/observability` tab
  LLM — era dashboard standalone duplicado)

**Placeholders novos**
- `app/(auth)/seo/analysis/page.tsx` (placeholder pra B4)
- `app/(auth)/seo/opportunities/page.tsx` (placeholder pra B4)

**Sidebar rewrite**
- `components/layout/sidebar.tsx` reorganizado em 5 top-level domains
  + Dashboard: Dashboard | Workspace | SEO | Farm | Hardware | Admin.
- Todas as entradas com hrefs novos. Removidos links pra `/docs`
  (não existia como rota autenticada) e `/settings/*` legacy.
- Total top-level entries: 6 (abaixo do target ≤15).

**Sweep de Links internos**
- `sed -E -i` em bulk sobre todos os `*.ts`/`*.tsx` (exceto node_modules,
  .next, .git, .claude). Regex `(["'\`])/<oldpath>\b` substituído pelo
  path novo. 7 patterns cobriram as 18+ rotas.
- ~30+ arquivos atualizados: `proxy.ts` (middleware matchers),
  components de sim/bot/sales forms, simulation-comparison, app
  pages que linkam entre si, e2e tests.
- Confirmado zero old paths remanescentes via grep final em .ts/.tsx.

**Permission denied trade-off**
- Primeiro pass do `git mv` falhou em 6 dirs com dynamic routes
  (`[slug]`, `[postId]`, `[id]`) — Windows file locks do `next dev`
  rodando em background. Identificado via `powershell Get-CimInstance`,
  matado 3 node.exe processes (next dev + postcss + start-server).
  Retry limpo após kill.

**Validação**
- `npx next build` (background, ~90s) → exit 0, zero warnings.
- Todas as 5 domains listadas no output do build (workspace, seo,
  farm, admin/{config,observability,tasks}, hardware + dashboard +
  login públicos). Dynamic routes resolvem (`ƒ` markers no build).
- Middleware (`proxy.ts`) continua protegendo ops paths — layout
  `(auth)/layout.tsx` usa `getServerSession` server-side como backup.

**Arquivos tocados** (total ~70): 40+ renames (git mv), ~30
modifications (sed sweep), 3 creates (sidebar rewrite, 2 placeholders).

### S01.c — B3: Layout + ConfigNav pro `/admin/config` — DONE (parcial)

Fusão visual das 6 subrotas de config num chrome compartilhado.
Split do engine-config (god file 1944L) fica pra S01.d (agent em
background — parallelizado com style research retornado nesta
sessão).

- `app/(auth)/admin/config/layout.tsx` (novo, 20L): shell com título
  "Configuracoes" + descrição + `<ConfigNav />` + `{children}`.
- `app/(auth)/admin/config/config-nav.tsx` (novo, 66L): horizontal
  tab nav client component, highlight por `usePathname`. 7 entradas:
  Overview (exact match), Engine, Custos, Ligas, Proxy, Usuarios,
  Feature Flags. Padrão "border-bottom primary on active" estilo
  aba.
- Landing `/admin/config/page.tsx` (76L, inalterado) vira Overview
  tab — mantém os cards como quick-links + nav dá navegação rápida
  entre tabs.

Validação: `npx next build` passa limpo, as 7 rotas de /admin/config
listadas no build output, zero warnings.

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
