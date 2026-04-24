# Session 13 — Benchmark infrastructure (presets + history + compare + LLM-as-judge)

Data inicial: 2026-04-24.

## Contexto em 60s

O `/admin/benchmark` existente (session 06 S06.d) disparava runs contra o
engine mas não persistia nada — histórico ficava em `scripts/benchmark/runs/`
do engine, operador não tinha como preencher o form sem copiar dados toda vez,
e o model override era global (trocava write + critique + summarize + qa
juntos, impossível isolar o impacto no node `write`).

Operador pediu 3 waves de uma vez, paralelizado:
- **Wave 1**: node-scoped override + OpenRouter lookup ao vivo + presets CRUD
  + runs persistence + history page.
- **Wave 2**: compare page com métricas Δ% (cost, latência, tokens, per-node,
  per-scenario).
- **Wave 3**: LLM-as-judge usando Sonnet 4.6 (não Opus — custo-efetivo) pra
  avaliação subjetiva por dimensão.

## Decisões

- **Sonnet 4.6 como juiz default** por custo (Opus 4.7 custa ~3-4x mais).
  Opcional trocar via `?judgeModel=...` no evaluate endpoint.
- **Per-node override via `modelOverrides: Record<string, string>`**. Scalar
  `modelOverride` legado mantido pra não quebrar CLI existente — atua como
  fallback pros nodes que o map não cita.
- **Persistência no hub DB, não no engine**. Presets + Runs + Evaluations
  são artefatos de UX do operador, não responsibility do content engine
  (engine stays stateless per spec).
- **LLM-as-judge opt-in**. Custa ~$0.01-0.05 por comparação (Sonnet 4.6 via
  OpenRouter), sempre requer clique explícito.
- **Paralelização máxima**: 3 agents Phase 1 + 4 agents Phase 2 + 3 agents
  Phase 3 = 10 agents, estruturados pela fundação compartilhada (schema
  Prisma) criada primeiro.

## Sanity check

```bash
git log --oneline -3                    # 0ad9583 no topo
git status --short                      # 2 tour-*.png (ignorar)
npx vitest run 2>&1 | tail -3           # 696 passed baseline
```

## Plano (3 waves em paralelo)

- **Pre**: schema Prisma + migration (3 models + 1 enum)
- **Wave 1 parallel**: engine override / OpenRouter proxy / polling fix
- **Wave 2 parallel**: presets CRUD / runs API / evaluate endpoint / seed script
- **Wave 3 parallel**: forms UI / history page / compare page

## Changelog

### Pre — Schema Prisma + migration (2026-04-24)

Enum `BenchmarkType (qa | ideation | content_generation)` + 3 models:
- `BenchmarkPreset` — form setups (name + type + payload JSON). UNIQUE
  (name, type). Seed from engine `scenarios.yaml`.
- `BenchmarkRun` — uma por execução. Armazena `modelOverrides + requestBody
  + response` brutos + denormalizados (`totalCostUsd`, `totalDurationMs`,
  `llmCallCount`, `qdrantQueryCount`, `httpStatus`). Preset via FK nullable
  (`onDelete: SetNull` preserva histórico).
- `BenchmarkEvaluation` — verdict do juiz pareando (runA, runB, judgeModel).
  UNIQUE permite re-run com `force: true`. `onDelete: Cascade` via FK pros 2 runs.

Migration manual (`20260424180000_add_benchmark_session_13`) porque dev DB
tinha drift em `global_cost_configs` defaults não-relacionado — SQL
direto sem reset. `prisma migrate resolve --applied` pra marcar + `db
execute` pra aplicar. Test DB (`potc_test`) recebeu mesmo migrate via
`migrate deploy`.

### S13.W1.a — Engine node-scoped modelOverrides (2026-04-24)

Expansão do contract em `../path-of-trade-content/packages/api`:

Arquivos editados (5) + 1 novo teste:
- `benchmark.controller.ts`: 3 `@Body()` types ganharam `modelOverrides?:
  Record<string, string>`.
- `benchmark.processor.ts`: 3 job interfaces idem — body do BullMQ é
  free-form, só acrescentei o campo.
- `benchmark.service.ts`: helper novo `wrapWithOverrides()` — usa
  `PerNodeOverrideContext` quando `modelOverrides` vem, fallback para
  `ModelOverrideContext` (legacy global) quando só scalar.
- `benchmark-context.ts`: classe `PerNodeOverrideContext` com `lookup(node)
  → string | undefined` + `buildStore({ scalarFallback, perNode })`.
- `llm.service.ts`: resolução checa per-node primeiro, depois scalar,
  depois YAML per-node config.
- `__tests__/model-overrides.spec.ts`: 12 tests novos (per-node win,
  scalar-only still works, both together, neither → YAML default, etc).

Engine tests: 28 pre-existentes + 12 novos = 40 verdes. TSC 0 errors.

Surpresa: `buildMap` com node enumeration pre-populada quebra quando
node name só aparece em runtime. Resolvido com `scalarFallback`
armazenado dentro do context store — `lookup()` resolve lazily.

### S13.W1.b — Hub OpenRouter proxy + pricing card (2026-04-24)

Arquivos novos (4):
- `app/api/openrouter/models/[...id]/route.ts` — GET, catch-all porque
  slug tem `/`. Auth via `getServerSession`. Cache upstream 5min via
  `fetch({ next: { revalidate: 300 } })`. 404 se slug ausente.
  Response: `{ id, name, contextLength, inputPricePer1M, outputPricePer1M,
  description }`.
- `components/modules/admin/benchmark/use-openrouter-model.ts` — SWR hook
  `useOpenRouterModel(id | null)`. `dedupingInterval: 5 * 60_000`.
  Early-exit quando id falsy (sem fetch).
- `components/modules/admin/benchmark/model-pricing-card.tsx` — card
  shadcn com 4 estados (empty/loading/error/data). Destructive border
  no 404 ("Model not found on OpenRouter").
- `__tests__/model-pricing-card.test.tsx` — 5 tests.

### S13.W1.c — Fix polling no useBenchmarkRunner (2026-04-24)

Bug preexistente: engine sempre respondeu 202 + jobId desde session 21,
mas o hook do hub fazia single-fetch e interpretava 202 JSON como
BenchmarkSnapshot (que não era). Resultado prático: benchmark UI
estava quebrada há várias sessions.

Arquivos editados (1) + 1 teste expandido:
- `use-benchmark-runner.ts` — `run()` refatorado pra enqueue + poll.
  Helpers `enqueueJob()` (POST, assert 202, extract jobId),
  `pollUntilDone()` (2s × 15 depois 5s, per CLI pattern), `sleep()`
  signal-aware. Extrai `body.result.telemetry` como o
  BenchmarkSnapshot no completed state. Timeout vira AbortError
  sintético com mensagem amigável.
- `__tests__/use-benchmark-runner.test.ts` — 5 tests (happy, failed,
  timeout, reset mid-poll, non-202 enqueue). Usa `vi.useFakeTimers`
  + `advanceTimersByTimeAsync` pra poll virtual.

Surpresa: distinguir timeout real de reset() precisou de buffer
`deadline - 100` porque fake timers caem exato no deadline do throw
path.

### S13.W2.a — Hub Presets CRUD (2026-04-24)

Arquivos novos (5):
- `lib/benchmark-schemas.ts` — zod discriminated union por `type`, 3
  payload schemas espelhando `lib/benchmark-types.ts` + `modelOverrides`
  opcional. `benchmarkPresetInputSchema` (create) e `benchmarkPresetPatchSchema`
  (update parcial).
- `app/api/benchmark/presets/route.ts` — GET (list com `?type=` filter,
  sorted updatedAt desc), POST (409 em dup unique `(name, type)`).
- `app/api/benchmark/presets/[id]/route.ts` — GET / PATCH (type imutável,
  400 se tentar) / DELETE (204, runs mantém history com presetId null).
- `app/api/benchmark/presets/__tests__/route.test.ts` — 17 tests.
- `app/api/benchmark/presets/[id]/__tests__/route.test.ts` — 13 tests.

30 tests, todos green. Real DB (`potc_test`) não mock.

### S13.W2.b — Hub Runs persistence + list API (2026-04-24)

Arquivos novos (3):
- `lib/benchmark-run-schema.ts` — zod `benchmarkRunCreateSchema` + tipo
  `BenchmarkRunCreate`.
- `app/api/benchmark/runs/route.ts` — GET (list com `?type`, `?presetId`,
  `?limit`, `?offset`. Exclui `requestBody/response` pesados, inclui
  preset preview). POST (denormaliza `totalCostUsd` etc de
  `response.telemetry.*`, guard `?? 0` se engine falhou).
- `app/api/benchmark/runs/[id]/route.ts` — GET full (inclui body +
  response + preset + evaluations ids) / DELETE 204 (cascade pra
  evaluations).
- `app/api/benchmark/runs/__tests__/route.test.ts` — 31 tests.

Surpresa: zod v4 `uuid()` enforça RFC 4122 strict (version nibble `[1-8]`,
variant `[89abAB]`) — synthetic UUIDs tipo `00...01` falham; fixtures
atualizadas pra v4 real.

### S13.W2.c — Hub Evaluate endpoint (Sonnet 4.6 judge) (2026-04-24)

Arquivos novos (3) + 1 fixture:
- `lib/benchmark-judge-schema.ts` — zod `JudgeVerdict` (5 dimensions
  com winner A/B/tie + rationale + overall + confidence).
- `app/api/benchmark/runs/[a]/evaluate/route.ts` — POST. Helpers
  particionados: `extractQaOutput / extractIdeationOutput /
  extractContentGenOutput` (normalização per type), `buildUserPrompt`
  (truncate em 28K chars), `callOpenRouter` (fetch
  `/chat/completions` com `usage: { include: true }` e
  `response_format: { type: "json_object" }`), `runJudge` (parse +
  1 retry, erro persiste como `winner: null` + `verdict.error` pra
  auditoria).
- Idempotency: `upsert` na unique `(runAId, runBId, judgeModel)`. Se
  já existe e `force !== true`, retorna cached.
- 400 se `type` dos dois runs diverge; 404 se qualquer missing; 500
  sem `OPENROUTER_API_KEY`.
- `tests/factories/benchmark.factory.ts` — helpers reutilizáveis de
  setup.
- `__tests__/route.test.ts` — 12 tests.

### S13.W2.d — Seed scenarios.yaml → presets (2026-04-24)

Arquivos novos (2) + 1 npm script:
- `scripts/seed-benchmark-presets.ts` — exports
  `seedPresetsFromParsed(parsed)`, `seedPresets(yamlPath)`, `main()`.
  `stableStringify` (recursive key-sort) pra comparar payload sem
  falso-"updated" por key order do Postgres JSON.
- `scripts/__tests__/seed-benchmark-presets.test.ts` — 3 tests (create,
  idempotent re-run, update on changed payload).
- `package.json` script `"seed:benchmarks": "tsx
  scripts/seed-benchmark-presets.ts"`.
- `yaml@^2` dep adicionada (js-yaml disponível como transitive, mas
  spec pediu a pacote direto).

Run real: `seeded 5 qa, 1 ideation, 6 content_generation — 12 new, 0
updated`. Re-run: `0 new, 0 updated` (idempotent confirmed).

Defensive: legacy bucket `build_guide:` (renamed pra `content_generation`
em engine session 23 Fase I) mapeado pra `content_generation` se
reaparecer — nada a fazer com o YAML atual.

### S13.W3.a — UI Forms: PresetBar + writer override + pricing (2026-04-24)

Arquivos novos (3) + 4 modificados:
- `use-benchmark-presets.ts` — SWR hook com `createPreset` +
  `deletePreset` mutators.
- `preset-bar.tsx` — Select + "Save as preset" dialog + "Manage"
  dialog com delete confirmation.
- `__tests__/preset-bar.test.tsx` — 6 tests. Precisou de 4 polyfills
  (`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`,
  `scrollIntoView`) pro Radix Select em jsdom.
- `qa-benchmark-form.tsx` / `ideation-benchmark-form.tsx` /
  `content-gen-benchmark-form.tsx`: `<PresetBar />` no topo, field
  `modelOverrides.write` novo (labeled "Writer model — só aplica ao
  node `write`"), `<ModelPricingCard />` embaixo de cada override,
  label do legado renamed pra "Override global". Zod schema extended
  com `modelOverrides: z.object({ write: z.string().optional()
  }).optional()`.
- `benchmark-client.tsx`: banner removido (era outdated), link pra
  history page adicionado. `persistRun()` após cada run (console.warn
  se falhar — não bloqueia result display). Toast pós-run com "Ver
  histórico" linka `/admin/benchmark/history#run-<id>`.

### S13.W3.b — UI /admin/benchmark/history (2026-04-24)

Arquivos novos (6) + 2 modificados:
- `app/(auth)/admin/benchmark/history/page.tsx` — RSC shell com
  `getServerSession`, Prisma initial fetch (10 rows), passa pra client
  island. `createdAt.toISOString()` antes de atravessar
  server/client boundary (Date não serializável).
- `components/modules/admin/benchmark/history-client.tsx` (490L) — SWR
  `keepPreviousData`, filtros (type + presetId) synced via URL params,
  table shadcn com 10 colunas, writer model resolver que lê
  `modelOverrides.write` com fallback pra `modelOverride`, row
  highlight em erro ou HTTP 4xx+5xx.
- `run-detail-sheet.tsx` — Sheet com seções collapsible pra requestBody
  + response + telemetry events.
- `compare-picker-dialog.tsx` — picker pra "Comparar com..." filtrando
  runs do mesmo `type` e excluindo o self.
- `history-types.ts` — types shared entre shell e client.
- `lib/formatters.ts` — `formatDateTimeBr` (dd/mm/yyyy HH:mm pt-BR),
  `formatCostUsd` (5 decimals), `formatDurationMs` (3m 12s).
- `app/(auth)/admin/benchmark/page.tsx`: botão "Ver Histórico" no topo.
- `components/layout/sidebar.tsx`: entry "Bench History" sob
  "Operações".
- `__tests__/history-client.test.tsx` — 10 tests.

Surpresa: `modelOverrides` é `Json` no Prisma → `Record<string, string>
| null` em runtime. Guard `resolveWriterModel` trata null.

### S13.W3.c — UI /admin/benchmark/compare (2026-04-24)

Arquivos novos (5):
- `lib/benchmark-compare.ts` — helpers puros:
  - `computeDelta(a, b)` — safe div-by-zero (null percent se a=0).
  - `aggregateByNode(events)` — Map<node, {callCount, totalCost,
    totalLatency, maxLatency}>.
  - `pairEventsByNode(aEvents, bEvents)` — greedy pair por
    node + tOffsetMs rank.
- `lib/__tests__/benchmark-compare.test.ts` — 15 unit tests.
- `app/(auth)/admin/benchmark/compare/page.tsx` — RSC shell com
  `?a=&b=` query params, 404 if either missing, 400 se type diverge,
  pre-fetch evaluation existente.
- `components/modules/admin/benchmark/compare-client.tsx` — client
  island com 4 stat cards (cost/duration/llm/qdrant Δ%), per-node table,
  per-event pair list collapsible, judge section (button → POST
  evaluate → render verdict com 5 dimension cards + overall rationale
  + confidence pill, botão "Re-run (force)").
- `compare-output.tsx` — side-by-side diff renderer. Content-gen
  detecta sections e faz collapsible por seção; qa/ideation renderiza
  flat.
- `__tests__/compare-client.test.tsx` — 13 tests (metrics delta,
  per-node table, judge click flow, error verdict, etc).

UX: sem char-by-char diff — block-level side-by-side em mono scrollable
max-h-80. Grid `grid-cols-[1fr_1px_1fr]` com dashed border divider.
Event pair list fechado por default pra não sobrecarregar.

### Wrap (2026-04-24)

- **Hub vitest**: 706 (baseline) → **826 passed** (+120).
- **Engine Jest**: 28 → **40 passed** em benchmark (+12).
- **Prisma migration** aplicada em dev + test DBs. Schema sync confirmado.
- **Deps novas**: `yaml@^2` (seed script). Sem bump de major.
- **Rotas novas**: 7 no hub (`/api/openrouter/models/:slug`,
  `/api/benchmark/presets`, `/api/benchmark/presets/:id`,
  `/api/benchmark/runs`, `/api/benchmark/runs/:id`,
  `/api/benchmark/runs/:a/evaluate`) + 1 no engine (indireto, via
  contract expansion em /api/benchmark/*).
- **Páginas novas**: 2 (`/admin/benchmark/history`, `/admin/benchmark/compare`).
- **God files >500L**: 0 (stable). `history-client.tsx` 490L está
  no limite — se crescer em Wave 4 precisa split.

**Outcome**: o operador agora consegue rodar Kimi K2.6 (ou qualquer
modelo OpenRouter) isolado no node `write` via UI, com preço ao vivo
visível antes do clique. Todo run persiste. History page lista tudo
com filtros. Compare page mostra Δ% objetivo + roda Sonnet 4.6 como
juiz com verdict em 5 dimensões. Seed inicial popula presets a partir
do `scenarios.yaml` do CLI engine, então os mesmos cenários que o
operador usa no terminal aparecem na UI com 1 clique.

## Carryover técnico

- Quando o engine emitir novos nodes no pipeline, o UI do writer override
  só cobre `write`. Se quiser override em `critique` ou `summarize`,
  adicionar campos análogos no form. Expansion point: `modelOverrides` já
  é `Record<string, string>`, backend já resolve per-node — só falta UI.
- Judge confiance calibration: Sonnet 4.6 tende a retornar `confidence:
  "medium"` mesmo quando resposta é clara. Pode valer um system prompt
  tuning futuro (fora de escopo desta session).
- Compare page não tem diff char-level — decisão de UX, se operador pedir
  depois pode usar `diff` lib.
- `scripts/seed-benchmark-presets.ts` roda contra DB `poth` por default;
  se operador tiver DB separado (staging) precisa env override.
- Pre-existing TS errors em forms (TFieldValues zod v4 generic noise)
  continuam — não introduzimos novos.
