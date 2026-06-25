# Auditoria completa da coleta de dados — engine `path-of-trade-content` (2026-06)

> Auditoria fonte-por-fonte dos coletores do engine, na mesma lente da
> seção 1 (YouTube) de `data-collection-refinement.md`. **Escopo:** Reddit,
> Concorrentes (SearxNG/SERP), GSC, Google Trends, poe.ninja, Wiki/PoEDB.
> Nada citado aqui vem de `.claude/worktrees/` — só caminhos reais sob
> `packages/`.

## Lente (modelo-alvo)

O engine vira **provedor de dados** (warehouse); a geração de posts migra
para uma skill do Claude. Decisões transversais que valem para toda a
análise abaixo:

- **Recuperação híbrida.** Qdrant/RAG fica para consumo de **alto volume**
  e sensível a custo (página de Q&A pública + extensão). A skill do Claude
  **não embeda** — lê o dado **bruto** direto no contexto longo do Opus.
  Logo o bruto deve ser **fonte de verdade em TABELA Postgres**; o Qdrant
  vira **índice derivado** dela.
- **Enriquecimento LLM.** Separar "dado de warehouse" (keywords SEO, slang,
  sinais) — que fica — de "metadado só para geração" — que a skill faz
  on-demand. Onde há classificação por LLM no cron, avaliar se vira
  heurística/regex barata.
- **Custo.** Alto volume + tarefa simples → modelo barato; baixo volume +
  qualidade → contexto longo. O operador avalia trocar **Gemini 2.5 Flash
  por DeepSeek via OpenRouter** nas classificações. (Nota factual: **todo**
  o tráfego LLM do engine já passa por OpenRouter via `LlmService` —
  `packages/api/src/modules/llm/llm.service.ts`; o "Gemini free tier de 20
  req/dia" da memória do projeto **não se aplica aos coletores** auditados,
  que usam `google/gemini-2.5-flash`/`-flash-lite` pagos por token via
  OpenRouter. A troca para DeepSeek é só mudar o slug do modelo em
  `packages/api/src/modules/llm/models.ts` e/ou no roteamento por-node em
  `config/prompt_templates.yaml` — nenhum serviço de coleta hardcoda o
  modelo.)

---

## 1. Reddit

### Como coleta
Existem **dois coletores paralelos para o mesmo dado**:

- **Crawler Python** (`packages/crawlers/sources/reddit/` — `base.py`,
  `crawl.py`, `fetcher.py`, `parallel_fetcher.py`, `parse.py`). Usa o
  **JSON público oficial** do Reddit (`reddit.com/r/<sub>/<sort>.json`).
  Sem PRAW, sem Pushshift. **Proxies obrigatórios** (`fetcher.py`:
  filtra proxies `:50100`, valida cada um e **desliga requisição direta**
  — "server IP gets 403'd by Reddit"). Rate limit base
  `REDDIT_RATE_LIMIT=2.0s` (`config.py`) + backoff em 429/403/5xx; cap de
  4 workers (`parallel_fetcher.py`). Subreddits: `["pathofexile",
  "pathofexilebuilds", "PathOfExile2"]`. Custo de API zero (custo = proxies
  + tempo).
- **Crawler NestJS nativo** (`reddit-monitor.service.ts` → `runCrawl`).
  `fetch` direto a `r/<sub>/top.json` **sem proxy**, UA fixo de Chrome,
  1 req/s. **Frágil em prod**: sai do IP do servidor → 403 esperado. É o
  fallback do modo `auto` do controller.

### O que armazena
Models Prisma (`packages/api/prisma/schema.prisma:571-626`):

- `RedditScan` (`reddit_scans`): `id Int` (autoincrement, **não UUID**),
  `subreddits String[]`, `postsFound`, `newPosts`, `durationMs?`,
  `createdAt`. **Sem `updatedAt`.**
- `RedditPost` (`reddit_posts`): `postId @unique`, `title`, **`selftext`**,
  `score`, `numComments`, `flair?`, `author?`, `subreddit`, `permalink`,
  `url?`, `createdUtc`, `upvoteRatio?`, **`pobLinks String[]`**, `category?`,
  `scanId?`. Índices em `subreddit`, `score`, `createdUtc`.
- `RedditComment` (`reddit_comments`): `commentId @unique`, **`body`**,
  `score`, `author?`, `createdUtc`, `postId` (Cascade).

**O texto bruto FICA no Postgres** — `selftext` e `body` são colunas reais
(ao contrário do YouTube, onde o transcript é descartado). Porém o caminho
NestJS **trunca em 2000 chars** (`reddit-monitor.service.ts:113,241`). O
Qdrant (`poe_reddit`, 1024-dim) é índice derivado, alimentado por **duas
implementações divergentes de chunking** (Python `format_post_text` +
`reddit-ingest.service.ts`/`chunkPost`), com IDs e formatos diferentes na
mesma collection. Há ainda um **JSON intermediário em disco**
(`reddit_posts_top_month.json`) que vira source-of-truth de fato para o
keyword scan e o auto-seed (`reddit-scan-post-loader.service.ts`,
`reddit-db.service.ts:seedFromJson`).

### Cron/cadência
- **`reddit-monitor.service.ts:27` — PAUSADO** (`// PAUSED @Cron('0 */4 * *
  *')`). O scan automático de 4h **não dispara**.
- **Roda hoje:** (a) `daily-cron.service.ts` **`@Cron('0 0,6,12,18 * * *')`**
  dispara um `reddit_crawl` (passo do pipeline), e o pipeline diário
  **`@Cron('0 6 * * *')`** inclui reddit como passo 1; (b) manual via
  `reddit.controller.ts`: `POST /seo/reddit/crawl` (modo `auto`: Python
  fetch-only → `seedFromJson` → embed; fallback NestJS), `POST
  /seo/scan/reddit` (extração de keywords).

### Lacunas concretas
1. **Extração de keywords via LLM no pipeline.**
   `reddit-scan-llm-extractor.service.ts` chama `llm.call('keyword-cleaner')`
   → `google/gemini-2.5-flash-lite` via OpenRouter (`config/
   prompt_templates.yaml`), com custo real gravado (`RedditScanResult.llmCost`).
   Só processa **títulos** — o `selftext` rico que está no Postgres é
   ignorado.
2. **Regex e LLM não se enriquecem — é fallback exclusivo.** `regexOnly` →
   só regex (custo 0); senão LLM em batches de 60. O regex
   (`reddit-scan-regex-extractor.service.ts`) só entra quando o LLM lança
   exceção ou devolve não-JSON (e nesse caso o custo já foi pago). Depois
   `reddit-scan-merger.ts` deduplica.
3. **Raw triplicado e divergente** — JSON em disco + Postgres + Qdrant, com
   dois chunkers distintos. O `deterministicId` do TS
   (`reddit-ingest.service.ts:282`) é hash de 32-bit virando pseudo-UUID →
   **risco de colisão** em volume.
4. **Sem histórico / sem `updatedAt`.** `RedditPost.upsert` no re-crawl só
   atualiza `score`/`numComments`/`upvoteRatio` — nunca re-grava `selftext`
   (texto congelado). PKs `Int autoincrement` e ausência de `updatedAt`
   violam o padrão do projeto.
5. **Dois coletores, uma fonte** — parse, classificação e extração de PoB
   links duplicados em Python e TS; o NestJS é frágil sem proxy.
6. **Acoplamento a arquivo em disco** — keyword scan depende fisicamente do
   nome do JSON; mudar `--sort/--time` faz ler dados velhos.

### Refino recomendado
- **Postgres como única fonte de verdade; eliminar o JSON intermediário.** O
  Python escreve direto na tabela (ou via 1 endpoint de ingest). Guardar
  `selftext`/`body` **completos** (remover os `.slice(0,2000)`) — é o que a
  skill lê em contexto longo.
- **Mover a extração de keywords por LLM para on-demand.** A tabela já tem
  `score`, `flair`, `category`, `pobLinks`, `title`; regex + heurística
  cobrem a coleta. Reservar o LLM para um endpoint de refino manual → zera o
  custo recorrente OpenRouter do coletor.
- **Se mantiver LLM, trocar Gemini Flash-Lite por DeepSeek** (só editar o
  node `keyword-cleaner` em `config/prompt_templates.yaml`); validar que o
  DeepSeek respeita "responda só JSON".
- **Unificar o chunking do Qdrant numa só implementação** e usar UUIDv5
  estável; Qdrant passa a ser reconstruível a partir do Postgres.
- **Aposentar o coletor B (NestJS `runCrawl`)** ou rebaixá-lo; deixar o
  Python com proxies como único coletor.

---

## 2. Concorrentes (SearxNG / SERP / competitor analysis)

### Como coleta
- **SearxNG self-hosted está MORTO no caminho de produção.**
  `searxng-client.service.ts` (URL `SEARXNG_URL ?? localhost:8081`) virou só
  diagnóstico. `brave-search-client.service.ts:34-42` explica: a instância
  self-hosted **bania os engines upstream sob carga** ("251 engines × 700
  keywords cascade-banned"). Tanto `serp-analyzer.service.ts` quanto
  `searxng-auto-actions.service.ts` agora chamam **Brave**.
- **Brave Search API** é a fonte real de URLs top-N.
  `brave-search-client.service.ts` →
  `api.search.brave.com/res/v1/web/search`, header
  `X-Subscription-Token: BRAVE_SEARCH_API_KEY`. **Free tier 2k/mês; pago $5
  = 20k/mês.** O próprio comentário diz steady-state ~3k/mês → "paid is
  mandatory". Degrada em silêncio: chave inválida/429 →
  `ServiceUnavailableException` engolida, retornando `[]`.
- **Scraping de página** (`serp-scraper.service.ts`): `fetch` direto +
  regex (sem cheerio/JSDOM), `mainText` cortado em **20.000 chars**,
  concorrência 3. **Não respeita robots.txt** aqui (só o sitemap respeita).
  Quebra em SPAs JS.
- **Sitemap crawl** (`competitor-sitemap.service.ts`): robots.txt →
  sitemap → recursivo até depth 2, 500ms entre fetches, respeita
  `robots-parser`.
- **SerpAPI paralelo** (`competitor-analyzer.service.ts`):
  `serpapi.com/search` (`SERPAPI_KEY`, **250/mês free**), com on-page
  analysis efêmero (não persiste). → São **três** provedores de busca no
  código: SearxNG (morto), Brave (ativo), SerpAPI (paralelo).
- **Proxy rotation existe mas é só para YouTube** (`proxy-rotator.service.ts`).
  Brave/scraper/enricher/sitemap fazem `fetch` direto, sem proxy.

### O que armazena
Models (`schema.prisma`):

- `CompetitorContent` (`competitor_content`, l.525): `domain`, `url @unique`,
  `title?`, `slug?`, `category?`, `keywords String[]`, `h2H3 String[]`,
  `isPoeRelated?`, `embeddedAt?`, `lastCrawledAt`, `pageUpdatedAt`,
  `longevity?`, `createdAt`. **CRÍTICO: não armazena o texto/HTML da página.**
  Só `title` + `h2H3` (≤20 headings) + n-grams do slug. O embedding no
  Qdrant (`competitor_pages`) também é só `title\n+h2H3` — **o corpo da
  página nunca é capturado, nem no Postgres nem no Qdrant**.
- `SerpAnalysis` (`serp_analyses`, l.756): `keyword`, `locale`, `game`,
  `capturedAt`, `topUrls Json`, `headingTree Json?`, `entities String[]`,
  `qdrantCentroidId String?`, `serpFeatures Json?`, `scrapeStats Json?`. O
  `mainText` scraped (até 20k/página) é **embedado num centroid**
  (`serp-centroid.service.ts`, `poe_serp_centroids`) e **descartado** — só
  o ponteiro `qdrantCentroidId` fica.
- `Competitor` (`competitors`, l.1180): `domain @unique`, `sitemapUrl?`,
  `pathFilter @default(".+")`, `categories Json`, `source` (yaml/auto_discover),
  `isActive`, `addedBy?`, timestamps.
- `AutoActionLog` (`auto_action_logs`, l.1207): `actionType`, `decision`,
  `targetType?`, `targetId?`, `reason?`, `metadata Json?`, `createdAt`.

### Cron/cadência
- `searxng-daily-auto-actions.cron.ts` **`@Cron('0 7 * * *')`** (07:00 UTC):
  blacklist(30) → cross-source(3) → archive(30d) → discover(20) → enrich(100)
  → embed(100). Limites reduzidos na "Session 37" para caber no free tier do
  Brave.
- `daily-cron.service.ts` cobre transcripts/reddit/youtube/trends/keywords —
  **não inclui competitor/SERP** (esses rodam às 07:00 no cron acima).
- **Não há cron para `SerpAnalyzerService.analyze`** (scrape + entity +
  centroid completos) — só sob demanda.

### Lacunas concretas
1. **Texto da página é efêmero e só vira embedding.** Para competidores nem
   o full text é capturado (só title+h2h3); para SERP o `mainText` é
   embedado e jogado fora. **Não há fonte-de-verdade do bruto no Postgres**
   — re-análise exige re-scrape (reconsome quota Brave + re-fetch).
2. **LLM no pipeline.** `serp-entity-extractor.service.ts` (`llm.call
   ('ideation')` por keyword), `competitor-gap-analyzer.service.ts`
   (`prioritizeGapsWithLlm`, maxTokens **3000** — o mais caro),
   `competitor-page-enricher.service.ts` (`classifyLongevity`, **1 call LLM
   por página**), `competitor-sitemap.service.ts` (`suggestPathFilter` +
   `classifyAmbiguousBatch`). Tudo OpenRouter/Gemini.
3. **Dependência de APIs pagas frágeis** — Brave (pago obrigatório) +
   SerpAPI (paralelo). SearxNG grátis foi abandonado. Falha de chave degrada
   em silêncio.
4. **Sem histórico de posições SERP.** `SerpAnalysis.topUrls` é só snapshot;
   `competitor-analyzer` calcula `ourPosition` mas **não persiste**. Não dá
   pra plotar evolução de ranking.
5. **`engineAgreement` é métrica morta** com Brave (engine única).
6. **Sem proxy no SERP** — crawl a partir de um IP é bloqueável; scraper
   regex puro quebra em SPA.

### Refino recomendado
- **Persistir o texto bruto no Postgres.** Adicionar `rawText`/`rawHtml` +
  `fetchedAt` em `CompetitorContent` e gravar o `mainText` que
  `serp-scraper.service.ts` já extrai e o body que
  `competitor-page-enricher.service.ts:fetchPageContent` já baixa **e
  descarta**. Custo quase zero, elimina re-scrape e dá insumo pra skill.
- **Qdrant como índice derivado** (`poe_serp_centroids`, `competitor_pages`)
  — reembedável a partir do raw, sem re-crawl.
- **Mover LLM para on-demand / heurística barata.** `classifyLongevity`
  (1 LLM/página, maior desperdício diário) → regex de versão de patch +
  `pageUpdatedAt` do sitemap (`competitor-freshness.ts` já tem a infra);
  `prioritizeGapsWithLlm` e entity extraction → disparar quando a skill
  pede, lendo o raw persistido.
- **DeepSeek via OpenRouter** — troca centralizada em `llm/models.ts` /
  `config/prompt_templates.yaml`, não toca os 7 serviços.
- **Consolidar provedores** (SearxNG morto / Brave / SerpAPI) num só. Reviver
  SearxNG com rate-limit por engine + ProxyRotator removeria a dependência
  paga do Brave para o scrape.

---

## 3. GSC (Google Search Console)

> **Correção factual:** a premissa "GSC pausado por falta de OAuth" está
> **desatualizada**. O OAuth foi concluído na Session 21 e está ativo hoje.

### Como coleta
`gsc.service.ts` usa a **Search Console API v1** via `googleapis` (OAuth2,
escopo `webmasters.readonly`). `syncData(days=28)` pagina
`searchanalytics.query` (dimensão `query`, `rowLimit=5000`, 500ms entre
páginas) e passa as linhas para `importGscData`. Site:
`GSC_SITE_URL=sc-domain:pathoftrade.net`. **Custo zero** (API gratuita do
Google), rate limit folgado.

**Estado real do OAuth (verificado no `.env`):** `GSC_CLIENT_ID` (71 chars),
`GSC_CLIENT_SECRET`, `GSC_SITE_URL` e **`GSC_REFRESH_TOKEN` (103 chars, token
Google real)** estão **todos setados**. O serviço fica `configured=true` →
o cron roda. O docstring (`gsc.service.ts:220-226`) confirma: ativado na
Session 21, "refresh token valid, consent screen published".

### O que armazena
GSC **não tem tabela própria** — `gsc-import.service.ts:importGscData` faz
**upsert em `KeywordOpportunity`** (`schema.prisma:431`) com `source='gsc'`:
campos `impressions`, `clicks`, `position`, `ctr`, `wordCount`, `intent`,
`cluster`, `game`, `isLongTail`, `lastSeenAt`. Cada run também grava um
`KeywordScan` (`scanType='gsc_striking'`) com `metadata.rejectedDetails`.
**O scoring VICE foi removido (Session 26B)** — só as métricas brutas GSC
são persistidas; striking/difficulty são derivados depois.

### Cron/cadência
`gsc.service.ts:227` — **`@Cron('0 7 * * 1')` ATIVO** (segunda 07:00 UTC).
Puxa 28 dias, importa em `KeywordOpportunity`. O docstring nota que o cron
**também mantém o refresh token vivo** (Google invalida tokens parados 6+
meses). Trigger manual: `POST /seo/gsc/sync`. Setup OAuth:
`GET /seo/gsc/auth-url` → `GET /seo/gsc/callback?code=...`
(`gsc.controller.ts`).

### Lacunas concretas
1. **Sem histórico / sem série temporal.** O upsert sobrescreve
   `impressions/clicks/position/ctr` da keyword a cada semana — **não há
   snapshot datado** (ao contrário de `GoogleTrendSnapshot` ou
   `NinjaSnapshot`). Impossível plotar "minha posição na query X ao longo do
   tempo" — exatamente o dado de maior valor do GSC. Só sobra `lastSeenAt`.
2. **Só dimensão `query`.** Não puxa `page` nem `query×page`, que diria
   *qual URL minha* rankeia para a query (insumo direto pra otimização de
   página). Sem `date` por linha tampouco.
3. **Filtro LLM opcional no caminho** (`KeywordLlmFilterService`, gate
   `ENABLE_KEYWORD_LLM_FILTER`, batch de 20 via Gemini Flash-Lite). É
   fail-open mas adiciona custo + ponto de falha; o gate barato
   (`getTrashGscReason`, regex/heurística) já pega brand/navigational/numeric.
4. **OAuth de operador único, frágil a longo prazo.** Refresh token no
   `.env`; se o cron parar por meses, o token caduca e o religamento é manual
   (`auth-url`→`callback`). Sem alerta de "GSC parou de sincronizar".

### Refino recomendado
- **Religar não é mais a tarefa — está ligado.** O que **falta** para o
  warehouse é **persistir histórico**: criar `GscSnapshot` (ou
  `GscQueryDaily`) com `(query, page?, date, impressions, clicks, position,
  ctr, fetchedAt)`, uma linha por observação/semana. `KeywordOpportunity`
  vira projeção do "último visto", derivável dos snapshots. Isso é o sinal
  GSC mais valioso e hoje é descartado.
- **Adicionar a dimensão `page`** (e idealmente `date`) à query — custo zero
  na API, ganho grande (mapear query→URL própria).
- **Tirar o filtro LLM do caminho** ou deixá-lo on-demand — o gate regex já
  cobre o lixo óbvio.
- **Manter o cron como keep-alive do token** (já faz) e adicionar um alerta
  quando `fetched=0` por N semanas (sinal de token caducado).

---

## 4. Google Trends

### Como coleta
`packages/crawlers/sources/google_trends.py` usa **pytrends** (cliente
**não-oficial**, faz scraping do endpoint interno `trends.google.com` — sem
API key, sem custo). Para cada seed: `build_payload([seed], timeframe, geo)`
→ `related_queries()` → extrai `rising` e `top`. Invocado por
`daily-cron.service.ts:runGoogleTrends()` →
`pythonRunner.run(['-m','sources.google_trends'])` → JSON parseado →
`analyzer.importGoogleTrends` → `google-trends-import.service.ts`.

**Anti-bloqueio (Google 429 agressivo):** worker roda **LOCAL no PC do
operador** (IP residencial, **sem proxies**); `rate_limit_seconds: 12` entre
seeds; backoff `[60, 180, 600]s` no 429 (detectado por **string matching** —
`"429" in msg`); truncado em 80 rising / 50 top (`config/seo.yaml`).

### O que armazena
- `GoogleTrendSnapshot` (`schema.prisma:982`): `fetchedAt`, `seeds String[]`,
  `timeframe`, `geo`, `risingQueries Json`, `topQueries Json`, `risingCount`,
  `topCount`. **Isto SIM é série temporal** — cada cron grava uma linha nova
  com o array completo em JSON. Bom: é raw, não passa por LLM.
- `GoogleTrendQuery` (`schema.prisma:997`): agregado por `(query, seed, type)`
  (unique) — `change`, `interest?`, `trendingScore Float`, `game`,
  `firstSeenAt`, `lastSeenAt`, `seenCount`, `peakChange?`. **NÃO é série
  temporal** — só pico + contagem; o valor ponto-a-ponto se perde aqui.
- `TrendingTerm` (`schema.prisma:797`): consolidado cross-source
  (`popularity-consolidator.service.ts`, pesos reddit30/yt30/trends25/gsc15);
  campo `trendsScore?`, `momentum7d?`. Não é gravado pelo import de Trends.
- Rising queries viram `KeywordOpportunity` (`source='trends'`).

### Cron/cadência
`daily-cron.service.ts:140` — **`@Cron('0 6 * * *')`**, passo 3 de 4 do
pipeline diário (reddit → youtube → **google_trends** → keyword_pipeline).
Sem cron próprio.

### Lacunas concretas
1. **pytrends é frágil (crítico).** Cliente não-oficial via scraping —
   quebra quando o Google muda HTML/payload. Detecção de 429 por **string
   matching**; outros bloqueios (302 consent, CAPTCHA, `JSONDecodeError`)
   caem no branch genérico e marcam o seed como falho em silêncio. Sem
   proxy.
2. **Sem série utilizável por query.** O snapshot JSON existe, mas
   `GoogleTrendQuery` só guarda `peakChange`+`seenCount` — reconstruir a
   curva exige reparsear todos os JSONs. `momentum7d` depende de snapshot de
   7d atrás existir; se o cron falhou, vira `null`.
3. **Normalização problemática.** Trends é **relativo 0-100 dentro de cada
   payload**. O engine joga "rising %" e "top interest" na mesma escala
   global via `changToTrendingScore` (`BREAKOUT→100`, `+X%→log10`),
   comparando maçãs com laranjas entre seeds.
4. **Acoplamento ao PC do operador.** Se o PC estiver desligado às 06:00 UTC,
   Trends não roda naquele dia (sem retry dedicado). Buracos no histórico
   são esperados. Falhas engolidas em `logger.debug`.

### Refino recomendado
- **`GoogleTrendSnapshot` já é a fonte de verdade certa — preservar.** Nunca
  aplicar LLM nem normalização destrutiva antes de gravar (já está assim).
- **Persistir série temporal de verdade por query** — tabela
  `GoogleTrendQueryPoint` `(query, seed, type, value/change, fetchedAt)`, uma
  linha por observação. `GoogleTrendQuery` vira cache do "último visto".
- **Mover o `trendingScore` (0-100) para fora do warehouse** — guardar raw
  `change`/`interest` + proveniência (seed/timeframe/geo, já existem); a
  skill/consumidor calcula o score normalizado on-demand.
- **Blindar o coletor** — detecção de bloqueio estruturada (status code, não
  string), `PipelineRun` por passo (tabela já existe, `schema.prisma:852`) +
  alerta quando 0 rising/0 top por N dias. Avaliar SerpAPI Trends se a
  confiabilidade do histórico passar a importar.

---

## 5. poe.ninja

> São **dois subsistemas distintos** sob "poe.ninja", com cadências e
> estados opostos.

### 5a. Preços (ativo)
**Como coleta.** `ninja-price.service.ts` faz `fetch` direto aos endpoints
de economia (`POENINJA_POE1_BASE ?? poe.ninja/poe1/api/economy`;
`exchange/current/overview` para Currency/Fragment, `stash/current/item/
overview` para o resto). Auto-descobre a liga ativa via
`/api/data/index-state` (cache 1h). Concorrência 3, UA `PathOfTrade/1.0`.
poe.ninja migrou os paths em abril/2026 — o código já trata as duas shapes
(`normalizeExchange`/`normalizeStash`). 11 categorias PoE1, 6 PoE2.

**Armazena.** `NinjaSnapshot` (`schema.prisma:392`): `league`, `date`,
`period`, `snapshotId`, `queryKey` (`price:<Cat>` / `price:poe2:<Cat>`),
**`data Json`** (resposta normalizada inteira: items com `name`, `icon`,
`chaosValue`, `divineValue`, `sparkline`, `listingCount`), `createdAt`.
Unique `(league, date, period, queryKey)`, `period` truncado em bucket de
30min. **É série temporal real** (uma linha por bucket) — `getPriceHistory`
varre por `period`. O raw fica **no Postgres**, não no Qdrant.

**Cron.** `ninja-price.service.ts:319` — **`@Cron('*/30 * * * *')` ATIVO**
(a cada 30min). `runPriceSnapshot` percorre liga×categoria, salva snapshot,
e dispara `ItemIconEnrichmentService` (best-effort, atualiza `Item.iconUrl`).

### 5b. Builds meta (PAUSADO)
**Como coleta.** `poeninja.service.ts` chama via `execFile` o Python
`packages/crawlers/sources/poeninja.py`, que fala a **API protobuf** de
builds do poe.ninja (`blackboxprotobuf`). Precisa de um `snapshotId` que
**caduca a cada liga** e só é capturável por **browser real**
(`undetected-chromedriver`, `capture-snapshot`). `POENINJA_SNAPSHOT_ID`
hardcoded default `'1558-20260331-40148'`. Extrai class distribution, skills,
items, key passives, etc. por ascendência.

**Armazena.** Mesma tabela `NinjaSnapshot`, com `period='latest'` e
`queryKey` `overview`/`class:<X>`/`build:<X>:<Y>`. DB-first → live fallback
(Python) → salva.

**Cron.** `poeninja.service.ts:244` — **PAUSADO** (`// PAUSED @Cron('0 6 * *
*')`). Só roda manual (`runDailySnapshot`).

### Lacunas concretas
1. **Builds meta está parado e podre.** Cron pausado + `snapshotId`
   hardcoded que caduca por liga + captura via browser → o dado de meta de
   builds provavelmente está **stale**. Pior: o Python protobuf resolve
   nomes de campo como **`unknown-NNN`** quando o typedef desatualiza
   (`poeninja.service.ts:172-184` documenta `top_items: []` mesmo após
   fixes) → dado corrompido silenciosamente.
2. **`data Json` opaco.** Preço e meta são blobs JSON — bom para a skill ler
   bruto, ruim para query estruturada (ex.: "todo item acima de X divines"
   exige varrer todas as linhas em memória, como `getItemPrice` já faz). Sem
   índice por item.
3. **Dependência de protobuf não-oficial + browser** no caminho de builds —
   o ponto mais frágil de todos os coletores.
4. **Preços: sem retenção/poda.** A cada 30min × liga × categoria gera muitas
   linhas; não há política de retenção visível (downsampling de buckets
   antigos).

### Refino recomendado
- **Preços (5a) já estão no modelo certo** — raw normalizado, série temporal,
  Postgres como fonte de verdade. Refino: **política de retenção/downsampling**
  (manter granularidade fina recente, agregar histórico antigo) e, se a skill
  precisar de lookup rápido, um índice derivado por `(item, league)`.
- **Builds meta (5b): decidir religar ou aposentar.** Se mantiver: automatizar
  a captura do `snapshotId` (o cron precisa renovar sozinho a cada liga) e
  **resolver o `unknown-NNN`** (re-aprender o typedef por liga) antes de
  confiar no dado. Persistir o raw é OK; mas hoje o valor é duvidoso. Como a
  skill lê bruto em contexto longo, talvez seja mais barato a skill consultar
  a página de builds on-demand do que manter o crawler protobuf.
- **Qdrant não participa aqui** (poe.ninja é tudo Postgres) — manter assim.

---

## 6. Wiki / PoEDB (knowledge base)

### Como coleta
Três crawlers Python + um ingest manual no NestJS:

- **PoE Wiki — Cargo API (estruturado).** `packages/crawlers/sources/poewiki/`
  (`cargo.py`, `items.py`, `mods.py`, `skills.py`, `areas.py`). MediaWiki
  **Cargo API** do `poewiki.net` (`action=cargoquery`, paginação por offset,
  max 500). Tabelas: items, weapons, armours, skill_gems, skill,
  skill_levels, mods, mod_stats, spawn_weights, areas,
  crafting_bench_options. **Grátis**, ~1 req/s, sem proxy. Mitiga truncamento
  de JSON da Cargo (~350KB) com page_size menor + retry.
- **PoE Wiki — "pages" (prosa).** `packages/crawlers/sources/poewiki_pages/`
  (`crawl.py`, `html_extract.py`, `page_discovery.py`). HTML renderizado de
  `poewiki.net/wiki/<Page>`; descobre títulos via `categorymembers`/`allpages`;
  `extract_page_content` pega `.mw-parser-output` e **remove as tabelas de
  stats** ("already in PostgreSQL") → markdown. Usa proxies (~17 pág/s).
  **Destino: SÓ Qdrant** (`poe_wiki`). Nada vai pro Postgres.
- **PoEDB — scraping HTML.** `packages/crawlers/sources/poedb.py`. Scraping
  de `poedb.tw` (sem API), `ProxyWorkerPool`, rotação de UA, bloqueio em 403.
  Mods (`mod_pools` via `/us/Modifiers`, re-parse com `lxml` por HTML
  malformado) → Postgres; texto narrativo → Qdrant (`poe_wiki`,
  source `poedb`).

Os três fazem `POST /api/crawler/ingest/<model>` (`crawler.service.ts`),
lotes de 200, header `x-api-key`.

### O que armazena
**Entidades estruturadas → Postgres** (campos-chave reais):
- `Item` (`items`): `name`, `classId`, `rarity`, `tags[]`, requisitos,
  flags (`isCorrupted`/`isReplica`/…), `description`, `flavourText`,
  `explicitStatText`, `implicitStatText`, `statText`, `iconUrl`,
  `quickReview`/`quickReviewPt` (cache LLM), `wikiPageId`, `lastCrawledAt`.
- `Weapon`/`Armour` (1:1): dano/defesa. `SkillGem`: `gemTags[]`,
  `primaryAttribute`. `Skill`/`SkillLevel`: stats por nível.
- `Mod` (`mods`): `modId @unique`, `statText`, `tags[]`, `modGroups[]`;
  1:N `ModStat`, `SpawnWeight`. `ItemMod`. `Area`. `CraftingBenchOption`.
- `PoedbMod` (`poedb_mods`): `name`, `tier`, `ilvl`, `statText`, `weight`,
  `itemClass`, `affixType`, `statRanges Json`. Unique `(name, itemClass,
  tier)`.
- `PassiveSkill`/`TreePatch`: **não vêm mais da wiki** — agora do repo
  oficial GGG `skilltree-export` (`TreeIngestService`), versionado por
  `patchVersion`/`game`/`isActive`.

**Prosa de artigo → SÓ Qdrant, NÃO no Postgres.** Não existe tabela com o
markdown/HTML extraído. `item-raw-text.service.ts`/`passive-raw-text.service.ts`
**não armazenam prosa** — *sintetizam* o formato "Ctrl+C clipboard" a partir
dos campos estruturados (derivadores read-only). `quick-wiki.service.ts`
consome a prosa só via Qdrant. Único lugar com prosa em Postgres:
`CuratedIngestDraft` (`curated_ingest_drafts`: `rawText`, `sourceType`,
`targetCollection`, `status`, `llmAnalysis Json`, `qdrantPointIds[]`) — mas é
pipeline **manual** (operador cola URL/texto), não o crawl automático.

### Cron/cadência
- **Wiki Cargo (estruturado):** `crawler/wiki-crawl.cron.ts` —
  **`@Cron('0 4 * * *')`** (04:00 UTC). Targets default só
  `['items','weapons','armours','skill-gems','item-mods']` (override via
  `WIKI_CRAWL_TARGETS` ou `POST /crawler/wiki/run`).
- **PoEDB: SEM cron.** Só CLI manual (`python -m sources.poedb`).
- **poewiki_pages (prosa): SEM cron.** Só CLI manual.

### Lacunas concretas
1. **Prosa é Qdrant-only, sem fonte de verdade.** O texto de artigo vive só
   como chunks vetorizados em `poe_wiki`. Trocar o modelo de embedding (muda
   a dimensão) ou perder o Qdrant exige **re-crawl** — não há re-embed a
   partir de cópia local. (Mesma lacuna do transcript do YouTube.)
2. **Crawl de prosa e PoEDB sem cron = staleness silenciosa.** Conteúdo de
   liga nova só entra no RAG quando alguém roda a CLI à mão. O cron diário
   cobre só 5 dos targets Cargo (nem `mods`, `skills`, `areas`,
   `crafting-bench-options` estão no default).
3. **PoEDB órfão e frágil** — scraping de HTML malformado (`lxml`, seletores
   Bootstrap que quebram em redesign). `PoedbMod` desatualiza entre ligas.
   **Duas fontes de mod weights** (`SpawnWeight` da wiki vs `PoedbMod`) sem
   reconciliação.
4. **Fragilidade do Cargo / version drift** — nomes de campo Cargo hardcoded;
   se a wiki renomear um campo de template, o crawl devolve null em silêncio.
5. **Chave de upsert pelo nome, não `wikiPageId`** (`upsertSingleItem` faz
   `findFirst({name, source})`) → renomes na wiki criam duplicatas.
6. **LLM cacheado misturado com fato crawleado** — `quickReview`/
   `quickReviewPt` (gerado por LLM) na mesma tabela `Item`, sem flag
   distinguindo de dado crawleado.

### Refino recomendado
- **Criar tabela `WikiPage` (prosa) como fonte de verdade** — `pageTitle
  @unique`, `wikiPageId`, `markdown`, `pageType`, `category`, `sourceUrl`,
  `contentHash`, `lastCrawledAt`. O crawler `poewiki_pages` faz upsert aqui
  **antes** de embeddar; Qdrant `poe_wiki` vira índice derivado reembedável
  sem re-crawl. Mesmo padrão idempotente que `Item`/`Mod` já têm.
- **Botar `poewiki_pages` e `poedb` em cron** e incluir todos os targets
  Cargo no default (não só os 5).
- **Reconciliar mod weights** (wiki `SpawnWeight` vs `PoedbMod`) — eleger
  fonte autoritativa, como já se fez com passives (GGG > wiki).
- **Upsert estável por `wikiPageId`** quando presente.
- **Skill lê rows + prosa direto do Postgres** — com a prosa em tabela, o
  context-assembler injeta entidade estruturada + artigo completo; Qdrant só
  pro Q&A público (`quick-wiki`).
- **Separar texto-LLM de fato-crawleado** — mover `quickReview` para
  coluna/tabela claramente marcada como derivada por LLM.

---

## Tabela-resumo

| Fonte | Já é warehouse persistido (Postgres) | Efêmero / em disco | Só-Qdrant | Top refino |
|---|---|---|---|---|
| **Reddit** | `selftext`/`body` brutos em `RedditPost`/`RedditComment` (mas truncados no path NestJS); `pobLinks`, `category` | JSON `reddit_posts_*.json` em disco (source-of-truth de fato do keyword scan) | chunks `poe_reddit` (2 chunkers divergentes) | Eliminar o JSON; Postgres único; mover keyword-LLM (Gemini Flash-Lite) p/ on-demand ou DeepSeek |
| **Concorrentes** | só metadados em `CompetitorContent` (title, h2H3, keywords, longevity); `SerpAnalysis` (headingTree, entities, ponteiro centroid); `Competitor`, `AutoActionLog` | **texto/HTML da página** (scraped até 20k chars e descartado) | centroid `poe_serp_centroids`, `competitor_pages` (só title+h2h3 embedados) | **Persistir o raw text** (já é baixado e jogado fora); `classifyLongevity` LLM→heurística |
| **GSC** | métricas (impr/clicks/position/ctr) em `KeywordOpportunity` `source='gsc'`; `KeywordScan` | — | — | OAuth **já está ligado** (premissa stale). Falta **histórico**: `GscSnapshot` datado + dimensão `page` |
| **Google Trends** | **`GoogleTrendSnapshot` (série temporal raw em JSON)** ✓; `GoogleTrendQuery` (agregado), `TrendingTerm` | — (PC local; buracos quando desligado) | — | Série por query (`GoogleTrendQueryPoint`); tirar `trendingScore` do warehouse (calcular on-demand); blindar pytrends |
| **poe.ninja** | **`NinjaSnapshot` (preços, série temporal 30min, raw JSON)** ✓; builds meta na mesma tabela | builds meta **stale** (cron pausado, snapshotId caduca, `unknown-NNN`) | — | Preços OK (+retenção). Builds: religar com captura automática de snapshotId + fix `unknown-NNN`, ou aposentar |
| **Wiki/PoEDB** | **entidades estruturadas** (`Item`, `Mod`, `SkillGem`, `Area`, `PoedbMod`, `PassiveSkill`/`TreePatch` via GGG) ✓ | prosa de PoEDB e wiki_pages sem cron → staleness | **prosa de artigo** (`poe_wiki`, sem cópia em Postgres) | Tabela `WikiPage` p/ prosa = fonte de verdade; cron p/ pages+poedb; reconciliar mod weights |

**Padrão recorrente:** o dado **bruto de texto longo** (transcript YouTube,
prosa da wiki, corpo das páginas concorrentes) é o que falta no Postgres —
vive só no Qdrant ou é descartado. É exatamente o que a skill precisa ler em
contexto longo. As fontes que já estão no modelo-alvo (raw + série temporal
em Postgres) são **Google Trends (snapshots)**, **poe.ninja preços** e as
**entidades estruturadas da Wiki/PoEDB**. As que mais precisam de refino de
storage são **Concorrentes** (raw descartado) e **Wiki prosa** (Qdrant-only).
O enriquecimento por LLM no pipeline aparece em Reddit, Concorrentes e (opcional)
GSC/Trends — todo via OpenRouter/Gemini, candidato a virar heurística barata ou
DeepSeek e/ou sair para on-demand da skill.
