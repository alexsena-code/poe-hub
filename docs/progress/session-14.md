# Session 14 — Bug fixes + UX polish do benchmark (pós session 13)

Data inicial: 2026-04-24.

## Contexto em 60s

Session 13 entregou a infra completa do benchmark (presets + history +
compare + LLM-as-judge), mas a primeira tentativa real de uso revelou
6 problemas — 3 bugs hard que travavam funcionalidade, 3 melhorias de
UX que faltavam pra fechar o loop. Esta session conserta tudo em
commits pequenos e independentes.

Diagnóstico foi 80% do trabalho: dois bugs (`[a]` slug, schema drift
da migration) só apareceram depois do deploy Vercel ficar ativo, e
ambos disfarçaram outras causas (504 universal, dashboard travado),
empurrando o trabalho real pra depois.

## Decisões

- **Não mexer em código pra suportar Kimi K2.6 timeout** nessa session.
  O Kimi precisa de mais de 200s pra escrever `write_pros_cons`
  (29527in+11198out tokens). Operador decidiu manter Sonnet 4.6 por
  enquanto. Quando voltar, é trocar `200_000` por `600_000` em
  `use-benchmark-runner.ts:11`.
- **Cloudflare 403 do `published-post sync`**: operador whitelistou o
  IP da VPS no Cloudflare do `pathoftrade.net` (opção 1 do triage). 0
  mudança de código.
- **AwaitingHumanBanner no layout global**: removido. Não era útil na
  maioria das rotas e adicionava ruído.
- **Engine prefix-match no `PerNodeOverrideContext`** — fix definitivo
  pro override `write` cobrir todos os `write_*` que a pipeline emite.
  Sem isso, o operador setava Kimi mas o engine usava Sonnet
  silenciosamente.

## Sanity check

```bash
git log --oneline -3                    # 21ba21e no topo
git status --short                      # 2 tour-*.png (ignorar)
npx vitest run 2>&1 | tail -3           # 826 passed baseline
```

## Plano

5 commits hub independentes + 1 engine commit:

- **S14.a** — fix(benchmark): rename evaluate route `[a]` → `[id]`
- **S14.b** — feat(benchmark): ModelCombobox + OpenRouter list
- **S14.c** — feat(benchmark): finalOutput + preset shape normalization
- **S14.d** — feat(benchmark): pobUrl + skill/ascendancy opcionais
- **S14.e** — chore(layout): remove AwaitingHumanBanner
- **S14.engine** — fix(benchmark): prefix-match per-node overrides

## Changelog

### S14.a — Fix [a] vs [id] slug conflict (commit 3189d89, 2026-04-24)

Bug crítico: Next.js App Router proíbe dois slug names diferentes no
mesmo nível de path (`runs/[id]/route.ts` + `runs/[a]/evaluate/`). O
agent que criou o evaluate endpoint na S13 escolheu `[a]` pra
representar "run A" — visualmente claro, route-tree-illegal. Erro
("You cannot use different slug names for the same dynamic path") é
lançado no build da rota e poisons o router inteiro: TODA Function
Vercel passa a 504 (`/dashboard`, `/api/auth/session`,
`/api/benchmark/presets`, etc).

Diagnóstico inicialmente foi pra schema drift (queries DB travadas)
e Cloudflare bloqueio — só os logs Vercel expandidos mostraram o erro
real. ~30 min perdidos investigando a hipótese errada antes do log
revelar.

Fix: `runs/[a]/evaluate/` → `runs/[id]/evaluate/`. Lê `params.id` em
vez de `params.a`. URL pública continua `/api/benchmark/runs/<id>/evaluate?b=<id>`
— `compare-client.tsx` não muda. 12 tests do evaluate green.

Lição registrada: prefer slug names únicos por subtree. Se precisar
parear runs, usa query param (`?b=...`) e não segmento dinâmico.

### S14.b — ModelCombobox + OpenRouter list (commit 819303b, 2026-04-24)

Os campos `Override global` e `Writer model` eram `<Input>` text livre
— operador tinha que conhecer o slug exato (ex: `moonshotai/kimi-k2.6`)
e digitar sem typo. Inadequado pra A/B comparativo onde o ponto é
explorar modelos.

Trocados por combobox autocomplete:
- Nova rota `GET /api/openrouter/models` (lista completa) — proxy do
  `https://openrouter.ai/api/v1/models`, simplifica pra `{ id, name,
  contextLength, inputPricePer1M, outputPricePer1M }`, ordem
  alfabética, cache 1h server-side.
- `useOpenRouterModels()` SWR com 1h dedupe.
- `<ModelCombobox>` (Radix Popover + cmdk Command) com filtro
  substring, ctx + pricing inline em cada linha, clear button, e
  escape hatch "usar slug como está" pra modelos que ainda não
  apareceram no cache.
- Forms qa/ideation/content-gen: ambos `modelOverride` e
  `modelOverrides.write` substituídos por ModelCombobox. Zod schema
  intacto (string), sem impacto no contrato server.
- Shadcn `command` primitive instalado (`components/ui/command.tsx`).

Tests: 10 novos (placeholder, selected label, catalog fallback,
filter, click-to-select, custom-id path, clear, loading, error).
Precisou de polyfill `ResizeObserver` pro Radix Popover em jsdom.

### S14.c — finalOutput + preset shape (commit 45dcdab, 2026-04-24)

Dois bugs no mesmo commit por estarem na mesma área:

**1. Output final descartado** — engine retorna
`{ result, telemetry }` no job result. O hook
`useBenchmarkRunner` extraía só `telemetry` (trace) e jogava fora
`result` (a resposta real). Operador só conseguia ver a saída
expandindo o último LLM event manualmente, e mesmo assim vinha como
response crua, não como output estruturado por seções (no caso de
content-gen).

Fix: `BenchmarkSnapshot` ganha `finalOutput?: unknown` (hub-only,
documentado). Hook stuffs `status.result?.result` ali. `BenchmarkResultPanel`
ganha card "Resposta final" no topo com rendering shape-aware:
- string → bloco de prosa (QA)
- array → lista de items (ideation)
- object com seções → blocos rotulados (content-gen — `tldr`,
  `main_skill`, `pros_cons`, etc)
- fallback: `JSON.stringify` formatado

**2. Presets seeded não preenchiam forms** — `psql` confirmou que
presets do `scenarios.yaml` têm shape **nested** (`briefing.skill`,
`briefing.ascendancy`, `templateFilter: string[]`). Mas os forms
content-gen e ideation usam shape **flat**
(`skill`, `ascendancy`, `templateFilterRaw: string`). `form.reset(payload)`
não mapeava → tudo vazio com erro "Skill obrigatória" no Content Gen.

Fix: `handleLoad` em ambos os forms normaliza os 2 shapes —
`p.briefing.skill ?? p.skill ?? ""`, idem pros outros campos. QA
já era flat, não precisou. PresetBar continua salvando no shape do
form, então re-save vira flat (compatível com handleLoad pelo
fallback `?? p.skill`).

### S14.d — pobUrl + skill/ascendancy opcionais (commit 9009acc, 2026-04-24)

O preset seeded `build_guide.rf_chieftain` tem `briefing.pobUrl =
https://pobb.in/Sit6hlQU1uuZ` mas o form não tinha campo pra editar
ou visualizar isso. E os outros 5 presets (`currency_guide`,
`mechanic_guide`, `faq`, `quick_explainer`, `beginner_guide`) não
precisam de skill/ascendancy — mas o zod marcava ambos como `min(2)`
required, bloqueando o submit.

Mudanças no `content-gen-benchmark-form.tsx`:
- `skill` + `ascendancy` viram `.optional()`. Labels mudam pra
  "Skill (build_guide only)" / "Ascendancy (build_guide only)" pra
  comunicar quando importam. Engine valida server-side per-template.
- Novo campo `pobUrl` — full-width input embaixo do Template, com
  description "Link pobb.in pro engine enriquecer gear/skills".
- Schema + handleLoad + handleSubmit também aceitam `language`,
  `mode`, `injectSectionHeadings` invisíveis (passthrough) — presets
  preservam esses valores na re-save mesmo sem UI dedicado.
- `ContentGenBenchmarkRequest.briefing` em `lib/benchmark-types.ts`
  expandido com os 4 campos opcionais.

### S14.e — Remove AwaitingHumanBanner (commit 7557e19, 2026-04-24)

Banner global "N seções aguardam seu input em M posts" no
`app/(auth)/layout.tsx` — visível em TODA página auth (dashboard,
benchmark, admin, …) mas só relevante no workspace. Pollui rotas não
relacionadas. Removido do layout. Componente preservado em
`components/engine/AwaitingHumanBanner.tsx` pra ressuscitar inline
em alguma página específica se voltar a precisar.

### S14.engine — Prefix-match per-node overrides (engine commit 5dfd45c, 2026-04-24)

Bug confirmado pelo operador rodando o A/B Sonnet vs Kimi: o engine
ignorava `{ modelOverrides: { write: "moonshotai/kimi-k2.6" } }` e
continuava usando Sonnet em todos os write_* nodes. Causa:
`PerNodeOverrideContext.lookup("write_main_skill")` fazia exact-match
no map → não achava → caía no YAML default (`anthropic/claude-sonnet-4.6`).
A pipeline emite `write_tldr`, `write_pros_cons`, `write_main_skill`,
`write_passive_tree`, `write_gear`, `write_budget_progression` —
nenhum com a chave literal `write`.

Fix: `lookup(nodeName)` agora:
1. Exact match primeiro.
2. Walk underscore-delimited prefixes longest → shortest. `write_main_skill`
   tenta `write_main` depois `write`.
3. Scalar fallback.
4. YAML.

Prefix split é só por `_`, não substring arbitrário (`writ` NÃO
match `write`). Exact key sempre vence prefix; longer prefix vence
shorter.

Tests engine: 12 → **17 passed** (+5 novos covering write_*
coverage, exact beats prefix, longer prefix beats shorter, partial
substring rejection, scalar fallback fires when no prefix hits).

Validação operacional pelos logs do tmux pós-deploy:
```
[write_tldr] Using moonshotai/kimi-k2.6
[write_pros_cons] moonshotai/kimi-k2.6 — 29527in+11198out=$0.07284, 200136ms
```

Override está chegando no node. Próximo carryover é o timeout (abaixo).

### Wrap (2026-04-24)

- **Hub vitest**: 826 (baseline S13) → **836 passed** (+10 model-combobox tests).
  0 failed, 1 skipped (smoke Sanity).
- **Engine Jest**: 12 → **17 passed** em benchmark module override (+5).
- **TS errors novos**: 0 nos paths tocados.
- **Deploys triggerados**: 5 Vercel auto + 1 VPS via deploy.yml.
- **Carryover técnico zerado pra essa área** — exceto timeout (abaixo).

**Outcome**: o benchmark UI agora é usável end-to-end — operador
seleciona modelo via combobox autocomplete com pricing live, presets
preenchem os forms (incluindo PoB URL pros build_guide), output final
aparece formatado por seção, e o engine respeita o override per-node
mesmo com sufixos. Próxima sessão de benchmark é só usar.

## Carryover técnico

- **Timeout do Kimi K2.6 estoura 200s**: confirmado nos logs —
  `write_pros_cons` levou 200_136ms exatamente, hub abortou em
  `TIMEOUT_MS["content-generation"] = 200_000`. Pra rodar Kimi
  end-to-end precisa subir pra 600_000ms (`use-benchmark-runner.ts:11`).
  Operador decidiu adiar e manter Sonnet 4.6 por enquanto.
- **Recuperar runs com timeout**: o BullMQ continua processando após
  o hub abortar. Resultado fica no Redis (`bull:benchmark:<id>`) +
  pode ser puxado via `GET /api/benchmark/jobs/<id>`. Sem mecanismo
  hub-side pra "claimar" um job órfão e persistir como `BenchmarkRun`.
  Nice-to-have futuro: botão "Recuperar último job" no `/admin/benchmark`.
- **Cloudflare 403 published-post**: operador whitelistou IP, validar
  no próximo cron 04:00 UTC.
