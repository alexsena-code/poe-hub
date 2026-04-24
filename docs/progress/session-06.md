# Session 06 — Engine session 21 Fase C frontend consumers

Data inicial: 2026-04-23.

## Contexto em 60s

Session 05 (HEAD = `f984c65`) fechou com 7 Tier 2 RSC migradas (5 do
S05.a + 2 do S05.e via hardware proxy) + god files pipelines-tab (700→40L)
e hardware/settings (801→59L) + StatusBadge primitive + 11 color maps
migrados pra semantic tokens.

**Agora**: consumir as 4 entregas backend-ready da **engine session 21
Fase C**. Todas estão prontas do lado do engine em `../path-of-trade-content/`.

## Sanity check

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -3                             # f984c65 no topo
git status --short                               # vazio
npx next build 2>&1 | tail -5                    # exit 0
npx vitest run 2>&1 | tail -5                    # 320/38 baseline
```

## Tema

Quatro UIs novas pra destravar features já prontas no engine:

1. **Post preview** — renderizar `contentScore` + `slangReport` do
   `GeneratedPost` em guide-content (e possivelmente editor).
2. **`/admin/gsc`** — page nova com sync trigger + history + error
   surfacing.
3. **`/workspace/slang` bulk approve** — ingest sidia + checkboxes +
   bulk approve por source/category.
4. **`/admin/benchmark`** — trigger runs + view response (listing
   endpoint pode não existir — verificar e documentar).

## Endpoints prontos (engine)

Todos via `/api/engine/<path>` (proxy catch-all faz forward com auth).

### Post preview (item 1)
Sem fetch novo — campos já vêm em `GeneratedPost`:
- `contentScore?: { scoreBefore, scoreAfter|null, threshold, filled,
  missingEntities[], missingHeadings[], analysisId, analysisStaleDays,
  gapFillCostUsd }`
- `slangReport?: { injected, termsAvailable, termsInjected[],
  densityBefore, densityAfter|null, densityThreshold, injectionCostUsd }`

### GSC (item 2)
- `GET /api/engine/seo/gsc/status` — auth status + last sync
- `GET /api/engine/seo/gsc/auth-url` — retorna URL OAuth ou `{ error }`
- `POST /api/engine/seo/gsc/sync` body `{ days?: 28 }` →
  `{ fetched, imported, rejected, error?, siteUrl?, range? }`

### Slang (item 3)
- `GET /api/engine/slang?status=&category=` — list candidates
- `GET /api/engine/slang/stats`
- `POST /api/engine/slang/ingest/sidia` (no body) →
  `{ fetched, created, skipped, durationMs }`
- `POST /api/engine/slang/approve-bulk` body
  `{ ids?: number[], source?: string, category?: string, reviewerNotes? }`
  → `{ approved: number }`
- `POST /api/engine/slang/:id/approve` body `{ reviewerNotes? }`
- `POST /api/engine/slang/:id/reject` body `{ reviewerNotes? }`

### Benchmark (item 4)
- `POST /api/engine/benchmark/qa` body `{ question, queryType?, language?, modelOverride? }`
- `POST /api/engine/benchmark/ideation` body `{ editorialBriefing?, templateFilter?[], modelOverride? }`
- `POST /api/engine/benchmark/content-generation` body `{ briefing, modelOverride? }`
- **Sem listing endpoint**: runs salvos em disco (`scripts/benchmark/runs/`
  no engine, gitignored). Agent D deve propor trigger + response display,
  flag listing como carryover futuro no engine.

## Plano de fases (4 paralelo)

### S06.a — Post preview renderizar contentScore + slangReport

Modificar `components/modules/workspace/guides/guide-content.tsx` (que
é consumido pela page RSC `/workspace/guides/[slug]`) + possivelmente
`EditorShell.tsx` ou `SectionEditor.tsx` pra mostrar badges/cards.

Displays:
- **contentScore chip**: score badge colored (usar StatusBadge variants:
  >=80 success, 60-79 warning, <60 danger). Missing entities + missing
  headings em listas colapsáveis. `gapFillCostUsd` em footer.
- **slangReport badge**: "Slang injected: N terms" + density
  before/after. Termos injetados em hover tooltip ou lista.

Arquivos previstos:
- `components/modules/workspace/guides/content-score-card.tsx`
- `components/modules/workspace/guides/slang-report-card.tsx`

### S06.b — `/admin/gsc` page

Criar:
- `app/(auth)/admin/gsc/page.tsx` (RSC shell)
- `components/modules/admin/gsc/gsc-client.tsx` (client island)

Features:
- Status card (authenticated / last sync / refresh token health).
- Botão "Sincronizar agora" → POST `/api/engine/seo/gsc/sync` com
  `days` selector (7/14/28/90).
- Toast vermelho (sonner) quando response tem `error` field.
- Toast verde com `{ fetched, imported, rejected }` no sucesso.
- Link pro auth flow quando não autenticado (GET auth-url).
- Adicionar entry no sidebar em `components/layout/sidebar.tsx` sob
  Admin group.

### S06.c — /workspace/slang bulk approve

Refatorar `app/(auth)/workspace/slang/page.tsx` (478L). O arquivo já
tem UI de list/approve/reject individual. Adicionar:
- Botão **"Ingest from sidia.net"** no topo.
- Checkbox por row + **"Approve selected"** action bar.
- Botão **"Approve all from sidia"** no source filter.
- Filter chips "Approve all in category X" onde X é a categoria ativa.

Considerar split se passar de 500L durante o refactor.

### S06.d — `/admin/benchmark` page + sidebar entry

Criar:
- `app/(auth)/admin/benchmark/page.tsx` (pode ser RSC shell ou client
  — decide o agent).
- `components/modules/admin/benchmark/benchmark-client.tsx`.

Features:
- 3 tabs: QA / Ideation / Content Generation.
- Cada tab: form com campos específicos do body.
- Botão "Run benchmark" → POST apropriado.
- **Response display**: mostrar JSON formatado com collapsible sections
  (LLM events, Qdrant events, duração total, cost total).
- Loading state (response pode demorar 60-180s pra content-generation).
- **Listing**: verificar no engine se há endpoint `/api/benchmark/runs`.
  Se existir, listar runs anteriores. Se não existir, mostrar card
  "Histórico persistido no engine disk. Run listing não implementado
  yet." + TODO no código.

Adicionar entry no sidebar (Admin group).

## Changelog

### S06.a — Post preview contentScore + slangReport (2026-04-23)

Types adicionados em `lib/engine-types.ts` + re-exportados em `lib/content-api.ts`:
- `ContentScoreReport` (scoreBefore, scoreAfter, threshold, filled,
  missingEntities[], missingHeadings[], analysisId, analysisStaleDays,
  gapFillCostUsd).
- `SlangReport` (injected, termsAvailable, termsInjected[], densityBefore,
  densityAfter, densityThreshold, injectionCostUsd).
- `PostDetail` ganhou `contentScore?` e `slangReport?`.

Components criados em `components/modules/workspace/guides/`:
- `content-score-card.tsx` (121L) — StatusBadge score (≥80 success / 60-79
  warning / <60 danger), delta before→after quando `filled`, threshold ref,
  `<details>` colapsáveis pra missing entities + headings, footer com
  gapFillCostUsd e analysisStaleDays. **RSC puro** (native `<details>`).
- `slang-report-card.tsx` (112L) — status injected/not, N/M termos, density
  bar before→after vs threshold, lista de termsInjected, injectionCostUsd.
  **RSC puro**.

Integração em `guide-content.tsx` — bloco `<div className="mb-8 space-y-3">`
logo após o header/meta, antes do TOC. Wrapper condicional `(contentScore
|| slangReport)` mantém layout idêntico quando ambos ausentes.

### S06.b — /admin/gsc page (2026-04-23)

Route nova:
- `app/(auth)/admin/gsc/page.tsx` (27L) — RSC shell que faz
  `fetchEngine<GscStatus>("/api/engine/seo/gsc/status")` com fallback
  silencioso.
- `components/modules/admin/gsc/gsc-client.tsx` (297L) — client island com:
  - Status card (configured, siteUrl, info).
  - Sync card: Select `days` (7/14/28/90), botão "Sincronizar agora",
    toast verde `{ fetched, imported, rejected, siteUrl, range }` ou toast
    vermelho quando `error` presente.
  - Auth flow: quando `!configured`, botão "Iniciar autenticação" consome
    `GET /api/engine/seo/gsc/auth-url` — abre URL em `window.open`.

Shape inferido:
```ts
export interface GscStatus {
  configured: boolean;
  siteUrl: string;
  info: string;
}
```

Client trata `authUrl ?? url` pra robustez (controller engine retorna
`authUrl` mas spec mencionava `url`).

Sidebar: entry "GSC" adicionada no grupo Admin (icon `BarChart3`).

### S06.c — Slang bulk approve UI (2026-04-23)

`app/(auth)/workspace/slang/page.tsx` 478L → 366L (orchestrator). 3
sub-files criados em `components/modules/workspace/slang/`:

- `slang-card.tsx` (237L) — card individual com `<Checkbox>` (shadcn)
  pra status `pending`, border highlight quando selecionado. Inclui
  sub-component `SourceBadge` (tint azul pra `sidia`).
- `bulk-action-bar.tsx` (147L) — sticky action bar `z-10` quando
  `selectedIds.size > 0`. Inputs: reviewer notes Textarea, button
  "Approve selected" → `POST /api/engine/slang/approve-bulk`
  `{ ids, reviewerNotes }`. Export adicional `ApproveAllButton`
  (usado em source/category contextual).
- `ingest-sidia-button.tsx` (54L) — button com icon Download, POST
  `/api/engine/slang/ingest/sidia`, toast com `{ fetched, created,
  skipped, durationMs }`, callback `onSuccess` pra refetch list.

Features no page.tsx:
- State: `selectedIds: Set<number>`, derived `pendingSidiaCount`,
  `pendingInCategoryCount`, `allPendingSelected`.
- Native select-all checkbox quando `statusFilter === 'pending'`.
- "Approve all sidia (N)" visível quando `pendingSidiaCount > 0`.
- "Approve all in '<X>' (N)" visível quando category filter ativo.
- Selection clear automático em mudança de filter.
- `any` no `handleSave` substituído por `Partial<SlangCandidate>`
  (bonus no-`any` compliance).

### S06.d — /admin/benchmark page (2026-04-23)

Route nova:
- `app/(auth)/admin/benchmark/page.tsx` (20L) — simple shell que renderiza
  PageHeader + BenchmarkClient.
- `components/modules/admin/benchmark/`:
  - `benchmark-client.tsx` (103L) — shadcn Tabs (QA / Ideation / Content
    Gen). Info card sobre listing endpoint pendente.
  - `use-benchmark-runner.ts` (120L) — hook com `run(endpoint, body)`,
    AbortController, timeout 200s pra content-gen / 60s pros outros.
  - `qa-benchmark-form.tsx` (143L) — question Textarea, queryType Select,
    language Select, modelOverride Input.
  - `ideation-benchmark-form.tsx` (131L) — editorialBriefing, templateFilter
    comma-sep, modelOverride.
  - `content-gen-benchmark-form.tsx` (209L) — briefing form estruturado
    (template, topic, skill, ascendancy, league, notes).
  - `benchmark-result-panel.tsx` (269L) — response display com sections
    colapsáveis (summary, LLM events, Qdrant events, raw JSON).

Types em `lib/benchmark-types.ts` (92L) — `BenchmarkSnapshot`,
`BenchmarkCollectorEvent` (discriminated `kind: "llm" | "qdrant"`),
request bodies `QaBenchmarkRequest`, `IdeationBenchmarkRequest`,
`ContentGenBenchmarkRequest`.

**Listing endpoint**: não existe no engine (grep no
`benchmark.controller.ts` confirmou: 3 `@Post`, zero `@Get`). TODO
documentado em comentário inline + info card visível pro operator com
instrução CLI alternativa.

Sidebar: entry "Benchmark" adicionada no grupo Admin (icon `Activity`).

### Final wrap (2026-04-23)

Validação integrada dos 4 agents paralelos:
- `npx next build` — exit 0, 6.5s.
- `npx vitest run` — 320 passed / 38 failed (baseline inalterado).

## Carryover para session 07

- **Listing endpoint de benchmark**: criar `GET /api/benchmark/runs` no
  engine que retorna lista dos JSONs em `scripts/benchmark/runs/`. Depois
  consumir no hub `/admin/benchmark` pra exibir histórico + diff
  comparativo entre runs.
- **Editor contentScore/slangReport display**: S06.a cobriu o guide view.
  O editor (`components/engine/editor/EditorShell.tsx`) pode ter a mesma
  display inline durante geração pro operator ver em tempo real.
- **Sidebar icons**: grupo Admin ficou com 11 entries. Revisar se faz
  sentido sub-agrupar (SEO admin stuff: GSC + Benchmark talvez).
- Outros god files 500-1000L remanescentes (7 files: workspace/templates
  763L, simulation-editor 755L, admin/config/costs 727L, week-editor 718L,
  SectionEditor 676L, workspace/qa 663L, farm/simulations/annual/[id] 656L).

## Notas

- Entry sidebar: `/admin/gsc` e `/admin/benchmark` novas — grep
  `components/layout/sidebar.tsx` seção Admin e adicionar.
- Shapes de `GeneratedPost` hoje estão em `lib/content-api.ts` —
  verificar se `contentScore` / `slangReport` já estão tipados.
- Não quebra nada existente: guide-content.tsx só ADICIONA seções
  quando os campos estão presentes; slang page só ADICIONA bulk
  actions.
