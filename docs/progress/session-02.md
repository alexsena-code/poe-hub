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

_(vazio — aguardando primeira fase)_

## Notas

- `/admin/design-preview` continua acessível enquanto Phase 2 não
  termina — delete em S02.a.
- `pipelines-tab.tsx` (700L) continua flagged da session 01 —
  revisitar só se crescer.
- Tipos compartilhados engine↔hub ainda pendentes (carryover
  `docs/PROGRESS.md`) — não está no scope desta session, mas pode
  surgir se B5 tocar na Briefing shape.
