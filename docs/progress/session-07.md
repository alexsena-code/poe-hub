# Session 07 — Zerar carryover pré-editor-rewrite

Data inicial: 2026-04-23.

## Contexto em 60s

Session 06 (HEAD = `56118d6`) fechou com 4/4 consumers da engine Fase C
landed. Próxima etapa grande é **planejar um editor muito bom** + **integrar
com Sanity API pra publicar posts diretamente**. Esta session 07 existe
pra **zerar o máximo de carryover possível** antes disso.

**Explicitamente skipped**:
- `SectionEditor.tsx` (676L) — vai ser reescrito no editor novo; split
  agora = waste.
- Benchmark listing endpoint — scope é no engine repo, não aqui.

**God files 500-1000L atacáveis**:

| Arquivo | Linhas |
|---|---:|
| `app/(auth)/workspace/templates/page.tsx` | 763 |
| `components/modules/simulations/simulation-editor.tsx` | 755 |
| `app/(auth)/admin/config/costs/page.tsx` | 727 |
| `components/modules/simulations/week-editor.tsx` | 718 |
| `app/(auth)/workspace/qa/page.tsx` | 663 |
| `app/(auth)/farm/simulations/annual/[id]/page.tsx` | 656 |
| `app/(auth)/workspace/guides/[slug]/guide-content.tsx` | 573 |

Mais 2 refactors pequenos:
- Editor `EditorShell.tsx` ganhar inline display de `contentScore` +
  `slangReport` (reutilizar cards do S06.a).
- Sidebar Admin ganhou 11 entries — sub-agrupar em "Operações" / "SEO Tools"
  / "Config" ou similar.

## Sanity check

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -3                             # 56118d6 no topo
git status --short                               # vazio
npx next build 2>&1 | tail -5                    # exit 0
npx vitest run 2>&1 | tail -5                    # 320/38 baseline
```

## Plano (8 agents paralelos)

### Wave 1 — God file splits (6 agents, arquivos isolados)

- **S07.a** — `workspace/templates/page.tsx` (763L) → `components/modules/workspace/templates/`.
- **S07.b** — `simulation-editor.tsx` (755L) → `components/modules/simulations/simulation-editor/`.
- **S07.c** — `admin/config/costs/page.tsx` (727L) → `components/modules/admin/config/costs/`.
- **S07.d** — `week-editor.tsx` (718L) → `components/modules/simulations/week-editor/`.
- **S07.e** — `workspace/qa/page.tsx` (663L) → `components/modules/workspace/qa/`.
- **S07.f** — `farm/simulations/annual/[id]/page.tsx` (656L) → `components/modules/farm/simulations/annual-detail/`.

### Wave 2 — Polish (2 agents, refactors menores)

- **S07.g** — Editor inline contentScore/slangReport display em
  `EditorShell.tsx`. Reutilizar cards criados no S06.a.
- **S07.h** — Sidebar Admin sub-agrupar (11 entries → grupos semânticos).

## Changelog

### S07.a — workspace/templates split (763L → 108L orchestrator + 9 sub-files)

- `app/(auth)/workspace/templates/page.tsx` 763L → 108L (thin orchestrator)
- `components/modules/workspace/templates/types.ts` 41L — TemplateSection, TemplateSeo, Template, TemplateListItem, QUERY_TYPES
- `components/modules/workspace/templates/helpers.ts` 101L — apiToTemplate, templateToApi, emptySection, emptyTemplate (no `any`)
- `components/modules/workspace/templates/tag-input.tsx` 59L — TagInput client component
- `components/modules/workspace/templates/section-editor.tsx` 130L — SectionEditor accordion component
- `components/modules/workspace/templates/template-sidebar.tsx` 46L — sidebar list
- `components/modules/workspace/templates/template-fields.tsx` 169L — metadata + sections + SEO panel
- `components/modules/workspace/templates/template-actions.tsx` 66L — save/delete bar
- `components/modules/workspace/templates/yaml-import-modal.tsx` 67L — YAML import modal
- `components/modules/workspace/templates/use-templates-state.ts` 223L — full state hook (fetch, save, delete, import)
- Eliminated the two `any` usages in apiToTemplate/templateToApi (typed via Record<string, unknown> + narrowing)
- Build: `npx next build` EXIT:0 — `/workspace/templates` route present
- Tests: `npx vitest run` — 320 passed / 38 failed (baseline unchanged)

### S07.b — simulation-editor split (755L → 249L index + 7 sub-files)

`components/modules/simulations/simulation-editor.tsx` deletado. Pasta
`simulation-editor/` criada com `index.tsx` orchestrator.

- `types.ts` (48L) — `CostConfig`, `Simulation`, `STATUS_LABELS`, `STATUS_VARIANTS`.
- `utils.ts` (189L) — `fmtUsd/Brl/Num`, `resolveField`, `calcTotals`, `buildWeekData`. `calcTotals` agora recebe `exchangeRate` como parâmetro.
- `simulation-header.tsx` (168L) — voltar + inline edit (nome/liga/status) + ImportPricesDialog + CostConfigSelector.
- `simulation-summary-cards.tsx` (70L) — 5 KPI cards.
- `simulation-cost-breakdown.tsx` (127L) — fórmula diária + lista semanal + custos únicos.
- `simulation-revenue-chart.tsx` (169L) — toggle Cumulative/Stacked; `chartMode` state local.
- `simulation-weeks-accordion.tsx` (97L) — accordion com WeekEditor + preview receita.
- `index.tsx` (249L) — orchestrator (fetch + handlers + renders condicionais).

Consumer único (`/farm/simulations/[id]`) preservado via TS auto-resolve.
`DisplayCurrency` type promovido de local → exported em
`components/currency-provider.tsx` pro typing dos sub-components.

### S07.c — admin/config/costs split (727L → 77L orchestrator + 8 sub-files)

- `types.ts` (46L) — `CustomCost`, `CostConfig`, `COST_FIELDS`, derived types.
- `schema.ts` (38L) — zod schemas + `CostConfigForm` + `COST_CONFIG_DEFAULTS`.
- `helpers.ts` (10L) — `cadenceLabel`.
- `use-costs-state.ts` (202L) — hook com state + `useForm` + `useFieldArray` + todos handlers.
- `cost-field.tsx` (76L) — labeled input com currency toggle ($/R$).
- `custom-costs-field-array.tsx` (149L) — wrap do `useFieldArray` + `CustomCostRow` privado.
- `cost-config-form-dialog.tsx` (177L) — Dialog + form com todos campos.
- `cost-configs-table.tsx` (182L) — tabela read-only + `ConfigRow` + `CustomCostsBadge`.

Page 727L → 77L. `useFieldArray` stays no hook; `handleSubmit(onSubmit)`
wrapper exposto pronto pra bind no Dialog.

### S07.d — week-editor split (718L → 301L index + 6 sub-files)

`components/modules/simulations/week-editor.tsx` deletado.

- `types.ts` (49L) — `SimulationDay`, `SimulationWeek`, `CostConfig`, `WeekEditorProps`, `InheritableField`.
- `helpers.ts` (57L) — `fmtDate`, `fmtUsd`, `fmtNum`, `resolveField`, `isOverridden`.
- `inline-cell.tsx` (117L) — click-to-edit cell com inherited/override visual.
- `default-field.tsx` (94L) — labeled editable field pra week defaults.
- `week-params-inputs.tsx` (71L) — bar de params (bots, div/hr, hrs/day, etc.).
- `day-row.tsx` (193L) — single row com 5 cells + locked variant.
- `index.tsx` (301L) — orchestrator (API callbacks + totals + table).

4 consumers preservados (simulation-comparison, simulation-editor) via
TS resolve `./week-editor` → `./week-editor/index.tsx`.

### S07.e — workspace/qa split (663L → 82L orchestrator + 8 sub-files)

- `types.ts` (43L) — `Message`, `MessageLayers`, `MessageCost`, `Conversation`, `ConversationGroup`, `LanguagePref`.
- `helpers.ts` (60L) — `groupConversationsByDate`, `mapApiMessageToMessage`, `EXAMPLE_QUESTIONS`, `LANGUAGE_STORAGE_KEY`.
- `use-qa-state.ts` (247L) — state + CRUD conversations + `handleSend` two-phase fetch.
- `conversation-list.tsx` (138L) — sidebar com `ConversationItem` (hover-delete).
- `chat-header.tsx` (86L) — toggle sidebar + `LanguageToggle`.
- `message-bubble.tsx` (128L) — bubble + `MessageContextPanel` + `ContextDetails`.
- `chat-messages.tsx` (94L) — scroll area + `EmptyState` + `LoadingBubble` (bounce dots com style inline preservado).
- `chat-input-bar.tsx` (45L) — shadcn Input + Enter handler.

### S07.f — farm/simulations/annual/[id] split (656L → 100L orchestrator + 7 sub-files)

- `types.ts` (27L) — re-exports.
- `use-annual-detail-state.ts` (189L) — fetch + save + optimistic state.
- `plan-header.tsx` (125L) — back + inline edit + save + 5 KPI cards.
- `leagues-table.tsx` (134L) — add/unlink por row.
- `fixed-costs-panel.tsx` (119L) — `FixedCostsPanel` + `FixedCostRow` + `calcAnnual`.
- `league-comparison-chart.tsx` (57L) — recharts BarChart.
- `simulation-picker-dialog.tsx` (132L) — dialog + `PickerTable`.

### S07.g — Editor inline contentScore/slangReport (2026-04-23)

`components/engine/editor/EditorShell.tsx` +15L (411→426L). 3 hunks:
- Imports (`ContentScoreCard`, `SlangReportCard`, types).
- State (`contentScore`, `slangReport` — null-inicial).
- Fetch effect setta state quando saved post payload inclui os campos.
- Render: panel condicional `{(contentScore || slangReport) && ...}`
  entre scroll area e bottom bar.

Zero render pra posts antigos (sem os campos da Fase C).

### S07.h — Sidebar Admin regroup (2026-04-23)

`components/layout/sidebar.tsx` 378→426L. Admin group 11 entries flat
→ 3 sub-grupos:

```
Admin
├─ Operações (Observability, Tarefas, Benchmark)
├─ SEO Tools (GSC)
└─ Config (Engine Config, Custos, Proxy, Ligas, Usuários, Feature Flags)
```

`NavGroup.children: NavItem[]` → `NavEntry[]` (recursivo). Added
`hasActiveDescendant()` recursiva + `NavEntryRenderer` dispatcher.

### Final wrap (2026-04-23)

Validação integrada pós 8 agents paralelos:
- `npx next build` — exit 0, 6.9s, 93/93 pages.
- `npx vitest run` — 320 passed / 38 failed (baseline inalterado).

## Carryover para session 08

Pré-grandes-etapas (editor novo + Sanity integration):

- **SectionEditor.tsx** (676L) — **intencionalmente mantido** pra ser
  reescrito no editor novo. Único god file remanescente >500L.
- **Benchmark listing endpoint** — fica no engine repo (`GET /api/benchmark/runs`).
- **Grande etapa pendente**: planejar editor novo + integração Sanity
  API pra publicação direta de posts.

## Notas

- `SectionEditor.tsx` (676L) **não** é target — vai ser reescrito no
  editor novo.
- `guide-content.tsx` (573L) está marginalmente acima de 550 mas o
  conteúdo é hub de rendering (sections list + markdown + cards novos
  S06.a) — split só se ultrapassar 600L.
- Benchmark listing endpoint fica no engine repo carryover.
- Pós-session 07 a expectativa é god files médios ≤1 (só SectionEditor
  flagged).
