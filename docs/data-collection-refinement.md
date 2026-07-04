# Refino da Coleta de Dados — fonte por fonte (2026-06)

> Auditoria isolada de cada coletor do engine `path-of-trade-content`, com as
> decisões de refino. Complementa `restructure-plan.md` (visão macro). O engine
> JÁ é um data warehouse (ver restructure-plan §2); aqui decidimos COMO refinar
> cada fonte sob o novo modelo (engine = dados, skill = geração).

## Decisões transversais (valem para todas as fontes)

### A. Recuperação: híbrido com propósito
Decisão do operador (2026-06), embasada no post do Akita
(`akitaonrails.com/2026/04/06/rag-esta-morto-contexto-longo`):

- **Qdrant/RAG FICA** — serve consumo de **alto volume e sensível a custo**:
  a **página de Q&A pública**, a **extensão**, e features afins. Lá um LLM
  barato responde muitas queries com contexto pequeno; embeddings se pagam.
- **A skill do Claude NÃO embeda** — geração é **baixo volume, qualidade máxima**.
  Lê o dado **bruto** direto no contexto longo do Opus (lazy retrieval:
  filtro lexical/SQL → carrega bruto generoso → o modelo filtra).

Implicação de storage: o dado bruto (transcript, post, página) é a **fonte de
verdade em tabela Postgres**; o Qdrant passa a ser um **índice derivado** dela,
mantido só para os consumidores públicos. Hoje vários brutos só existem como
chunk no Qdrant — isso inverte.

### B. Enriquecimento LLM sai do pipeline de coleta
Decisão do operador (2026-06): a coleta guarda **bruto**; classificação
semântica (episodeType, qualityScore, extração de keywords) que hoje roda via
LLM no cron **sai do pipeline**. A skill faz on-demand quando precisa escrever.
Mantém-se o **embedding (TEI)** para o Qdrant — embedding ≠ enriquecimento LLM.
Resultado: cron mais barato e simples; sem dado semântico "podre" preso na linha.

### C. Diferenciação de custo (por que o híbrido)
Os dois caminhos são regimes de custo opostos:

| | Q&A pública / extensão (RAG) | Skill gera post (contexto longo) |
|---|---|---|
| Volume | alto (milhares/dia) | baixo (alguns/dia) |
| Modelo | Haiku 4.5 ($1/$5) | Opus 4.8 ($5/$25) — ou ~$0 via assinatura Claude Code |
| Contexto/chamada | pequeno (~2-3k, via chunks) | grande (~30-80k, bruto) |
| Recuperação | embeddings Qdrant | grep/SQL + leitura bruta |
| Custo/chamada | **~$0,005** | **~$0,50 API** / **~$0 assinatura** |

Cálculo (preços reais):
- **Q&A pública** — Haiku + ~2,6k contexto + ~0,6k resposta ≈ **$0,005/query**.
  A 1.000 queries/dia ≈ $5/dia. Se usasse Opus+contexto longo p/ a MESMA query:
  ~$0,32/query → **$320/dia** (60×). → RAG é obrigatório no alto volume.
- **Skill (post)** — Opus + ~55k bruto + ~10k saída ≈ **$0,53/post** via API;
  ~$0 via assinatura. A poucos posts/dia, encolher com RAG pouparia ~$0,25/post
  mas adicionaria infra de embedding + artefato de chunking + staleness.
  → contexto longo é mais barato, mais simples e mais fresco no baixo volume.

**Regra:** alto volume + barato por query → RAG. Baixo volume + qualidade → bruto
no contexto longo. A linha de corte é o volume de consultas, não o tamanho do dado.

---

## 1. YouTube

### Como coleta (hoje)
26 canais → YouTube Data API v3 (fallback RSS/yt-dlp) → classificação por
**Gemini 2.5 Flash via OpenRouter** (não free tier) → top vídeos por views têm
transcript baixado → transcript vira chunks no Qdrant `poe_transcripts`.
Cron diário 06:00 UTC; ~150-200 vídeos/run; ~7 transcripts; **~$0,015/dia
(~$0,45/mês)**.

### Armazena
- `YouTubeScan` (telemetria), `YouTubeVideo` (id, título, canal, views, duração,
  isPoe, keywords[], summary, episodeType, league, qualityScore, transcriptStatus),
  `YouTubeKeyword` (agregação/scan), `YouTubeChannel` (canais).
- Transcript bruto: **descartado** após chunking (só sobra no Qdrant).

### Lacunas
1. **Lista de canais com fonte dupla** — `youtube_channels.json` hardcoded **+**
   tabela `YouTubeChannel`, que dessincronizam.
2. **Transcript bruto descartado** — não dá pra re-processar nem pra skill ler
   inteiro sem re-baixar (yt-dlp é bloqueado às vezes).
3. **Sem histórico de views** — `views` é só snapshot; sem velocity/trending real.
4. **Sem detecção de canal morto** — `isActive` manual.
5. **Enriquecimento LLM no pipeline** (episodeType/qualityScore/keywords).

### Decisão sobre a classificação (manter + refinar, não cortar)
A classificação LLM (`llm_classify.py`, `google/gemini-2.5-flash` via OpenRouter)
alimenta dados de warehouse (keywords de SEO, slang) além de metadado de geração,
então **fica**. Mas dá pra melhorar sem trocar de modelo (mesma lógica de custo:
alto volume + tarefa simples = modelo barato ganha):
1. **Tirar `is_poe` da rota cara** — gate barato por canal conhecido + regex em
   título/tags resolve a maioria; LLM só decide ambíguos.
2. **Alimentar a classificação com `tags`/`description`** da YouTube API (já em
   memória no Step 1b, hoje ignoradas na classificação de título).
3. **Amostrar melhor o transcript** — hoje só os primeiros 1500 chars
   (`v["transcript"][:1500]`), que pega intro/sponsor; amostrar início+meio+fim.
4. **Gravar proveniência** (`classificationMethod` 'llm'|'regex' + confiança)
   pra auditar regressão de qualidade.

### Refinos decididos (status)
- **[DEPLOYADO ✅] Unificar canais em DB-only** — `rss.py:load_channels()` lê a
  tabela `youtube_channels` (psycopg2; fallback JSON só sem DB). Acaba a dupla
  fonte. NestJS mantém o mirror DB→JSON como backup (não mais load-bearing).
  Em prod via commit `027f417`. Entra em vigor no próximo scan do crawler.
- **[DEPLOYADO ✅] Persistir o transcript bruto** — coluna `transcriptRaw` em
  `YouTubeVideo`, Python `runners.py` expõe `transcript_raw` (cap 200KB),
  `youtube-scan-store.service.ts` grava na CRIAÇÃO da row (não no UPDATE que
  corre na frente). Migration `20260624180000_add_youtube_transcript_raw`
  aplicada em `poe_content`; coluna confirmada no banco; `poe-api` reiniciado.
- **[DEPLOYADO ✅] Refino da classificação** (4 itens acima) — `llm_classify.py`
  reescrito two-tier (session 39): gate barato `_cheap_classify` resolve o óbvio
  (vocabulário PoE forte OU jogo concorrente no título/tags) e só o meio ambíguo
  vai pro LLM (`_llm_classify_ambiguous`), tirando o `is_poe` da rota cara; o prompt
  agora recebe `tags`/`description` da YouTube API (`_format_video_for_llm`); a
  extração de keywords de transcript amostra início+meio+fim (`_sample_transcript`)
  em vez de só `[:1500]`; proveniência gravada em colunas novas `classification_method`
  ('regex'|'llm') + `classification_confidence` (0.9 gate / 0.7 LLM). Migration
  `20260625120000_add_youtube_classification_provenance`. +18 pytest, +2 jest.
  **[DEPLOYADO ✅]** commit `b7e75e3`; migration aplicada em `poe_content` (verificado
  no `_prisma_migrations` em 30/06); `poe-api` reiniciado.
- **[DEPLOYADO ✅] Fix da race de metadata LLM** (ver bug abaixo).
- **[nice-to-have] Snapshots de views por scan** → trending por velocity.
- **[nice-to-have] `lastVideoAt` + soft-delete** de canal morto.

### Bug descoberto: metadata LLM se perde (race de criação de row)
O `transcript_ingestor` faz `UPDATE youtube_videos` com a metadata LLM
(`episode_type`/`quality_score`/`summary`/`league`/`timestamp_relevance`)
DURANTE o scan Python. Mas as rows só são criadas DEPOIS, pelo
`saveScanVideos` (NestJS), a partir do JSON. O filtro incremental pula vídeos
já no DB, então pra todo vídeo NOVO o UPDATE bate em **0 rows** ("matched 0
rows" no log) e a metadata é descartada. Por isso esses campos estão quase
sempre nulos (verificado no DB: 1096 vídeos, metadata majoritariamente nula).
**Correção:** mesma rota do transcript bruto — o ingestor anexa a metadata no
dict do vídeo, `run_smart` inclui no JSON, `saveScanVideos` grava na criação.
**[DEPLOYADO ✅] (session 39, commit `b7e75e3`):** `transcript_metadata.metadata_to_video_fields`
expõe as 5 colunas que existem em `YouTubeVideo` (não `topics`/`entities`/`game`,
que ficam no Qdrant); `transcript_ingestor._process_one_video` anexa em
`video["llm_metadata"]` no dict compartilhado; `runners._video_for_output` achata
pros campos snake_case; `youtube-scan-store.service.ts:saveScanVideos` grava na
criação. O UPDATE in-Python continua (caminho worker/drain, onde a row já existe).
Sem migration (colunas já existiam). Deploy junto do refino acima.

### Transcript worker (residential) — deployado, mas drain travado
Sessão de 24/06. **Em prod (poe-api saudável):**
- `027f417` canais DB-only + `transcript_raw` (caminho in-scan).
- `e2213c0` `transcript_raw` no caminho worker/drain (`TranscriptPgWriter.update_youtube_video_transcript_raw`).
- `f98c4df` **Tier 1.5 no cascade**: captions residenciais do worker
  (`requestTranscript`) entre Tier 1 (server, bloqueado) e Tier 2 (Whisper).

**Infra do worker confirmada:** conecta no `/ws/worker`, `embed` via TEI local OK,
`yt-dlp -F` funciona pelo IP residencial (sem block). Reset rodou (dedup limpa,
`jobsDropped=204`, 22 re-enfileirados). **Mas nenhum transcript resolveu (raw=0,
Qdrant=0)** — drain travado por 3 blockers a resolver numa sessão de follow-up:

1. **WS instável** — conexão cai a cada ~1-2min ("no close frame"/502).
   **NÃO é código do worker** (verificado session 38, 24/06): o diagnóstico
   original ("bloqueio do event loop pelo fetch síncrono → `asyncio.to_thread`")
   está **errado/obsoleto**. Auditoria do `worker.py` + `worker_handlers.py`:
   (a) os handlers já spawnam como background tasks (`_route_task` → `_spawn` →
   `asyncio.create_task`), então o read loop `async for raw in ws` nunca trava;
   (b) os fetches síncronos já rodam em thread (`run_in_executor`); (c) o
   `{type:'ping'}` do servidor é respondido na hora (`worker.py:194`) e o cliente
   tem `ping_interval=30/ping_timeout=10`. O worker está correto. **Causa real:
   infra** — read-timeout/keepalive do proxy reverso na frente do `poe-api` na
   VPS (ou restart do PM2). **Fix (infra, não repo):** subir `proxy_read_timeout`
   + WS keepalive no nginx/Caddy da VPS; a config da API nem está versionada
   (só `nginx/docs.pathoftrade.net.conf`). Gap menor de robustez no lado server:
   `WorkerGateway` manda `{type:'ping'}` mas não impõe pong-timeout — meia-conexão
   só é detectada quando um `send` falha.
2. **VOD multi-hora travando a fila** — `zrAbBjMHFLk` (466MiB de áudio, `duration`
   null → furou o filtro ≤1h) preso no Tier 2 áudio, bloqueando a concurrency-1.
   **Fix:** excluir `duration IS NULL` do caminho de áudio OU `--match-filter` no yt-dlp.
3. **ffmpeg ausente local** — fallback Whisper não extrai áudio. Só afeta vídeos sem
   legenda (Tier 1.5 cobre a maioria). **Fix:** instalar ffmpeg.

Cascade + persistência corretos e deployados. O blocker #1 é **infra na VPS**
(proxy WS timeout), não código — destravar lá; #2 (filtrar o VOD ruim) é o único
fix de código que sobra antes de re-drenar. Worker/Whisper on-demand (ver
[[feedback-ondemand-gpu-containers]]).

### Achado operacional: bgutil-pot "unhealthy" é alarme falso
O container `bgutil-pot` (POT provider pro yt-dlp) aparece unhealthy há semanas,
mas é só o **healthcheck quebrado** (usa `wget`, que não existe na imagem:
`/bin/sh: 1: wget: not found`). O servidor POT está no ar (v1.3.1, porta 4416).
Os 22/1096 transcripts vêm provavelmente de **bloqueio do yt-dlp por IP de
datacenter** (comentado em `transcripts.py:151`), não do POT fora. A verificar:
se o yt-dlp do crawler realmente usa o POT provider — se não usa, é aí o ganho.

### Custo
Tirar a classificação LLM zera a fração de ~$0,45/mês da coleta YouTube. Embedding
(TEI local) e API do YouTube seguem; custo desprezível.

---

## 2. Reddit

### Como coleta (hoje)
**Dois coletores paralelos para o mesmo dado.** O principal é o **crawler
Python** (`packages/crawlers/sources/reddit/`) que consome o JSON público
oficial (`reddit.com/r/<sub>/<sort>.json`) — sem PRAW, sem Pushshift — com
**proxies obrigatórios** (a requisição direta é desligada porque o IP do
servidor leva 403), rate base `REDDIT_RATE_LIMIT=2.0s` + backoff e cap de 4
workers. Subs: `pathofexile`, `pathofexilebuilds`, `PathOfExile2`. Em paralelo
existe um **crawler NestJS nativo** (`reddit-monitor.service.ts:runCrawl`) que
faz `fetch` direto sem proxy — frágil em prod (403 esperado), é só fallback do
modo `auto`. Custo de API zero (custo = proxies + tempo).

### Armazena
- `RedditScan` (telemetria; PK `Int autoincrement`, **sem `updatedAt`**).
- `RedditPost`: `postId @unique`, `title`, **`selftext`**, `score`,
  `numComments`, `flair`, `subreddit`, `permalink`, `createdUtc`, `upvoteRatio`,
  **`pobLinks[]`**, `category`. Índices em `subreddit`/`score`/`createdUtc`.
- `RedditComment`: `body`, `score`, `createdUtc`, `postId` (Cascade).
- O texto bruto **FICA no Postgres** (`selftext`/`body`) — ao contrário do
  YouTube. Mas o caminho NestJS **trunca em 2000 chars**. Qdrant `poe_reddit`
  é índice derivado, alimentado por **dois chunkers divergentes** (Python +
  TS) na mesma collection. Há ainda um **JSON em disco**
  (`reddit_posts_top_month.json`) que virou source-of-truth de fato do keyword
  scan e do auto-seed.

### Lacunas
1. **Extração de keywords via LLM no pipeline**
   (`reddit-scan-llm-extractor.service.ts` → `gemini-2.5-flash-lite` via
   OpenRouter, custo gravado em `RedditScanResult.llmCost`). Só processa
   **títulos** — ignora o `selftext` rico que já está no Postgres.
2. **Regex e LLM são fallback exclusivo, não se enriquecem** — o regex só entra
   quando o LLM falha (e aí o custo já foi pago).
3. **Raw triplicado e divergente** — JSON em disco + Postgres + Qdrant, com dois
   chunkers; `deterministicId` é hash de 32-bit virando pseudo-UUID (risco de
   colisão em volume).
4. **Sem histórico / sem `updatedAt`** — o upsert no re-crawl nunca re-grava
   `selftext` (texto congelado). PK `Int` + ausência de `updatedAt` violam o
   padrão do projeto.
5. **Dois coletores, uma fonte** — parse/classificação/PoB-links duplicados em
   Python e TS; o NestJS é frágil sem proxy.
6. **Acoplamento a arquivo em disco** — mudar `--sort/--time` faz o keyword scan
   ler dados velhos.

### Refinos decididos (status)
- **[A FAZER] Postgres como única fonte de verdade; eliminar o JSON
  intermediário.** Python escreve direto na tabela (ou via 1 endpoint de
  ingest). Guardar `selftext`/`body` **completos** — remover os `.slice(0,2000)`
  em `reddit-monitor.service.ts:113,241` — é o que a skill lê em contexto longo.
- **[A FAZER] Mover a extração de keywords por LLM para on-demand.** A tabela já
  tem `score`/`flair`/`category`/`pobLinks`/`title`; regex + heurística cobrem a
  coleta. Reservar o LLM para refino manual zera o custo recorrente OpenRouter.
- **[DECIDIR] Se mantiver o LLM, trocar Gemini Flash-Lite por DeepSeek** (editar
  o node `keyword-cleaner` em `config/prompt_templates.yaml`); validar que o
  DeepSeek respeita "responda só JSON". (Decisão transversal C — escolha em
  aberto.)
- **[A FAZER] Unificar o chunking do Qdrant numa só implementação** com UUIDv5
  estável; Qdrant passa a ser reconstruível a partir do Postgres.
- **[DECIDIR] Aposentar o coletor B (NestJS `runCrawl`)** ou rebaixá-lo,
  deixando o Python com proxies como único coletor. (Aposentar vs manter como
  fallback degradado.)

---

## 3. Concorrentes (SearxNG/SERP)

### Como coleta (hoje)
A fonte real de URLs top-N é a **Brave Search API**
(`brave-search-client.service.ts` → `api.search.brave.com`, header
`X-Subscription-Token`). O **SearxNG self-hosted está MORTO no caminho de
produção** — a instância banía os engines upstream sob carga ("251 engines ×
700 keywords cascade-banned"), então `serp-analyzer` e `searxng-auto-actions`
foram redirecionados pra Brave. Há ainda **SerpAPI em paralelo**
(`competitor-analyzer.service.ts`, 250/mês free, análise on-page efêmera não
persistida) → **três** provedores de busca no código. O scraping de página
(`serp-scraper.service.ts`) é `fetch` + regex (sem cheerio), `mainText` cortado
em 20k chars, **não respeita robots.txt** e quebra em SPAs. O sitemap crawl
(`competitor-sitemap.service.ts`) respeita robots, depth 2. Proxy rotation
existe mas é **só para o YouTube** — Brave/scraper/sitemap fazem `fetch` direto.

### Armazena
- `CompetitorContent`: `domain`, `url @unique`, `title`, `category`,
  `keywords[]`, `h2H3[]` (≤20 headings), `longevity`, `lastCrawledAt`,
  `pageUpdatedAt`. **CRÍTICO: não armazena o texto/HTML da página** — só
  título + headings + n-grams do slug. O embedding em `competitor_pages` também
  é só `title\n+h2H3`.
- `SerpAnalysis`: `keyword`, `topUrls Json`, `headingTree Json`, `entities[]`,
  `qdrantCentroidId`, `serpFeatures Json`. O `mainText` scraped (até 20k/página)
  é **embedado num centroid** (`poe_serp_centroids`) e **descartado** — só sobra
  o ponteiro.
- `Competitor` (domínios monitorados), `AutoActionLog`.

### Lacunas
1. **Texto da página é efêmero e só vira embedding.** Pra competidores nem o
   full text é capturado (só title+h2h3); pro SERP o `mainText` é embedado e
   jogado fora. **Não há fonte-de-verdade do bruto no Postgres** — re-análise
   exige re-scrape (reconsome quota Brave).
2. **LLM no pipeline** — `serp-entity-extractor` (por keyword),
   `competitor-gap-analyzer` (`prioritizeGapsWithLlm`, maxTokens 3000, o mais
   caro), `competitor-page-enricher` (`classifyLongevity`, **1 call LLM por
   página**), `competitor-sitemap` (`suggestPathFilter`). Tudo OpenRouter/Gemini.
3. **Dependência de APIs pagas frágeis** — Brave (pago obrigatório, ~3k/mês
   steady-state vs free tier 2k) + SerpAPI; falha de chave degrada em silêncio
   (retorna `[]`).
4. **Sem histórico de posições SERP** — `topUrls` é snapshot; `ourPosition` é
   calculado mas **não persiste**. Sem evolução de ranking.
5. **`engineAgreement` virou métrica morta** com Brave (engine única).
6. **Sem proxy no SERP** — crawl bloqueável; scraper regex quebra em SPA.

### Refinos decididos (status)
- **[A FAZER] Persistir o texto bruto no Postgres.** Adicionar
  `rawText`/`rawHtml` + `fetchedAt` em `CompetitorContent` e gravar o `mainText`
  que `serp-scraper.service.ts` já extrai e o body que
  `competitor-page-enricher.service.ts:fetchPageContent` já baixa **e descarta**.
  Custo quase zero, elimina re-scrape e dá insumo pra skill.
- **[A FAZER] Qdrant como índice derivado** (`poe_serp_centroids`,
  `competitor_pages`) — reembedável a partir do raw, sem re-crawl.
- **[A FAZER] Mover LLM para on-demand / heurística barata.**
  `classifyLongevity` (1 LLM/página, maior desperdício diário) → regex de versão
  de patch + `pageUpdatedAt` do sitemap (`competitor-freshness.ts` já tem a
  infra); gap analysis e entity extraction → on-demand pela skill, lendo o raw.
- **[DECIDIR] Trocar Gemini por DeepSeek via OpenRouter** (troca centralizada em
  `llm/models.ts` / `config/prompt_templates.yaml`, não toca os 7 serviços).
  (Decisão transversal C.)
- **[DECIDIR] Consolidar os provedores de busca num só.** SearxNG morto / Brave
  ativo / SerpAPI paralelo. Reviver SearxNG com rate-limit por engine +
  ProxyRotator removeria a dependência paga do Brave — escolha em aberto:
  consolidar em Brave (pago) vs reviver SearxNG (grátis, mais infra).

---

## 4. GSC (Google Search Console)

> **Correção factual:** a premissa "GSC pausado por falta de OAuth" está
> **stale**. O OAuth foi concluído na Session 21 e está **ativo hoje** — religar
> não é mais a tarefa.

### Como coleta (hoje)
`gsc.service.ts` usa a **Search Console API v1** via `googleapis` (OAuth2,
escopo `webmasters.readonly`). `syncData(days=28)` pagina `searchanalytics.query`
(dimensão `query`, `rowLimit=5000`) e passa pro `importGscData`. Site
`sc-domain:pathoftrade.net`. **Custo zero** (API gratuita). No `.env` verificado:
`GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_SITE_URL` e
**`GSC_REFRESH_TOKEN` (token Google real)** todos setados → `configured=true` →
o cron roda.

### Armazena
GSC **não tem tabela própria** — `gsc-import.service.ts` faz **upsert em
`KeywordOpportunity`** (`source='gsc'`): `impressions`, `clicks`, `position`,
`ctr`, `wordCount`, `intent`, `cluster`, `game`, `isLongTail`, `lastSeenAt`.
Cada run grava também um `KeywordScan` (`scanType='gsc_striking'`). O scoring
VICE foi removido (Session 26B) — só métricas brutas; striking/difficulty
derivam depois.

### Lacunas
1. **Sem histórico / sem série temporal** — o upsert sobrescreve
   `impressions/clicks/position/ctr` a cada semana; **não há snapshot datado**
   (ao contrário de `GoogleTrendSnapshot`/`NinjaSnapshot`). Impossível plotar
   "minha posição na query X ao longo do tempo" — o dado de maior valor do GSC.
   Só sobra `lastSeenAt`.
2. **Só dimensão `query`** — não puxa `page` nem `query×page`, que diria *qual
   URL minha* rankeia pra a query (insumo direto de otimização). Sem `date` por
   linha tampouco.
3. **Filtro LLM opcional no caminho** (`KeywordLlmFilterService`, gate
   `ENABLE_KEYWORD_LLM_FILTER`, batch de 20 via Gemini Flash-Lite). Fail-open,
   mas adiciona custo + ponto de falha; o gate barato (`getTrashGscReason`,
   regex) já pega brand/navigational/numeric.
4. **OAuth de operador único, frágil a longo prazo** — refresh token no `.env`;
   se o cron parar por meses o token caduca e o religamento é manual. Sem alerta
   de "GSC parou de sincronizar".

### Refinos decididos (status)
- **[A FAZER] Persistir histórico** — criar `GscSnapshot` (ou `GscQueryDaily`)
  com `(query, page?, date, impressions, clicks, position, ctr, fetchedAt)`, uma
  linha por observação/semana. `KeywordOpportunity` vira projeção do "último
  visto", derivável dos snapshots. Esse é o sinal GSC mais valioso e hoje é
  descartado. (Religar já está feito; isso é o que falta.)
- **[A FAZER] Adicionar a dimensão `page`** (e idealmente `date`) à query —
  custo zero na API, mapeia query→URL própria.
- **[A FAZER] Tirar o filtro LLM do caminho** (ou deixá-lo on-demand) — o gate
  regex já cobre o lixo óbvio.
- **[A FAZER] Manter o cron como keep-alive do token** (`@Cron('0 7 * * 1')` já
  faz isso — Google invalida tokens parados 6+ meses) e adicionar alerta quando
  `fetched=0` por N semanas.

---

## 5. Google Trends

### Como coleta (hoje)
`packages/crawlers/sources/google_trends.py` usa **pytrends** (cliente
**não-oficial**, faz scraping do endpoint interno do `trends.google.com` — sem
API key, sem custo). Pra cada seed: `build_payload` → `related_queries()` →
extrai `rising` e `top`. Invocado por `daily-cron.service.ts:runGoogleTrends()`.
Anti-bloqueio: worker roda **LOCAL no PC do operador** (IP residencial, sem
proxies), `rate_limit_seconds: 12`, backoff `[60,180,600]s` no 429 (detectado
por **string matching**), truncado em 80 rising / 50 top.

### Armazena
- `GoogleTrendSnapshot`: `fetchedAt`, `seeds[]`, `timeframe`, `geo`,
  `risingQueries Json`, `topQueries Json`, contagens. **Isto SIM é série
  temporal** (uma linha nova por cron, array completo em JSON, raw, sem LLM).
- `GoogleTrendQuery`: agregado por `(query, seed, type)` — `change`, `interest`,
  `trendingScore`, `firstSeenAt`, `lastSeenAt`, `seenCount`, `peakChange`.
  **NÃO é série temporal** — só pico + contagem; o ponto-a-ponto se perde.
- `TrendingTerm` (consolidado cross-source); rising → `KeywordOpportunity`
  (`source='trends'`).

### Lacunas
1. **pytrends é frágil (crítico)** — cliente não-oficial via scraping, quebra
   quando o Google muda HTML/payload. 429 detectado por **string matching**;
   302/CAPTCHA/`JSONDecodeError` caem no branch genérico e marcam o seed como
   falho em silêncio. Sem proxy.
2. **Sem série utilizável por query** — o snapshot JSON existe, mas
   `GoogleTrendQuery` só guarda `peakChange`+`seenCount`; reconstruir a curva
   exige reparsear todos os JSONs. `momentum7d` vira `null` se o cron de 7d atrás
   falhou.
3. **Normalização problemática** — Trends é relativo 0-100 *dentro de cada
   payload*; o engine joga "rising %" e "top interest" na mesma escala global via
   `changToTrendingScore`, comparando maçãs com laranjas entre seeds.
4. **Acoplamento ao PC do operador** — PC desligado às 06:00 UTC = sem Trends
   naquele dia (sem retry). Buracos no histórico são esperados; falhas engolidas
   em `logger.debug`.

### Refinos decididos (status)
- **[A FAZER] Preservar `GoogleTrendSnapshot` como fonte de verdade** — nunca
  aplicar LLM nem normalização destrutiva antes de gravar (já está assim).
- **[A FAZER] Persistir série temporal de verdade por query** — tabela
  `GoogleTrendQueryPoint` `(query, seed, type, value/change, fetchedAt)`, uma
  linha por observação. `GoogleTrendQuery` vira cache do "último visto".
- **[A FAZER] Mover o `trendingScore` (0-100) para fora do warehouse** — guardar
  raw `change`/`interest` + proveniência (seed/timeframe/geo, já existem); a
  skill/consumidor calcula o score normalizado on-demand.
- **[A FAZER] Blindar o coletor** — detecção de bloqueio por status code (não
  string), `PipelineRun` por passo (tabela já existe) + alerta quando 0 rising/0
  top por N dias.
- **[DECIDIR] Avaliar SerpAPI Trends** como substituto/complemento do pytrends
  se a confiabilidade do histórico passar a importar. (Manter pytrends grátis e
  frágil vs pagar por confiabilidade.)

---

## 6. poe.ninja

> São **dois subsistemas distintos** sob "poe.ninja", com cadências e estados
> opostos: preços (ativo, no modelo certo) e builds meta (pausado e podre).

### Como coleta (hoje)
- **5a. Preços (ATIVO).** `ninja-price.service.ts` faz `fetch` direto aos
  endpoints de economia, auto-descobre a liga ativa via `/api/data/index-state`
  (cache 1h), concorrência 3. poe.ninja migrou os paths em abril/2026 — o código
  já trata as duas shapes. Cron **`@Cron('*/30 * * * *')` ATIVO** (a cada 30min).
- **5b. Builds meta (PAUSADO).** `poeninja.service.ts` chama via `execFile` o
  Python `poeninja.py`, que fala a **API protobuf** de builds
  (`blackboxprotobuf`). Precisa de um `snapshotId` que **caduca a cada liga** e
  só é capturável por **browser real** (`undetected-chromedriver`).
  `POENINJA_SNAPSHOT_ID` hardcoded default. Cron **PAUSADO** — só roda manual.

### Armazena
- `NinjaSnapshot`: `league`, `date`, `period`, `queryKey` (`price:<Cat>` /
  `overview` / `class:<X>`), **`data Json`** (resposta normalizada inteira).
  Unique `(league, date, period, queryKey)`, `period` em bucket de 30min.
  **É série temporal real** (uma linha por bucket), raw **no Postgres**, não no
  Qdrant. Preços e builds meta compartilham a mesma tabela.

### Lacunas
1. **Builds meta está parado e podre** — cron pausado + `snapshotId` hardcoded
   que caduca por liga + captura via browser → o dado provavelmente está
   **stale**. Pior: o Python protobuf resolve nomes de campo como
   **`unknown-NNN`** quando o typedef desatualiza → dado corrompido em silêncio.
2. **`data Json` opaco** — bom pra skill ler bruto, ruim pra query estruturada
   ("todo item acima de X divines" exige varrer todas as linhas). Sem índice por
   item.
3. **Dependência de protobuf não-oficial + browser** no caminho de builds — o
   ponto mais frágil de todos os coletores.
4. **Preços: sem retenção/poda** — 30min × liga × categoria gera muitas linhas;
   sem política de downsampling de buckets antigos.

### Refinos decididos (status)
- **[A FAZER] Preços (5a): adicionar política de retenção/downsampling** — manter
  granularidade fina recente, agregar histórico antigo. O resto do modelo já está
  certo (raw normalizado, série temporal, Postgres como fonte de verdade).
- **[nice-to-have] Índice derivado por `(item, league)`** se a skill precisar de
  lookup rápido de preço.
- **[DECIDIR] Builds meta (5b): religar ou aposentar.** Se religar: automatizar a
  captura do `snapshotId` (o cron precisa renovar sozinho a cada liga) e
  **resolver o `unknown-NNN`** (re-aprender o typedef por liga) antes de confiar
  no dado. Alternativa: como a skill lê bruto em contexto longo, pode sair mais
  barato a skill consultar a página de builds on-demand do que manter o crawler
  protobuf. (Esta é a decisão central da fonte — bater o martelo.)
- **[A FAZER] Qdrant não participa aqui** (poe.ninja é tudo Postgres) — manter
  assim.

---

## 7. Wiki/PoEDB

### Como coleta (hoje)
Três crawlers Python + um ingest manual no NestJS:
- **PoE Wiki — Cargo API (estruturado).** `packages/crawlers/sources/poewiki/`
  via MediaWiki Cargo API do `poewiki.net` (`action=cargoquery`). Tabelas: items,
  weapons, armours, skill_gems, mods, areas, crafting_bench_options. Grátis,
  ~1 req/s. Mitiga o truncamento de JSON da Cargo com page_size menor + retry.
- **PoE Wiki — "pages" (prosa).** `packages/crawlers/sources/poewiki_pages/` —
  HTML renderizado, `extract_page_content` pega `.mw-parser-output` e **remove as
  tabelas de stats** ("already in PostgreSQL") → markdown. Usa proxies.
  **Destino: SÓ Qdrant** (`poe_wiki`). Nada vai pro Postgres.
- **PoEDB — scraping HTML.** `poedb.py` raspa `poedb.tw` (sem API),
  `ProxyWorkerPool`, rotação de UA. Mods → Postgres; texto narrativo → Qdrant.

Os três fazem `POST /api/crawler/ingest/<model>`, lotes de 200, `x-api-key`.

### Armazena
- **Entidades estruturadas → Postgres:** `Item` (`name`, `classId`, `tags[]`,
  flags, `statText`, `iconUrl`, `quickReview`/`quickReviewPt` cache LLM,
  `wikiPageId`), `Weapon`/`Armour`, `SkillGem`/`Skill`/`SkillLevel`, `Mod`
  (+ `ModStat`, `SpawnWeight`), `PoedbMod`, `Area`, `CraftingBenchOption`.
  `PassiveSkill`/`TreePatch` **não vêm mais da wiki** — agora do repo oficial GGG
  `skilltree-export`.
- **Prosa de artigo → SÓ Qdrant, NÃO no Postgres.** Não existe tabela com o
  markdown/HTML. `item-raw-text.service.ts` *sintetiza* o formato Ctrl+C a partir
  dos campos estruturados (não armazena prosa). Único lugar com prosa em Postgres:
  `CuratedIngestDraft` — mas é pipeline **manual** (operador cola URL/texto), não
  o crawl automático.

### Lacunas
1. **Prosa é Qdrant-only, sem fonte de verdade** — o texto de artigo vive só como
   chunks vetorizados em `poe_wiki`. Trocar o modelo de embedding ou perder o
   Qdrant exige **re-crawl**. (Mesma lacuna do transcript do YouTube.)
2. **Crawl de prosa e PoEDB sem cron = staleness silenciosa** — conteúdo de liga
   nova só entra no RAG via CLI manual. O cron Cargo diário cobre só 5 targets
   (`items/weapons/armours/skill-gems/item-mods`) — nem `mods`, `skills`, `areas`,
   `crafting-bench-options` no default.
3. **PoEDB órfão e frágil** — scraping de HTML malformado (`lxml`, seletores
   Bootstrap). **Duas fontes de mod weights** (`SpawnWeight` da wiki vs
   `PoedbMod`) sem reconciliação.
4. **Fragilidade do Cargo / version drift** — nomes de campo hardcoded; renome de
   template na wiki devolve null em silêncio.
5. **Chave de upsert pelo nome, não `wikiPageId`** → renomes na wiki criam
   duplicatas.
6. **LLM cacheado misturado com fato crawleado** — `quickReview`/`quickReviewPt`
   (gerado por LLM) na mesma tabela `Item`, sem flag distinguindo de dado
   crawleado.

### Refinos decididos (status)
- **[A FAZER] Criar tabela `WikiPage` (prosa) como fonte de verdade** —
  `pageTitle @unique`, `wikiPageId`, `markdown`, `pageType`, `category`,
  `sourceUrl`, `contentHash`, `lastCrawledAt`. O crawler `poewiki_pages` faz
  upsert aqui **antes** de embeddar; Qdrant `poe_wiki` vira índice derivado
  reembedável sem re-crawl. Mesmo padrão idempotente de `Item`/`Mod`.
- **[A FAZER] Botar `poewiki_pages` e `poedb` em cron** e incluir todos os
  targets Cargo no default (não só os 5).
- **[A FAZER] Upsert estável por `wikiPageId`** quando presente.
- **[A FAZER] Skill lê rows + prosa direto do Postgres** — com a prosa em tabela,
  o context-assembler injeta entidade estruturada + artigo completo; Qdrant só
  pro Q&A público (`quick-wiki`).
- **[A FAZER] Separar texto-LLM de fato-crawleado** — mover `quickReview` pra
  coluna/tabela claramente marcada como derivada por LLM.
- **[DECIDIR] Reconciliar mod weights** (wiki `SpawnWeight` vs `PoedbMod`) —
  eleger a fonte autoritativa, como já se fez com passives (GGG > wiki). Falta
  bater qual fonte ganha.
