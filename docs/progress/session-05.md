# Session 05 — RSC Tier 2 + god files médios + StatusBadge semantic tokens

Data inicial: 2026-04-23.

## Contexto em 60s

Session 04 (HEAD = `79365fc`) fechou com:
- S04.a Tier 1 RSC (4 pages) + helper `lib/fetch-engine.ts`.
- S04.b Inputs sweep (9 arquivos pra shadcn `<Input>`/`<Textarea>`, +
  primitive `components/ui/textarea.tsx` novo).
- S04.c ContentScorer UI ativa em `/seo/analysis`.
- S04.d `/workspace/ideas` 929→229L + 9 sub-files.

**God files 500-1000L atuais (top 9)**:

| Arquivo | Linhas |
|---|---:|
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
git log --oneline -5                             # 79365fc no topo
git status --short                               # vazio
npx next build 2>&1 | tail -5                    # exit 0
npx vitest run 2>&1 | tail -5                    # 320/38 baseline
```

## Tema

1. Migrar 7 pages Tier 2 do RSC audit pra RSC shell + client island.
2. Splitar 2 god files médios (pipelines-tab 700L, hardware/settings 801L).
3. Criar `<StatusBadge>` + migrar color maps (urgency/effort/status/source)
   pra semantic tokens — escopo focado em badges, não 66 files inteiros.

## Wave 1 paralelo

### S05.a — RSC Tier 2 migrations (7 pages)

Pattern: page RSC faz fetch inicial via `fetchEngine`, passa data pra
`<ClientIsland>` que cuida da interação (filter/sort/CRUD).

Pages (do audit S03.e):
- `/hardware/recent` — fetch + filter/sort/search local + paginação.
- `/hardware/alerts` — fetch 2 endpoints + threshold slider + sort local.
- `/workspace/guides` — useSearchParams + fetch posts + DELETE handlers.
- `/workspace/people` — fetch + inline add/edit/delete forms.
- `/admin/config/proxy` — react-hook-form + fetch + PUT mutation.
- `/seo/keybert` — polling (10s interval) + POST dispatch.
- `/farm/simulations/annual` — useRouter + fetch plans + POST/DELETE.

Extrair client island em `components/modules/<domain>/<feature>-client.tsx`.

### S05.c — pipelines-tab split (700L)

`app/(auth)/admin/config/engine/tabs/pipelines-tab.tsx` é um dos 9 tabs
extraídos na session 01 do split do engine-config (1944→182L). Flagged
então mas não splitado porque "justificado".

Agora passou a ser maior que target 550L. Split em
`components/modules/admin/engine-config/pipelines/` com sub-files por
concern (presumivelmente: templates list, template editor, preview).

### S05.d — hardware/settings split (801L)

Proxy URL masking, form handlers, PUT mutations inline. Tier 3 no audit
(mantém `'use client'`). Split em `components/modules/hardware/settings/`
com sub-files por seção.

## Wave 2 — StatusBadge semantic tokens

Criar `components/ui/status-badge.tsx`:

```tsx
interface StatusBadgeProps {
  variant: "success" | "warning" | "danger" | "info" | "neutral" | "seo";
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-muted/40 text-muted-foreground border-border",
  seo: "bg-[var(--color-seo)]/15 text-[var(--color-seo)] border-[var(--color-seo)]/30",
};
```

Migrar color maps em:
- `components/modules/workspace/ideas/constants.ts` — URGENCY_COLORS,
  EFFORT_COLORS, STATUS_COLORS.
- `components/modules/seo/shared/helpers.ts` — sourceColor, intentColor,
  actionBadge, viceColor.
- `components/modules/seo/youtube/helpers.ts` — statusColor, intentColor,
  viceColor.
- `components/modules/seo/reddit/helpers.ts` — subredditColor (KEEP —
  identidade visual não-semântica; flair/urgency sim migra).
- `app/(auth)/workspace/guides/[slug]/log/page.tsx` — NODE_COLORS,
  KIND_BADGE (já migrada pra RSC em S04.a; tokens ficam no RSC part).

**NÃO migrar**:
- Cores de identidade visual (subredditColor, channelColor, team colors).
- Chart colors (recharts palette — decisão de viz).
- Gradients e bg decorativos.

Esse escopo toca ~10 arquivos, não 66.

## Changelog

### S05.a — RSC Tier 2 migrations (2026-04-23)

**5 pages migradas** para pattern RSC shell + client island:

| Page | Before | After (RSC) | Client island |
|---|---:|---:|---|
| `/workspace/guides/page.tsx` | 299L | 23L | `components/modules/workspace/guides/guides-client.tsx` (310L) |
| `/workspace/people/page.tsx` | 453L | 18L | `components/modules/workspace/people/people-client.tsx` (475L) |
| `/admin/config/proxy/page.tsx` | 229L | 25L | `components/modules/admin/config/proxy-client.tsx` (234L) |
| `/seo/keybert/page.tsx` | 209L | 29L | `components/modules/seo/keybert/keybert-client.tsx` (208L) |
| `/farm/simulations/annual/page.tsx` | 237L | 20L | `components/modules/farm/simulations/annual-client.tsx` (228L) |

Usa `lib/fetch-engine.ts` (S04.a) pro fetch server-side com cookie forward.

**2 pages skipped** — `/hardware/recent` (347L) e `/hardware/alerts` (374L).
Ambas fetcham external API via `NEXT_PUBLIC_HARDWARE_API_URL` (browser env
var), incompatível com `fetchEngine` server-side. Mantidas client-side.
Solução futura: criar proxy route `/api/hardware/*` no hub que forward pro
external service, aí RSC vira viável.

Notas de design:
- **Guides**: `<Suspense>` wrapper adicionado no RSC shell porque client
  island usa `useSearchParams` (Next.js requirement).
- **Proxy**: RSC fetch best-effort com try/catch fallback pra defaults;
  client island mantém botão "Recarregar" pra re-fetch manual.
- **KeyBERT**: inline toast custom preservado (z-50 conflict com module
  selector bloqueou usar sonner).

### S05.c — pipelines-tab split (2026-04-23)

`app/(auth)/admin/config/engine/tabs/pipelines-tab.tsx` 700L → 40L
orchestrator + 6 sub-files em
`components/modules/admin/engine-config/pipelines/`:

- `types.ts` (227L) — `PipelineLog`, `PipelineState`, `PipelineCosts`,
  `PipelineDefinition`, `PipelineConfigField`, `PIPELINES` (16 entradas),
  `STEP_COLORS`, `API`.
- `use-pipelines-runner.ts` (259L) — hook com `states`/`configs`, `addLog`,
  `updateState`, `runSse`/`runPoll`/`runFire`, `runPipeline` dispatcher,
  `logEndRefs`.
- `pipeline-card.tsx` (126L) — render de um pipeline (header, config,
  progress bar, log, result, error).
- `pipeline-costs-card.tsx` (66L) — fetch + render do card de custos 30d.
- `pipeline-result-summary.tsx` (101L) — stats grid + JSON toggle por tipo.
  **Eliminou um `any`** (antes: `result: any` → agora `result: unknown` +
  narrowing explícito).
- `pipeline-status-badge.tsx` (18L) — badge por status.

Bug bônus corrigido: JSX short-circuit com `unknown` (`{state.result &&}`)
trocado por `{state.result != null &&}` pra manter narrowing.

### S05.d — hardware/settings split (2026-04-23)

`app/(auth)/hardware/settings/page.tsx` 801L → 59L orchestrator + 8
sub-files em `components/modules/hardware/settings/`:

- `types.ts` (41L) — `OlxCategory`, `Proxy`, `WorkerStatus`,
  `ITEM_CATEGORIES`, `SUGGESTED_CATEGORIES`.
- `helpers.ts` (38L) — `maskProxyUrl` (security-sensitive, JSDoc),
  `proxyRowClass`, `formatSettingsDate`.
- `use-settings-state.ts` (336L) — hook com fetch + mutation de 4 domínios
  (worker, categories, webhook, proxies); retorna `SettingsState` tipado.
- `item-category-multi-select.tsx` (69L) — Popover com checkboxes.
- `worker-status-card.tsx` (36L) — Online/Offline + skeleton.
- `categories-card.tsx` (181L) — add form, quick-add, tabela, ações.
- `discord-webhook-card.tsx` (76L) — input password, save, test.
- `proxy-pool-card.tsx` (178L) — add form, test-all, tabela mascarada.

### S05.b — StatusBadge + semantic tokens (2026-04-23)

**Novo primitive**: `components/ui/status-badge.tsx` (52L). API:
`StatusBadge({ variant, children, className })` + export `StatusBadgeVariant`.
6 variants: `success`, `warning`, `danger`, `info`, `seo`, `neutral`.

Detalhe técnico: variant `seo` usa `color-mix()` ao invés de `/15` Tailwind
opacity shorthand porque Tailwind v4 JIT não gera utilities de opacity pra
tokens custom (`--color-seo`) sem alias Tailwind oficial. Os outros 4
(`success/warning/destructive/info`) funcionam via shorthand normal.

**11 arquivos migrados** (color-map replacements):

- `components/modules/workspace/ideas/constants.ts` — `URGENCY_COLORS`,
  `EFFORT_COLORS`, `STATUS_COLORS` → `URGENCY_VARIANTS`, `EFFORT_CLASSES`,
  `STATUS_VARIANTS`.
- `brief-card.tsx`, `brief-expanded-detail.tsx` — consumers migrados.
- `components/modules/seo/shared/helpers.ts` — `sourceColor` → `sourceVariant`;
  `actionBadge` agora retorna `{ label, variant }`; `intentColor`, `viceColor`
  → tokens semânticos diretos.
- `components/modules/seo/research/{keywords-tab,scan-history-tab}.tsx`.
- `components/modules/seo/opportunities/{striking-distance-tab,ramping-tab}.tsx`.
- `components/modules/seo/youtube/helpers.ts` — `statusColor` → `statusVariant`;
  `intentColor`, `viceColor`, `scoreColor` → tokens.
- `components/modules/seo/youtube/{db-keywords-tab,trending-tab}.tsx`.

**Preservados (identidade visual / decoração)**:
- `subredditColor`, `flairColor` em `reddit/helpers.ts` — identidade visual
  Reddit (r/pathofexile laranja, etc.), não semântico.
- `channelColor` em `youtube/helpers.ts` — hash determinístico sobre 8 cores,
  identidade, não status.
- Tags "LIVE" decorativas em `new-uploads-tab`, `top-videos-tab`, `videos-tab`.
- `navigational` intent mantém `text-purple-400` (sem token semântico
  roxo em `globals.css`; não mapeia naturalmente pra success/warning/danger/info).
- Toggle button states (activeCls/inactiveCls) e action buttons (delete) —
  não são status badges semânticos.

### Final wrap (2026-04-23)

Validação integrada pós-Wave 1 (3 agents) + Wave 2 (1 agent):
- `npx next build` — exit 0, 5.5s.
- `npx vitest run` — 320 passed / 38 failed, baseline pré-existente intacto.

### S05.e — Hardware proxy route + RSC migration (2026-04-23)

Criado `app/api/hardware/[...path]/route.ts` (55L) — proxy catch-all pro
hardware service (Python FastAPI externo). Padrão similar ao
`/api/engine/[...path]` mas sem API key e com prefix `/api/` auto
(hub chama `/api/hardware/deals` → forward pra `${HARDWARE_API_URL}/api/deals`).

Env: prefere `HARDWARE_API_URL` (server-only, novo) com fallback pra
`NEXT_PUBLIC_HARDWARE_API_URL` (browser, legado). Localhost default.
Auth via `getServerSession` — retorna 401 sem sessão.

2 pages migradas pra RSC:

| Page | Before | After |
|---|---:|---:|
| `/hardware/recent/page.tsx` | 347L `'use client'` | 31L RSC + 352L client island |
| `/hardware/alerts/page.tsx` | 374L `'use client'` | 36L RSC + 378L client island |

Client islands em `components/modules/hardware/{recent,alerts}/` com
`initialDeals`/`initialItems`/`initialHours` como props; `skipInitial`
flag evita double-fetch no mount (RSC já hidratou).

Observações:
- Discount color (`text-emerald-400`/`text-green-500`/`text-yellow-500`
  /`text-orange-500`) migrado pra semantic tokens (`text-success`
  strong/normal/`text-warning`/`text-muted-foreground`) — sweep
  inline aproveitado.
- Link colors (`text-blue-500 hover:text-blue-400`) → `text-info
  hover:text-info/80` (semantic).

### Final wrap (2026-04-23)

Validação integrada pós todas as fases (4 Wave 1 + 1 Wave 2 + proxy):
- `npx next build` — exit 0, 6.5s.
- `npx vitest run` — 320 passed / 38 failed, baseline pré-existente intacto.

## Carryover para session 06
- **God files médios remanescentes** (7 files): `workspace/templates` (763L),
  `simulation-editor` (755L), `admin/config/costs` (727L), `week-editor` (718L),
  `SectionEditor` (676L), `workspace/qa` (663L), `farm/simulations/annual/[id]`
  (656L).
- **Cores hardcoded wave 3+**: outros bg/text/border-{color}-{shade}
  restantes em páginas não-semanticamente-status (ex.: decoradores de
  layout, custom gradients). Caso-a-caso.

## Notas

- Outros god files 500-1000L (workspace/templates, simulation-editor,
  admin/config/costs, week-editor, SectionEditor, workspace/qa,
  farm/simulations/annual/[id]) ficam carryover session 06 se escopo
  não fechar aqui.
- Cores hardcoded restantes (~50 arquivos após StatusBadge) seguem no
  código — migration caso-a-caso em sessions futuras.
