## Session 16 — /seo bug fixes (competitor gaps, auto-actions bulk, research signal gate)

Data: 2026-04-25.

## Tema

Triagem e correção de 3 bugs do módulo `/seo` que tornavam o surface
inutilizável: `/admin/competitor-gaps` sempre vazio, `/admin/auto-actions`
sem multi-select / detail / bulk-reject, `/seo/research` mostrando
"No keywords yet" mesmo com 995 cadastradas.

Cruzou os dois repos (poe-hub + path-of-trade-content). Engine ganhou 4
endpoints novos; hub ganhou 3 surfaces refinadas + 4 components novos.

## Decisões

- **`/seo/keywords` ganhou `?withoutSignals=true`**: o gate hasSignal
  (impressions/trendingScore/youtubeViews/ninjaPopularity/serpCompetition
  OR) era a causa-raiz da divergência entre `/seo/dashboard.totalKeywords`
  (995, conta non-rejected) e `/seo/keywords` (0, exigia sinal). Default do
  hub agora liga `withoutSignals=true` para o operador ver o que importou,
  toggle desliga pra inspecionar só sinal-bearing.
- **Banner amarelo de discrepância** em `KeywordsTab` quando dashboard
  total > list count com flag desligada — torna visível o que era um
  silent empty state.
- **`auto_action_log` ganhou bulk endpoint**: `POST /seo/auto-actions/
  bulk-decide` (logIds[] + decision) reusa `reviewPending()` linha-a-linha,
  preserva side effects (registrar competitor on `applied`) e devolve
  `{succeeded, failed, errors[]}`. Per-row failure não aborta o batch.
- **`POST /seo/auto-actions/reject-all-pending`** drena o queue inteiro
  com 1 update, opcional `actionType` filtra por categoria. UI tem
  AlertDialog com count antes de disparar.
- **Detail Sheet > inline expand**: pending review row clicada abre Sheet
  shadcn à direita com metadata JSON pretty-printed + descrição humana
  do actionType (`action-type-glossary.ts`). Botões individuais Approve/
  Reject por linha continuam pra fluxo rápido.
- **`/admin/competitor-gaps` ganha PipelineStatusBar**: contadores
  granulares (`competitors / crawled / enriched / embedded`) com tile
  amarelo quando há gap entre etapas. 4 botões inline (Crawl, Enrich,
  Embed, Full pipeline) tornam o problema "competitors crawled mas não
  enriched" auto-resolvível pelo operador.
- **Engine ganha `runFullPipeline`**: encadeia
  `sitemap.crawl → pageEnricher.enrich → pageEmbedder.embed` em
  sequência fire-and-forget. Sem ele, o operador tinha que rodar 3 POSTs
  manuais e adivinhar quando cada um terminou.
- **`title: { not: null }` é o proxy de "enriched"** — schema
  `CompetitorContent` não tem `enrichedAt`. O enricher escreve title +
  h2H3 + keywords no mesmo update, então title não-null é sinal seguro.

## Changelog

### path-of-trade-content (engine)

1. **Auto-actions bulk endpoints** —
   `services/searxng-auto-actions.service.ts` ganhou `bulkReviewPending()`
   e `rejectAllPending()`. Controller expõe `POST /seo/auto-actions/
   bulk-decide` e `POST /seo/auto-actions/reject-all-pending`. Validation:
   `npx tsc --noEmit` clean.

2. **Keyword research signal gate relaxável** —
   `services/keyword-analyzer.service.ts` `buildKeywordWhere` aceita
   `withoutSignals: boolean` que skipa o OR. `getTopOpportunities` e
   `countKeywords` propagam. Controller expõe `?withoutSignals=true` em
   `GET /seo/keywords` e `/seo/keywords/count`.

3. **Competitor pipeline orchestration** —
   `services/competitor.service.ts` agora guarda prisma readonly e expõe
   `getPipelineStats()` (4 contadores) + `runFullPipeline()`. Controller
   ganha `GET /seo/competitors/pipeline-stats` e `POST /seo/competitors/
   full-pipeline`.

### poe-hub

1. **Auto-actions UI rework** —
   `components/admin/observability/auto-actions-pending-review.tsx`
   refatorado: checkbox header + per-row, action bar com Approve/Reject
   N selected + Reject all pending (AlertDialog). Cada row click abre
   `auto-actions-detail-sheet.tsx` (novo) com metadata JSON +
   `action-type-glossary.ts` (novo) descrevendo cada actionType. Server
   actions `bulkDecideAction` + `rejectAllPendingAction` em
   `app/(auth)/admin/auto-actions/actions.ts`.

2. **Research signal toggle** —
   `components/modules/seo/research/use-research-state.ts` ganhou
   `showWithoutSignals` (default true) + `keywordsError` (substitui o
   `catch {}` mudo). `keywords-tab.tsx` mostra banner rosa quando engine
   erra + banner amarelo quando há discrepância. `seo/research/page.tsx`
   adicionou checkbox toggle + propaga props.

3. **Competitor gaps status bar** —
   `components/admin/competitor-gaps/pipeline-status-bar.tsx` (novo)
   renderiza 4 contadores com warning visual + 4 botões para enrich/
   embed/crawl/full-pipeline (toast feedback via sonner). `page.tsx`
   roda `Promise.allSettled` para gaps + stats em paralelo. Server
   actions em `actions.ts`: `runEnrichAction`, `runEmbedAction`,
   `runFullPipelineAction`, `runCrawlAction`.

## Validation

- `npx tsc --noEmit` no engine: 0 erros nas alterações.
- `npx tsc --noEmit` no poe-hub: 29 erros (mesmos pré-existentes; 3 em
  `KeywordDetailPanel` antigo do `keywords-tab.tsx` com `as` casts não
  tocados).
- Manual smoke pendente: subir engine + hub e validar os 3 surfaces.

## O que ainda falta

- Testes de integração no engine pros 4 endpoints novos.
- Atualizar `auto-actions.controller.spec.ts` com casos bulk.
- Considerar paginar `/admin/auto-actions` quando a tabela "Recent" passa
  de 50 (hoje a UI faz `slice(0, 50)`).
