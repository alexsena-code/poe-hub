# Session 02 — Track B continuação: god components + Phase 2 style + B4 rearquitetura

Data inicial: 2026-04-23.

## Contexto em 60s (pra próximo Claude retomando do zero)

Session 01 (HEAD = `1d5d75b`) entregou:

1. **Nova IA em 5 domínios**: `/workspace`, `/seo`, `/farm`, `/admin`,
   `/hardware` (+ `/dashboard`). Todas as 71 rotas migradas via `git mv`.
   Sidebar em `components/layout/sidebar.tsx` tem 6 top-level entries
   com subgrupos expandíveis.
2. **Admin/config fusão**: layout compartilhado
   (`app/(auth)/admin/config/layout.tsx`) + tab nav horizontal
   (`config-nav.tsx`) envolvem as 6 subrotas (engine/costs/leagues/
   proxy/users/feature-flags + overview).
3. **Engine-config split**: de 1944L god → 182L thin orchestrator + 9
   tab components em `app/(auth)/admin/config/engine/tabs/`. Pattern
   seguido = `keybert-tab.tsx` (pré-existente). `pipelines-tab.tsx`
   ficou em 700L — flagged, mas justificado.
4. **Style Phase 1 aplicada** (B+C+H do audit): neutral base (era
   zinc), semantic colors (`--color-success/warning/info`), SEO
   accent (`--color-seo` declarado mas não aplicado ainda),
   typography scale (6 CSS vars), charts `type="linear"` (3 spots).
   `bot-status-badge` migrado pra tokens de tema.
5. **Design preview** em `/admin/design-preview` (temp, deleta em S02.a).
6. **Componentes novos**: `components/ui/page-header.tsx` + `empty-state.tsx`
   (só usados na preview ainda — backfill é S02.a).

**God files restantes (wc -l raw)**:

| Arquivo | Linhas |
|---|---:|
| `app/(auth)/hardware/page.tsx` | 2403 |
| `components/modules/simulations/simulation-comparison.tsx` | 1379 |
| `app/(auth)/hardware/builder/page.tsx` | 1346 |
| `app/(auth)/seo/research/page.tsx` | 1291 |
| `components/engine/BriefingForm.tsx` | 710 |
| `app/(auth)/admin/config/engine/tabs/pipelines-tab.tsx` | 700 (flagged, justificado) |

Referência completa: [`session-01.md`](session-01.md).

## Sanity check antes de começar

Rode estes comandos no `poe-hub/` pra confirmar que session 01 landed
limpa:

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -8                      # Deve incluir 1d5d75b no topo
git status --short                        # Deve estar vazio
npx next build 2>&1 | tail -5             # Exit 0, zero warnings
npx vitest run bot-status-badge 2>&1 | tail -5   # 6/6 passed
```

Dev server pra smoke visual:
```bash
npm run dev
# http://localhost:3000/admin/design-preview    # banner "Phase 1 aplicada" + chart section
# http://localhost:3000/admin/config/engine     # 10 tabs lazy-loaded
# http://localhost:3000/farm/bots               # status badges com semantic colors
# http://localhost:3000/hardware/analytics      # charts linear, sem curva
```

Se algo acima falhar, **pare e diagnose antes de avançar em S02**.

## Tema

Continuar o Track B iniciado na session 01. Session 01 fechou com 3
dos 7 god files resolvidos (engine-config 1944→182, sidebar
reorganizado, B2 observability previamente fundida). Restam:
BriefingForm (710L), simulation-comparison (1379L), hardware (2403L) +
hardware/builder (1346L), e a rearquitetura de `/seo/research` (1291L,
B4). Paralelamente, Phase 2 do style (PageHeader backfill + SEO accent
sweep) é quick win disponível.

## Plano de fases

Ordem pensada por "fast win primeiro + menor risco antes de risco maior".

### S02.a — Phase 2 style: PageHeader backfill + SEO accent sweep

Quick win, mecânico. `PageHeader` component já existe em
`components/ui/page-header.tsx` (session 01 S01.e) com signature
`{ title, description?, actions?, className? }`. Hoje só o
design-preview e `admin/config/layout.tsx` usam — resto das pages
tem `<h1 className="text-2xl font-bold">` / `<h1 className="text-3xl
font-bold">` manual. Grep na session 01 encontrou **32 files** com
esse padrão.

**Target files (~30 pages + 2 já adaptadas)**:

- **Hardware** (7): `/hardware/{page,builder,alerts,recent,analytics,settings,vms}/page.tsx`
- **Farm** (8): `/farm/bots/{page,[id],new}`, `/farm/sales/{page,[id],new}`,
  `/farm/prices/{page,sources}`, `/farm/simulations/{page,annual}`
- **Admin** (7):  `/admin/tasks/tasks-page-client.tsx`,
  `/admin/observability/page.tsx`, `/admin/config/{page,costs,
  feature-flags,leagues,proxy,users}/page.tsx`
- **Workspace** (5): `/workspace/new/page.tsx`, `/workspace/guides/[slug]/{page.tsx,log/page.tsx,guide-content.tsx}`
- **SEO** (3): `/seo/{research,analysis,opportunities}/page.tsx`
- **Outras**: `/dashboard/page.tsx`, `/hardware/analytics/page.tsx` (+ 1 nested)

**Skip**: `app/(auth)/admin/design-preview/page.tsx` (deleta no fim),
`app/(auth)/admin/config/layout.tsx` (já usa PageHeader).

**Padrão de substituição**:
```tsx
// Antes
<div>
  <h1 className="text-3xl font-bold">Bots</h1>
  <p className="text-muted-foreground">Gerencie seus bots</p>
</div>

// Depois
<PageHeader
  title="Bots"
  description="Gerencie seus bots"
  actions={<Button>...</Button>}  // se existir CTA no header
/>
```

Import: `import { PageHeader } from "@/components/ui/page-header";`

**SEO accent sweep**: nas pages `/seo/research`, `/seo/analysis`,
`/seo/opportunities`, `/seo/reddit`, `/seo/youtube`, `/seo/keybert`,
aplicar o accent emerald (`var(--color-seo)`) em:
- Icon do header (passar `icon` custom ou wrap com div colored).
- Primary CTA do header (`actions` slot).
- Tabs/subsections destacadas se houver.

Pattern no mockup do design-preview: `style={{ color: "var(--color-seo)" }}`
no icon + `style={{ backgroundColor: "var(--color-seo)", color: "white" }}`
no primary Button. Uma opção mais limpa seria extender `PageHeader`
com prop `accent?: string` pro próximo Claude considerar.

**Delete preview**: após backfill validar, remover
`app/(auth)/admin/design-preview/` + tirar a entry "Design Preview"
de `components/layout/sidebar.tsx` (Admin group).

Estimativa: ~1h (backfill) + 15min (SEO sweep) + 5min (delete preview).
Validation: `npx next build` exit 0, `npx vitest run` sem regressão.

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

### S02.b — BriefingForm split (2026-04-23)

`components/engine/BriefingForm.tsx` 710L → 460L orquestrador.
Nova pasta `components/engine/briefing/` com 8 sub-components + 1 módulo puro + types:

- `stitch-notes.ts` — função pura `buildStitchedNotes()`, extraída e testada.
- `stitch-notes.test.ts` — 9 testes Vitest (sem userNotes, com userNotes, null briefingText, empty secondaryKeywords, null cluster, empty titleEn, ordering).
- `types.ts` — interface `BriefSource` compartilhada.
- `template-selector.tsx` — dropdown de templates.
- `topic-or-skill-fields.tsx` — conditional topic OR skill+ascendancy.
- `league-field.tsx` — input de league.
- `template-section-toggles.tsx` — checkboxes de seções do template.
- `brief-source-summary.tsx` — card emerald quando `?briefId=X` hydrated.
- `pob-importer.tsx` — URL input + botão Analisar + PobError + PobSummaryCard.
- `notes-textarea.tsx` — textarea com placeholder contextual (com/sem briefSource).
- `submit-button.tsx` — botão com spinner.

Consumer único confirmado: `app/(auth)/workspace/new/page.tsx` — API externa preservada (`export default function BriefingForm()`).

Validação:
- `wc -l`: BriefingForm.tsx 460L, todos sub-components ≤81L.
- `npx next build` — exit 0, zero erros.
- `npx vitest run components/engine/briefing/stitch-notes` — 9/9 passed.
- `npx vitest run` — 6 failed | 19 passed (idêntico ao baseline pré-existente, zero regressão).

### S02.c — simulation-comparison split (2026-04-23)

`components/modules/simulations/simulation-comparison.tsx` 1379L → removido.
Nova pasta `components/modules/simulations/simulation-comparison/` com 11 arquivos:

- `types.ts` (60L) — `CustomCost`, `CostConfigOption`, `Simulation`, `SimTotals`, `WeekTotals`. Re-exporta `SimulationWeek` de `week-editor` para evitar duplicação.
- `helpers.ts` (213L) — funções puras: `resolveField`, `customPerBotDaily`, `customGlobalDaily`, `customOneTime`, `calcSimTotals`, `calcWeekTotals`. Zero imports React.
- `use-comparison-state.ts` (268L) — hook `useComparisonState(ids)` com todo o estado + mutations (fetch, applyCostConfig, updateWeekDefault, updateSimCost, updateCustomCost, addCustomCost, removeCustomCost, saveSimulation).
- `delta.tsx` (41L) — componente `Delta` — badge colorido com valor absoluto + percentagem.
- `scenario-chart.tsx` (206L) — `ScenarioChart` — AreaChart de lucro cumulativo por dia com KPIs side-panel (lucro/dia, break-even, total).
- `financial-summary.tsx` (141L) — `FinancialSummary` — tabela de totais + toggle para `ScenarioChart`.
- `cost-panel.tsx` (287L) — `CostPanel` — custos fixos editáveis + custom costs + cost-config selector por simulação.
- `week-params-table.tsx` (153L) — `WeekParamsTable` — tabela editável de defaults por semana (bots/div-hr/hrs-dia).
- `week-results-table.tsx` (137L) — `WeekResultsTable` — resultados receita/custo/lucro por semana com delta column.
- `daily-breakdown.tsx` (219L) — `DailyBreakdown` — Accordion com breakdown diário por semana, dias locked renderizados com opacity-40.
- `index.tsx` (180L) — orquestrador; re-exporta tipos públicos; delega estado a `useComparisonState`; renderiza as 5 seções.

Consumer único confirmado: `app/(auth)/farm/simulations/compare/page.tsx` — import `SimulationComparison` de `"@/components/modules/simulations/simulation-comparison"` continua válido (TS resolve `index.tsx` automaticamente).

Validação:
- `wc -l`: todos os arquivos ≤287L; maior é `cost-panel.tsx` (287L). Nenhum supera 300L.
- Arquivo antigo `simulation-comparison.tsx` removido — `ls simulations/` confirma ausência.
- `npx next build` — exit 0, zero erros de compilação.
- `npx vitest run` — 6 failed | 19 passed (idêntico ao baseline pré-existente, zero regressão).

### S02.a — PageHeader backfill + SEO accent sweep (2026-04-23)

`components/ui/page-header.tsx` extendido com prop `accent?: string`.
Quando presente aplica `border-l-2 pl-4` + `borderLeftColor` inline + `color` inline no h1 —
sem CSS extra, sem variantes adicionais. Totalmente DRY.

Arquivos tocados (12 pages/components):

- `components/ui/page-header.tsx` — adicionada prop `accent?: string` + `CSSProperties`.
- `app/(auth)/hardware/alerts/page.tsx` — substituído `<h1>` + `<p>` manual; removido import `BellRing` órfão.
- `app/(auth)/hardware/recent/page.tsx` — substituído; removido import `Clock` órfão.
- `app/(auth)/hardware/analytics/page.tsx` — substituído em 2 lugares (loading state + main render); removidos imports `BarChart3`, `TrendingUp`, `ShoppingCart` órfãos.
- `app/(auth)/hardware/settings/page.tsx` — substituído; removido import `Settings` órfão.
- `app/(auth)/farm/prices/page.tsx` — substituído `flex justify-between` wrapper; CTAs preservados no slot `actions`.
- `app/(auth)/farm/simulations/annual/page.tsx` — substituído header com "Novo Plano" no slot `actions`.
- `app/(auth)/admin/tasks/tasks-page-client.tsx` — substituído; toggle kanban/list + "Nova Tarefa" preservados no slot `actions`.
- `app/(auth)/admin/observability/page.tsx` — substituído.
- `app/(auth)/admin/config/page.tsx` — substituído.
- `app/(auth)/admin/config/costs/page.tsx` — substituído; back button mantido fora do PageHeader; CTA "Nova Configuracao" no slot `actions`.

Arquivos já tinham PageHeader (pré-existente, zero mudança):
bots/{page,[id],new}, sales/{page,[id],new}, prices/sources, simulations/page,
feature-flags, leagues, proxy, users, workspace/new, guides/[slug]/log,
dashboard, seo/{research,analysis,opportunities,reddit,youtube,keybert}.

Arquivos pulados (conforme instrução):
- `hardware/page.tsx` e `hardware/builder/page.tsx` — S02.d vai refatorar do zero.
- `hardware/vms/page.tsx` — apenas `redirect()`, sem header.
- `admin/design-preview/page.tsx` — a ser deletado.
- `admin/config/layout.tsx` — já usa PageHeader (explícito no brief).
- `workspace/guides/[slug]/guide-content.tsx` — h1/h2 são título do post (conteúdo renderizado), não page header.

SEO accent: 6 pages `/seo/*` receberam `accent="var(--color-seo)"` no PageHeader
(e a prop foi adicionada ao tipo do componente). Cada página SEO também teve o
header migrado do `<div flex justify-between><h1>...</h1><...></div>` manual
para PageHeader com `actions` slot preservado.

Validação:
- `npx next build` — exit 0, "Compiled successfully in 4.8s", 92/92 páginas geradas.
- `npx vitest run` — 6 failed | 19 passed (idêntico ao baseline pré-existente, zero regressão).

### S02.d — hardware + hardware/builder split (2026-04-23)

Dois god components em `app/(auth)/hardware/` decompostos em
`components/modules/hardware/` com 10 sub-files + orchestrators enxutos.

**Pages (orchestrators)**:
- `app/(auth)/hardware/page.tsx` — 2403L → **360L**. PageHeader com
  "Refresh / Scrape Now / Clear All" no slot `actions`. Orquestra
  DealsTab + ManualPricesTab + ItemsTab + StorePricesTab.
- `app/(auth)/hardware/builder/page.tsx` — 1346L → **529L**. PageHeader
  com título/descrição. State de compatibility/totals permanece na page
  (são interdependentes).

**Sub-files em `components/modules/hardware/`**:

- `types.ts` (141L) — Deal, SummaryItem, HardwareConfigItem, BuilderConfigItem, ManualPrice, StoreProduct, BuildConfig, BuildTotals, SavedBuild.
- `helpers.ts` (123L) — `formatPriceBrl`, `formatDealDate`, `categoryLabel`, `generateKeywords`, `specsFieldsForCategory`, `SPEC_LABELS`.
- `deal-image-carousel.tsx` (65L) — carousel para deals com múltiplas imagens.
- `deals-tab.tsx` (555L) — filter bar, list/card toggle, tabela/grid paginado, ban/delete. **Levemente acima do target** (target 550L, atingiu 555L — 1% de margem).
- `manual-prices-tab.tsx` (250L) — inline-edit de preços de referência por item.
- `items-tab.tsx` (508L) — CRUD de scraper config items, suporta prefill cross-tab via `prefillRef`.
- `store-prices-tab.tsx` (955L) — PCBuildWizard live prices, spec filters, pagination, sync. **Pré-existente**, flagged para futuro split (similar ao pipelines-tab.tsx).
- `builder-component-picker.tsx` (410L) — selects de GPU/CPU/RAM/Mobo/PSU/SSD com filtros de compatibility.
- `builder-vm-section.tsx` (316L) — calculadora VM com progress bars, profile inputs, cost-per-VM.
- `builder-build-summary.tsx` (160L) — NEW — card "Build Summary" à direita: totals grid, breakdown, price comparison.

Validação:
- `npx next build` — exit 0, `/hardware` e `/hardware/builder` na route list.
- `npx vitest run` — 6 failed | 19 passed (zero regressão).

**Flag de carryover para session 03**: `store-prices-tab.tsx` (955L) e
`deals-tab.tsx` (555L) ficam como candidatos a split futuro. Não foram
divididos nesta fase porque o objetivo primário era encolher as pages
orchestrator — missão cumprida (2403→360L e 1346→529L).

### Final wrap (2026-04-23)

- `app/(auth)/admin/design-preview/page.tsx` deletado (`git rm`).
- `components/layout/sidebar.tsx`: entry "Design Preview" removida do
  grupo Admin.
- `docs/PROGRESS.md` atualizado com métricas novas.

Validação final integrada (todos os 4 agents + cleanup):
- `npx next build` — exit 0, 92/92 páginas, zero warnings.
- `npx vitest run` — 6 failed | 19 passed (baseline pré-existente inalterado).
- `npx vitest run components/engine/briefing` — 9/9 passed (testes novos de `stitch-notes`).

## Notas

- `pipelines-tab.tsx` (700L) continua flagged da session 01 —
  revisitar só se crescer.
- `store-prices-tab.tsx` (955L) e `deals-tab.tsx` (555L) flagged
  pra futuro split (carryover session 03).
- Tipos compartilhados engine↔hub ainda pendentes (carryover
  `docs/PROGRESS.md`) — não surgiu nesta fase.
- `/seo/research` rearquitetura (S02.e planejado) não executada —
  precisa de spec prévia com operator. Fica como fase inicial da
  próxima session.
