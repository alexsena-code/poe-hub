# Session 04 — RSC migrations + design sweep (inputs/cores) + god files médios

Data inicial: 2026-04-23.

## Contexto em 60s (pra próximo Claude retomando do zero)

Session 03 (HEAD = `a020a0d`) fechou com god files >1000L ZERADOS:
- S03.a/b/c: seo/youtube 2120→443, seo/reddit 924→197, store-prices-tab 955→210.
- S03.d: /seo/research 1289 rearquitetado em 3 rotas reais (research 197 +
  opportunities 131 + analysis 84).
- S03.e: RSC audit read-only (28 pages `'use client'`, 4 Tier 1, 7 Tier 2, 17 Tier 3).
- Design sweep: `<Spinner>` primitive + substituído em 13 files.

**God files 500-1000L (top 10 atual)**:

| Arquivo | Linhas |
|---|---:|
| `app/(auth)/workspace/ideas/page.tsx` | 928 |
| `app/(auth)/hardware/settings/page.tsx` | 801 |
| `app/(auth)/workspace/templates/page.tsx` | 763 |
| `components/modules/simulations/simulation-editor.tsx` | 755 |
| `app/(auth)/admin/config/costs/page.tsx` | 727 |
| `components/modules/simulations/week-editor.tsx` | 718 |
| `app/(auth)/admin/config/engine/tabs/pipelines-tab.tsx` | 700 |
| `components/engine/editor/SectionEditor.tsx` | 676 |
| `app/(auth)/workspace/qa/page.tsx` | 663 |
| `app/(auth)/farm/simulations/annual/[id]/page.tsx` | 656 |

## Sanity check

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -5                             # a020a0d no topo
git status --short                               # vazio
npx next build 2>&1 | tail -5                    # exit 0
npx vitest run 2>&1 | tail -5                    # 320 passed / 38 failed (baseline DB)
```

## Tema

1. Executar **Tier 1 RSC migrations** (4 pages) com helper de cookie forward.
2. Design sweep wave 2: **inputs manuais** (19+ files → shadcn `<Input>`).
3. Feature nova: **ContentScorer UI** em `/seo/analysis` (textarea draft + score).
4. God file médio #1: split `workspace/ideas` (928L) com inputs sweep inline.

Cores hardcoded (66 files) e outros god files médios (hardware/settings,
workspace/templates etc.) ficam pra session 05 se escopo explodir.

## Plano de fases (paralelo Wave 1)

### S04.a — Tier 1 RSC migrations (4 pages)

Criar helper `lib/fetch-engine.ts` que faz fetch server-side com cookie
forwarding. Assinatura proposta:

```ts
import { headers } from "next/headers";

export async function fetchEngine<T>(path: string, init?: RequestInit): Promise<T> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      cookie: h.get("cookie") ?? "",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`fetch ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

Converter:
- `/dashboard/page.tsx` — fetch `/api/dashboard` → `await fetchEngine(...)`.
- `/workspace/guides/[slug]/page.tsx` — fetch `/api/engine/content/posts/[slug]`.
- `/workspace/guides/[slug]/log/page.tsx` — fetch + timeline vira client island
  (`expanded: Set` state).
- `/admin/observability/page.tsx` — usar shadcn Tabs `defaultValue` (Radix
  gerencia state), page vira RSC pura.

### S04.b — Inputs manuais → shadcn `<Input>` (19+ files)

Pattern antigo:
```tsx
<input
  type="text"
  className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
  ...
/>
```

Pattern novo:
```tsx
import { Input } from "@/components/ui/input";
<Input ... />
```

Exigência: PULAR `/seo/*` (todos os modules seo já refatorados, inputs OK) e
`app/(auth)/workspace/ideas/page.tsx` (agent D faz inline durante split).

### S04.c — ContentScorer UI

Em `/seo/analysis`:
- Add textarea "Draft markdown" no painel de input (abaixo de keyword/locale).
- Se draft não vazio + keyword válida: habilita "Score content".
- Fetch POST `/api/engine/seo/score` com `{ keyword, locale, draft }`.
- Display: score 0-100 + missing entities + missing headings.
- Opcional: "Create brief with gaps" action (stub por ora se endpoint não pronto).

Verificar antes de começar: `content-scorer.controller.ts` no engine.

### S04.d — `/workspace/ideas` split (928L)

Page é content brief generation (ideation pipeline). State denso: briefs
list, filters (status), generation flow, LLM streaming.

Split em `components/modules/workspace/ideas/`:
- `types.ts` — ContentBrief + enums.
- `helpers.ts` — color maps (URGENCY, EFFORT, STATUS, TEMPLATE_LABELS),
  constants (GENERATABLE_TEMPLATES, CANONICAL_DATA_SOURCES).
- `use-ideas-state.ts` — hook com briefs + filters + polling.
- `brief-card.tsx` — card individual.
- `brief-list.tsx` — lista com filters.
- `generate-flow.tsx` — controles de geração (template picker, data sources,
  generate/cancel buttons).
- `brief-detail-panel.tsx` — expanded view de um brief selecionado.

Aplicar sweep de inputs manuais durante o split.

## Changelog

### S04.a — Tier 1 RSC migrations (4 pages + helper) (2026-04-23)

Criado `lib/fetch-engine.ts` (35L) — helper compartilhado que lê
`next/headers()`, forward do cookie de auth, compõe URL absoluta via
`host`/`x-forwarded-proto`. Throws com path + status no erro. Generic `<T>`.

4 pages migradas:

| Page | Before | After | Tipo |
|---|---:|---:|---|
| `/admin/observability/page.tsx` | 58L client | 54L | RSC puro (shadcn Tabs `defaultValue`) |
| `/dashboard/page.tsx` | 95L client | 79L | RSC puro (fetchEngine) |
| `/workspace/guides/[slug]/page.tsx` | 73L client | 59L | RSC puro (usa types de lib/content-api) |
| `/workspace/guides/[slug]/log/page.tsx` | 262L client | 123L RSC + 169L client island | Híbrido |

Client island extraído: `components/modules/workspace/guides/log-timeline.tsx`
(169L) — owns `useState<Set<number>>` para expand/collapse.

Ajustes incidentais:
- `PostDetail`/`PostSection` importados de `lib/content-api.ts` ao invés de
  redeclarar inline (antigo tinha `any`).
- `Record<string, any>` → `Record<string, unknown>` em `LogTimeline` pra
  compliance no-`any`.

### S04.b — Inputs manuais sweep (2026-04-23)

Substituído pattern `<input className="w-full rounded-lg border border-border
bg-surface">` pelo shadcn `<Input>` em 9 arquivos. Idem `<textarea>` →
`<Textarea>`.

Arquivos tocados:
- `components/engine/briefing/{league-field,notes-textarea,topic-or-skill-fields,pob-importer}.tsx` (6 subs).
- `components/engine/{OutlineEditor.tsx,editor/EditorShell.tsx,editor/SectionEditor.tsx}` (6 subs).
- `app/(auth)/workspace/{qa,templates}/page.tsx` (11 subs).

Pulados (não tinham text inputs, ou eram checkboxes/selects): keybert-tab,
template-selector, logs-tab, FeatureFlagsPanel, PlanPreview, PublishPanel,
SkimCollectionsSelector, TraceViewer.

Caso especial: `AutoGrowTextarea` em `OutlineEditor.tsx` mantido como native
`<textarea>` (ref direto em `el.style.height` pro auto-grow), mas com classes
shadcn-equivalent (`border-input`, `ring-ring/50`, `focus-visible:*`).

### S04.c — ContentScorer UI em /seo/analysis (2026-04-23)

Endpoint confirmado: `POST /api/engine/seo/score`. Body:
`{ keyword, draft, locale?, game?, triggerAnalysisIfMissing?, staleAfterDays? }`.
Response: `{ status: 'scored', contentScore, centroidSimilarity, perUrlSimilarity,
missingEntities, missingHeadings, ... }` ou `{ status: 'no_analysis', hint }`.

Arquivos criados em `components/modules/seo/analysis/`:
- `types.ts` (28L) — `ContentScore`, `PerUrlSimilarity`, `ScoreResponse`.
- `draft-textarea.tsx` (37L) — shadcn Textarea 12 rows + char counter.
- `content-score-card.tsx` (70L) — score 0-100, color tiers, progress bar.
- `gaps-panel.tsx` (52L) — 2 colunas: missing headings + missing entities.

Modificados:
- `use-analysis-state.ts` (154L) — add `draft/score/scoreLoading/scoreError`,
  `setDraft`, `scoreContent` action.
- `app/(auth)/seo/analysis/page.tsx` (125L) — wire DraftTextarea, Score button,
  ContentScoreCard, GapsPanel.

`triggerAnalysisIfMissing: true` passado pro engine — evita two-step
requirement (analyze → score). Primeiro score pode levar ~15s se SERP
analysis não existir; subsequentes são instantâneos.

### S04.d — /workspace/ideas split (2026-04-23)

`app/(auth)/workspace/ideas/page.tsx` 929L → 229L (-75%). 9 sub-files em
`components/modules/workspace/ideas/`:

- `types.ts` (37L) — `ContentBrief`, `BriefStatus`, `UrgencyFilter`, `BriefCounts`.
- `constants.ts` (61L) — `IDEAS_API`, color maps, `TEMPLATE_LABELS`,
  `GENERATABLE_TEMPLATES`, `CANONICAL_DATA_SOURCES`, `MODEL_OPTIONS`.
- `use-ideas-state.ts` (153L) — briefs list + filters + `fetchBriefs`,
  `updateStatus`, `toggleDataSource`, `clearBriefs`, `exportContent`,
  `deleteGeneratedPost`, `counts`.
- `use-generate-flow.ts` (166L) — ideation run polling + per-brief content
  generation polling (2 intervals independentes + cleanup).
- `briefing-text-panel.tsx` (130L) — edit/save/regenerate expanded briefing.
- `brief-card.tsx` (52L) — summary row clicável.
- `brief-expanded-detail.tsx` (300L) — full expanded view com keywords,
  DataSourcesSection, BriefingTextPanel, StatusActions.
- `brief-list.tsx` (93L) — orchestrator com loading/empty states.
- `generate-controls.tsx` (160L) — action buttons + briefing textarea +
  template picker.

Side-effect: criado `components/ui/textarea.tsx` (20L, shadcn primitive que
não existia no projeto — ambos S04.b e S04.d precisavam). Segue o pattern
de `components/ui/input.tsx`.

### Final wrap (2026-04-23)

Validação integrada dos 4 agents rodando em paralelo:
- `npx next build` — exit 0, 5.1s.
- `npx vitest run` — 6 failed | 20 passed / 38 failed | 320 passed. Baseline
  pré-existente inalterado.

**Marco**: `'use client'` pages em `app/(auth)/` caiu de 28 → 24 (4 Tier 1
migradas). Target original `≤50` em pages ultrapassado com folga.

## Carryover para session 05

- **RSC Tier 2 migrations** (7 pages): `/hardware/{recent,alerts}`,
  `/workspace/{guides,people}`, `/admin/config/proxy`, `/seo/keybert`,
  `/farm/simulations/annual`. Padrão: page RSC faz fetch, passa data pra
  client island que cuida da interação. `fetchEngine` helper já existe.
- **Design sweep cores hardcoded** (66 files): migrar
  `bg-{red,green,orange,amber,blue,purple,emerald,zinc}-{100..900}` pra
  semantic tokens. Dividir em waves:
  - Wave 1: status badges (urgency, effort, status, source) — consolidar em
    `<StatusBadge>` helper.
  - Wave 2: backgrounds com alpha (`bg-*-900/40 text-*-300`) — pattern comum
    em cards coloridos.
  - Wave 3: restante.
- **God files médios** (500-1000L): `/hardware/settings` (801L),
  `/workspace/templates` (763L), `simulation-editor` (755L),
  `/admin/config/costs` (727L), `week-editor` (718L), `pipelines-tab` (700L),
  `SectionEditor` (676L), `/workspace/qa` (663L),
  `/farm/simulations/annual/[id]` (656L).

## Notas

- Cores hardcoded sweep adiado: 66 files é escopo grande, melhor isolado.
- God files médios: só atacar quando terminar o RSC batch pra não sobrecarregar.
