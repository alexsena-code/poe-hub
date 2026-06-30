# Session 23 — Concorrentes raw-first (UI + cleanup) + docs de coleta de dados

**Tema:** alinhar o hub ao rebuild raw-first dos concorrentes do engine
(engine session 40): CRUD DB-backed, observabilidade de crawl, limpeza das
rotas mortas, e registro das análises de coleta de dados.

Contraparte hub do engine session 40 (que fez o crawler raw-first +
observabilidade + removeu a camada de análise). Engine deployado e validado;
**o hub ainda não foi deployado** (commit salvo, deploy pendente).

## Changelog

### Concorrentes — CRUD DB-backed + observabilidade de crawl
- **`/admin/competitors`** (nova): tela DB-backed pra cadastrar/editar/remover
  concorrentes via `POST/PUT /api/engine/seo/competitors` (substitui a
  `competitors-tab` que editava YAML morto). Lista com badge de `source`
  (manual/yaml/auto_discover), addedBy, pathFilter.
- **Observabilidade do crawl** na mesma tela: botão "Crawlar" por concorrente
  (`POST /crawl {domain}`), coluna "Último crawl" por linha, painel de
  histórico dos runs (`GET /crawl-runs`) com status badge (running/completed/
  failed), métricas e **dialog de erros**. Polling de 4s por ~40s pós-disparo,
  unmount-safe. Componentes em `components/modules/seo/competitors/`.
- **`/admin/competitor-pages`** migrado pro raw-first: preview do `rawText`
  (dialog "ver tudo"), `fetchedAt`/`lastCrawledAt` dd/mm/yyyy, filtros de
  `longevity`/`isPoeRelated` removidos, filtro `category` mantido.

### Cleanup (rotas mortas pela demolição da camada de análise)
- **Removidos:** `/admin/competitor-gaps` (página + componentes — gap analysis
  saiu do engine), `competitors-tab.tsx` do engine-config (YAML morto, tirado
  das tabs). Entradas de sidebar correspondentes removidas.

### Docs de coleta de dados (planejamento → registro)
- `docs/data-collection-refinement.md` — §1 YouTube (refinos decididos) + §2-7
  (Reddit/Concorrentes/GSC/Trends/poe.ninja/Wiki) portadas do audit; §3
  Concorrentes atualizada pro estado raw-first deployado.
- `docs/data-collection-audit-full.md` — auditoria fonte-por-fonte.
- `docs/restructure-plan.md` — reanálise hub+engine (provedor de dados + skill +
  enxugar hub).

### Survey de frontend + observabilidade (planejamento da próxima fase)
Levantamento read-only mapeou: 2 superfícies de observabilidade fragmentadas
(`/admin/observability` + `/admin/operations`) sem visão de saúde de coletores;
5 god files (>500L: hardware/analytics 621, guides/guide-content 577,
hardware/builder 529, config/users 522); ~8 rotas mortas/órfãs (ideas,
benchmark, engine-config gen-tabs, feature-flags, trace, e a validar qa/people).
Recomendações: `/admin/runtime` unificado, painel saúde-por-fonte, `<LogDataTable>`
genérica. Base pra Fase 3/4 do restructure-plan.

### Cleanup — 4 features mortas removidas (decisão do operador)
Operador confirmou cortar e **deletar de vez** (não arquivar): **People**,
**Feature Flags**, **Q&A**, **Benchmark inteiro**. Mantidos: **Ideas** e
**Trace** (este último o survey marcou errado como morto — é funcional, linkado
do `guides-client`, backed pelo engine `/content/traces`).
- **58 arquivos deletados.** Benchmark era o maior footprint: 3 rotas + 18
  componentes (`compare-client` 773L etc.) + `app/api/benchmark/` (9 arquivos) +
  6 libs (`benchmark-*.ts`) + scripts/seed + factory + 3 models Prisma
  (`BenchmarkPreset/Run/Evaluation` + enum `BenchmarkType`). People/Q&A:
  páginas + `components/modules/workspace/{people,qa}/`. Feature Flags: página +
  `FeatureFlagsPanel` + funções órfãs em `content-api.ts`.
- **Editados:** `sidebar.tsx` (-5 entradas + import órfão), `config-nav.tsx`,
  `config/page.tsx` (card Feature Flags), `content-api.ts` (funções
  feature-flags; `askQuestion` MANTIDA — usada pelo editor), `schema.prisma`,
  `package.json` (script seed:benchmarks), 2 comentários em openrouter routes.
- **Validação:** `tsc --noEmit` sem nenhum erro das features removidas (os
  restantes são pré-existentes alheios: auth `trustHost`, simulations/annual,
  reddit `use-reddit-state`, editor tests). `prisma generate` OK.
- **Pendente:** `npx prisma migrate dev --name drop_benchmark` (DB offline no
  momento — Docker Desktop parado). Schema já limpo + client regenerado; o drop
  das tabelas `benchmark_*` resolve no próximo `migrate dev` com a DB de pé.

## What's left
- **Observabilidade unificada** (`/admin/runtime`) — PRÓXIMO: fundir
  `/admin/operations` + `/admin/observability` numa página só com tab **Saúde**
  nova (frescor por fonte: Reddit/YouTube/Ninja/Concorrentes/GSC/Trends, via
  novo endpoint engine `GET /seo/health/sources`) + Operações + Logs/LLM/
  Analytics/Monitor. Uma entrada "Runtime" na sidebar no lugar das duas.
- **Migration `drop_benchmark`** quando a DB subir.
- **Split god files** (hardware/analytics 621, guide-content 577,
  hardware/builder 529, config/users 522, deals-tab 555, items-tab 508,
  price-history-table 504) — refactor mecânico, follow-up.
- **Deploy do hub** (Vercel/local).
- Aplicar raw-first às outras fontes (Reddit já feito no engine; Wiki pendente).

## Notas
- Validação engine ao vivo (session 40): crawl maxroll 187 URLs, rawText cheio
  (5.7k–10.8k chars), sem bloqueio do IP da VPS → **proxy descartado**.
- Os endpoints consumidos: `GET/POST/PUT /seo/competitors`,
  `POST /seo/competitors/crawl {domain}`, `GET /seo/competitors/crawl-runs[/:id]`,
  `GET /seo/competitors/pages`.
