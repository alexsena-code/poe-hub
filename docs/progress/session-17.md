# Session 17 — Operations control center + Reddit "Trending Keywords"

Tema: dois ajustes de UI guiados pela sessão 36 do engine
(`path-of-trade-content`):

1. **Reddit Dashboard** — aba "Trending Topics" (que mostrava cluster de
   frases extraído dos títulos no cliente) virou "Trending Keywords",
   consumindo `KeywordOpportunity` source=reddit do engine. Agora reflete
   o que o `RedditKeywordExtractorService` (engine) realmente persistiu,
   já filtrado pelo gate LLM universal.

2. **Operations control center** (`/admin/operations`) — página única
   pra disparar todos os crawls/pipelines/jobs do engine, com live
   status pra os que expõem `statusEndpoint` (Reddit/Ninja/KeyBERT) e
   tabela de Recent Pipeline Runs alimentada por `/seo/cron/runs`
   (auto-refresh 5s).

## Reddit "Trending Keywords"

- `components/modules/seo/reddit/trending-keywords-tab.tsx` (novo) faz
  fetch em `/api/engine/seo/keywords?source=reddit&withSignals=true` e
  renderiza tabela com Keyword/Intent/Cluster/Game + 4 sinais editoriais.
- `trending-topics-tab.tsx` deletado.
- `helpers.ts`: `computeTrendingPhrases` + `groupPostsByFlair` removidos
  (eram usados só pelo tab antigo).
- `types.ts`: tab key `'trending-topics'` → `'trending-keywords'` +
  label "Trending Keywords".

## Operations control center

11 actions definidas em `types.ts`, agrupadas em 3 categorias:

- **Crawls**: Reddit scan, Google Trends fetch, poe.ninja validation,
  KeyBERT remote worker.
- **Pipelines**: Full SEO pipeline, Daily cron (manual), Take keyword
  snapshot, LLM research validation.
- **Maintenance**: Bulk classify, Bulk cleanup, Dedup keywords, Volume
  enrichment.

`use-operations.ts` é o hook central — guarda estado por action
(running/lastError/lastResult/status), faz polling de 2s no
`statusEndpoint` quando a action expõe um (Reddit/Ninja/KeyBERT) e
mantém Recent Runs atualizado a cada 5s.

`action-card.tsx` renderiza um tile por action com botão Run, progress
bar (quando há status estruturado), tail dos últimos 4 logs e toast
de resultado/erro.

`recent-runs.tsx` lista as últimas 20 entradas de `pipeline_runs` com
expand-to-JSON pra ver `result`/`error` completos.

## Arquivos

**Novos:**
- `app/(auth)/admin/operations/page.tsx`
- `components/modules/admin/operations/types.ts`
- `components/modules/admin/operations/use-operations.ts`
- `components/modules/admin/operations/action-card.tsx`
- `components/modules/admin/operations/recent-runs.tsx`
- `components/modules/seo/reddit/trending-keywords-tab.tsx`

**Modificados:**
- `app/(auth)/seo/reddit/page.tsx` (import + render do novo tab)
- `components/modules/seo/reddit/types.ts` (rename tab)
- `components/modules/seo/reddit/helpers.ts` (helpers mortos removidos)
- `components/layout/sidebar.tsx` (entrada "Operations" sob Admin →
  Operacoes)

**Removidos:**
- `components/modules/seo/reddit/trending-topics-tab.tsx`

## Validação

- `npx tsc --noEmit` → zero erros nos arquivos novos. Erros pré-
  existentes em `farm/simulations`, `editor/serializer`, etc. não são
  afetados.

## Débitos abertos

- Próximas actions a adicionar no Operations: drain de transcript
  pendings, reset de `failed_permanent`, deploy trigger (quando o
  endpoint correspondente existir no engine).
- Considerar log streaming unificado no engine (tabela `OperationLog`
  + endpoint `GET /ops/logs?since=`) pra cobrir as actions que hoje
  não expõem `statusEndpoint`.
