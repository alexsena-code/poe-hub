# Session 02 — Track B continuação: god components + Phase 2 style + B4 rearquitetura

Data inicial: 2026-04-23.

Tema: continuar o Track B iniciado na session 01. Session 01 fechou com
3 dos 7 god files resolvidos (engine-config 1944→182, sidebar
reorganizado, B2 observability previamente fundida). Restam: BriefingForm
(710L), simulation-comparison (1379L), hardware (2403L) +
hardware/builder (1346L), e a rearquitetura de `/seo/research` (1291L,
B4). Paralelamente, Phase 2 do style (PageHeader backfill + SEO accent
sweep) é quick win disponível.

Referência: [`session-01.md`](session-01.md) pro recap completo + god
file status + pending items.

## Plano de fases

Ordem pensada por "fast win primeiro + menor risco antes de risco maior".

### S02.a — Phase 2 style: PageHeader backfill + SEO accent sweep
Quick win, mecânico. PageHeader component já existe
(`components/ui/page-header.tsx`, session 01 S01.e) mas só o
design-preview usa. Aplicar em 40+ pages real substitui o h1 manual
repetido. SEO accent color `--color-seo` já declarado (session 01
S01.f) mas ainda não aplicado a `/seo/*` headers/icons/CTAs.

- Grep por `<h1 className="text-3xl font-bold">` (+ variações com
  text-2xl) em `app/(auth)/**/page.tsx` e em components que renderizam
  page headers.
- Substituir por `<PageHeader title="..." description="..." actions={...} />`
  preservando texto e layout atual. Description opcional, actions
  opcional.
- SEO accent: nas pages `/seo/research`, `/seo/analysis`, `/seo/
  opportunities`, `/seo/reddit`, `/seo/youtube`, `/seo/keybert` — usar
  SEO accent em icon do header + primary CTA button. Padrão consistente
  com o mockup do design-preview.
- Delete depois: `app/(auth)/admin/design-preview/` — não é mais
  necessário uma vez Phase 2 tenha landado + entry da sidebar.

Estimativa: ~1h (backfill) + 15min (SEO sweep) + 5min (delete preview).

### S02.b — B5: BriefingForm (710L) + editor/ verification
Central ao content flow (`/workspace/new` e `/workspace/editor/[postId]`).
Split desbloqueia futuras mudanças (tipos compartilhados engine↔hub,
Server Components migration).

- `components/engine/BriefingForm.tsx` (710L): split por section.
  Candidatos claros: base fields (skill/ascendancy/topic/league), PoB
  importer, data sources picker, custom outline editor. Cada um vira
  um file em `components/engine/briefing/`.
- `components/engine/editor/`: já tem `EditorShell.tsx` +
  `SectionEditor.tsx` extraídos (herdado da engine session 21).
  Conferir se algum arquivo ainda excede 550L. Se não, só atualizar
  session-02.md notando que está OK.
- Cobrir com Vitest component tests (preservar behavior via
  snapshot/interaction tests de cada sub-section).

Estimativa: ~1.5h.

### S02.c — B6: simulation-comparison.tsx (1379L)
Component usado em `/farm/simulations/compare` e potencialmente outros
pages. Split por concern: scenario chart, delta table, overrides
inheritance visualizer, export buttons.

- Move pra `components/modules/simulations/simulation-comparison/`
  com sub-files: `scenario-chart.tsx`, `delta-table.tsx`,
  `inheritance-visualizer.tsx`, `export-actions.tsx`.
- Index file (`index.tsx` or similar) exporta o componente principal
  orquestrando os sub-parts.
- Oportunidade: se partes internas não precisam de estado client,
  virar sub-components podem ser RSC (mas o container provavelmente
  continua client pra charts).

Estimativa: ~1h.

### S02.d — B7: hardware (2403L) + hardware/builder (1346L)
Rotas isoladas, baixo risco pro resto do app. Boa oportunidade de
converter pra Server Components — fetch inicial do PCBuildWizard API
no server, ilha client só nas interações (filter, sort, selection).

- `app/(auth)/hardware/page.tsx` (2403L): split em deals feed,
  filter bar, price history chart, alerts summary, como RSC + client
  islands.
- `app/(auth)/hardware/builder/page.tsx` (1346L): parts picker,
  compatibility checker, total cost summary.
- Todas as novas sub-components em `components/modules/hardware/`.

Estimativa: ~2h. Maior risco/escopo da session.

### S02.e — B4: /seo/research rearquitetura em 3 rotas reais
Não é só split — envolve spec de features novas (analysis +
opportunities). Placeholder atual em `/seo/analysis` e
`/seo/opportunities` precisam virar pages reais consumindo os endpoints
do engine (Fase B SerpAnalyzer + Fase C/D ContentScorer + Gap Filler).

- Spec: decidir exatamente o que cada rota mostra. Draft:
  - `/seo/research`: keyword discovery, scan controls, VICE score
    list com filtros (cluster, source, game, intent) — hoje o 1291L.
    Reduzir tirando tudo que não é research.
  - `/seo/analysis`: SerpAnalysis fetch por keyword, ContentScorer
    output (score + missing entities/headings), gap fill trigger.
    Consome `/api/engine/seo/serp/*` + `/api/engine/seo/score`.
  - `/seo/opportunities`: striking distance keywords + GSC
    underperformers + priority queue. Lista ranqueada com actions
    (promote to brief, dismiss).
- Antes de executar: decidir spec com operator.

Estimativa: ~3h (inclui 2 features novas).

### S02.f — B8 final cleanup
- Remover rotas legacy remanescentes se houver.
- Confirmar métricas finais: god files >500L ≤1, sidebar top-level
  ≤15, `'use client'` pages reduzidas.
- Atualizar `docs/PROGRESS.md` com snapshot final.
- Fechar session 02.

## Decisão inicial pendente

**Qual fase atacar primeiro?** Minha recomendação é **S02.a (Phase 2
style)** — é mecânico, baixo risco, e entrega consistência visual
imediata. Depois S02.b (BriefingForm) pra desbloquear o content flow.
Alternativas: começar direto em S02.b (se preferir god components
antes), ou S02.d (se o hardware dash for dor aguda hoje).

## Changelog

_(vazio — aguardando primeira fase)_

## Notas

- `/admin/design-preview` continua acessível enquanto Phase 2 não
  termina — delete em S02.a.
- `pipelines-tab.tsx` (700L) continua flagged da session 01 —
  revisitar só se crescer.
- Tipos compartilhados engine↔hub ainda pendentes (carryover
  `docs/PROGRESS.md`) — não está no scope desta session, mas pode
  surgir se B5 tocar na Briefing shape.
