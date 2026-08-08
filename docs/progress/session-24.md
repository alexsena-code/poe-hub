# Session 24 — Preço da concorrência (G2G) substitui o scraper do Discord

**Tema:** trocar a fonte de preço do hub: sai o pipeline de scraping do Discord,
entra a coleta do marketplace G2G.

## O que landou

### 1. Coletor G2G (novo)

| Arquivo | Papel |
|---|---|
| `lib/g2g-client.ts` | HTTP, paginação e parse do título da oferta |
| `lib/g2g-stats.ts` | Estatística pura: mediana, quartis, filtro MAD |
| `lib/g2g-collector.ts` | Orquestra e persiste; compartilhado por CLI e rota |
| `lib/validations/g2g.ts` | Zod do POST |
| `scripts/g2g-price-collector/index.ts` | CLI / entrypoint do cron |
| `scripts/g2g-price-collector/README.md` | A API do G2G e o porquê do MAD |
| `app/api/prices/g2g/route.ts` | `GET` série, `POST` coleta |
| `hooks/use-g2g-snapshots.ts` | Série para a UI |
| `components/modules/prices/g2g-price-cards.tsx` | Cards |
| `components/modules/prices/g2g-price-chart.tsx` | Série + banda p25–p75 |

Migration `20260808120000_add_g2g_price_snapshots`.

**Agendamento: Scheduled Task do Coolify, não container.** A primeira versão
criou um `Dockerfile.collector` + serviço no compose, no molde do scraper antigo.
Estava errado: o hub roda no Coolify (`hub.pathoftrade.net`, app id 1) e o
`docker-compose.yml` só sobe em dev — o serviço nunca rodaria em produção. E um
container de ~500 MB para duas chamadas HTTP a cada 30 min é desproporcional.
Trocado por uma Scheduled Task (`g2g-price-collect`, `*/30 * * * *`, timeout
120s) que roda dentro do container do app.

Como a task não tem cookie de sessão, `POST /api/prices/g2g` passou a aceitar
também `Authorization: Bearer $CRON_SECRET` (comparação com `timingSafeEqual`).
Sem `CRON_SECRET` no ambiente o caminho fica desligado — secret vazio nunca
autentica. O comando usa `node -e` com `fetch` nativo porque a imagem de
produção é Alpine slim **sem curl**, e precisa caber nos 255 caracteres da
coluna `command` do Coolify.

**Validação:** `npx tsx scripts/g2g-price-collector/index.ts --dry-run --league Allflame`
devolveu mediana US$ 0,0600 sobre 56 ofertas válidas de 78, em 2 páginas.

### 2. Remoção do pipeline do Discord

Migration `20260808130000_remove_discord_price_pipeline`: dropa `price_entries`
(~31.830 msgs cruas), `discord_sources` e o enum `Currency`.

Deletados: `scripts/discord-price-scraper/` (7 arquivos), `scripts/run-scraper.sh`,
`Dockerfile.scraper`, `lib/daily-price-aggregator.ts`, `lib/league-resolver.ts`,
`lib/validations/price.ts`, rotas `/api/prices{,/[id],/stats,/scrape,/import}`,
`/api/discord-sources/**`, `farm/prices/sources/`, `discord-source-manager.tsx`,
`price-history-table.tsx`, `price-stats-cards.tsx`, `price-chart.tsx` (×2),
`price-charts.tsx`, `app/docs/hub/prices/`, `price.factory.ts`,
`.claude/agents/scraper-dev.md`.

Dep órfã removida: `@google/genai` (zero imports). Vars removidas do `.env` e
templates: `DISCORD_TOKEN`, `DCE_PATH`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`.

### 3. `daily_prices` PRESERVADA — decisão explícita

Não é tabela do Discord: sustenta `import-prices`, `create-projected` e o
overlay do comparador de cenários, com ~926 dias de histórico de ligas passadas.
Virou **arquivo read-only** (sem produtor), documentado no schema e exposto em
`/farm/prices` na seção "Arquivo — histórico do Discord". As rotas
`/api/prices/daily{,/cross-league}` continuam vivas para isso.

### 4. Dashboard

KPI "Divine Atual" (BRL, Discord) → **"Divine na G2G"** (USD, concorrência).
Semântica diferente, por isso troca e não remendo: `currentDivinePrice` /
`divineChange7d` viraram `g2gDivinePrice` / `g2gChange7d`. `PriceCharts` saiu do
dashboard — mostraria série congelada como se fosse atual.

## Decisões de projeto

- **MAD (k=4), não IQR.** A cauda do G2G é extrema: numa amostra real de 80
  ofertas havia listagens de US$ 22 e US$ 999,99 contra mediana de US$ 0,06. A
  cerca `q3 + 1.5*IQR` caiu em US$ 0,394 (7x a mediana) e deixava lixo passar.
  A mediana ficou estável entre k=3 e k=6 — estimativa robusta ao parâmetro.
- **Tabela nova, não reúso de `daily_prices`.** Séries diferentes: concorrência
  em USD vs. venda própria em BRL. Juntar distorceria qualquer leitura que
  cruzasse as duas eras.
- **Sem `cron-runner.ts` separado.** O do Discord existia para isolar o binário
  do DiscordChatExporter, que travava. Aqui é uma chamada HTTP.

## Descobertas sobre a API do G2G

Pública, sem auth. Nada documentado:

- `country` é obrigatório (`4001 Missing mandatory parameter` sem ele).
- `group=0` abre os grupos — sem isso cada linha é só a oferta mais barata do
  grupo e a amostra da mediana some.
- `q=<item>` filtra por item. **Sem ele o Divine é inalcançável**: as 100
  primeiras linhas de `sort=lowest_price` são Chaos Orb e Lifeforce.
- Liga/item só existem no `title` (`[PC] Allflame Standard > Divine Orb`);
  `offer_attributes` usa IDs opacos. "Standard" no sufixo é **dificuldade**.

**A G2G não guarda histórico de preço** (verificado 08/08/2026): endpoints de
history/trend/chart dão 404, e os 403 são o API Gateway da AWS respondendo rota
inexistente — um path inventado dá o mesmo 403. A página pública não tem
gráfico. **Cada coleta perdida é buraco permanente na série.**

## Bug pego em teste

`clampLimit(null)` devolvia 1 em vez de 500: `Number(null)` é `0`, que passa no
`Number.isFinite`, e o clamp espremia para 1 — a série inteira viraria um ponto
só sem `?limit=`. Corrigido com guard de `null` antes do `Number()`, com teste
de regressão.

## Validação

- `npx vitest run` — **728 passando, 1 skipped, 0 falhas** (54 arquivos).
- 39 testes novos: 27 unitários (`g2g-stats`, `g2g-client`) + 12 de integração
  da rota (`g2g.test.ts`, DB real).
- `npx prisma migrate deploy` num `potc_test` limpo aplicou as 24 migrations,
  incluindo as duas novas. Estado final conferido: `daily_prices` e
  `g2g_price_snapshots` presentes; `price_entries`, `discord_sources` e o tipo
  `Currency` ausentes.
- E2E `e2e/prices.spec.ts` reescrito (7 testes) — não dispara coleta real, para
  não ficar intermitente por causa de serviço de terceiro.

## Segurança

`.gitignore` cobria só `.env` e `.env*.local` — `.env.bak-20260728` e cópias
ficavam **versionáveis com segredos em claro**. Trocado por `.env*` + exceções
para os 3 templates. Conferido: os backups agora são ignorados e
`.env.example`, `.env.production.example` e `.env.test` seguem trackeados.

## Deploy — o que JÁ foi aplicado em produção

1. **Migrations aplicadas na VPS** (08/08, numa única transação). O
   `DATABASE_URL` da workstation usa `poth_app`, que é CRUD only, e o `poe` não
   aceita conexão de fora (`pg_hba` só libera `172.18.0.0/16`) — então **não deu
   para usar o túnel**; foi via `ssh mahou-vps 'docker exec -i poe-postgres psql
   -U poe -d poth'`. As linhas de `_prisma_migrations` foram inseridas junto, com
   o SHA-256 de cada `migration.sql`, senão o Prisma tentaria reaplicar.
   - **Backup antes do drop**: `price_entries` tinha **34.575** linhas em prod
     (não 31.830 — o dump de abril estava velho). Salvo em
     `/root/poth-discord-price-backup-20260808.sql.gz` na VPS e em
     `pathoftrade/_backups/` local (2,4 MB, gzip verificado).
   - Conferido depois: `daily_prices` com 952 linhas intactas,
     `g2g_price_snapshots` com 18 colunas, `price_entries`/`discord_sources`/
     enum `Currency` ausentes, e `poth_app` já com CRUD na tabela nova (há
     `ALTER DEFAULT PRIVILEGES` configurado — não precisou de GRANT manual).
2. **Coleta real validada contra produção**: snapshot gravado com mediana
   US$ 0,0610 sobre 56 de 78 ofertas.
3. **Coolify configurado**: env var `CRON_SECRET` criada (64 hex) e Scheduled
   Task `g2g-price-collect` ativa. A env var foi criada pelo Eloquent do próprio
   Coolify (`php artisan tinker`), **não por SQL** — o campo `value` é
   criptografado pelo Laravel (`eyJpdiI6...`) e texto puro quebraria.

## Pendências

1. **Deploy do código.** Nada foi commitado. A Scheduled Task já está ativa, mas
   a rota nova ainda não está no ar e o `CRON_SECRET` **só entra no container no
   redeploy** — até lá a task falha com 401/405. Ordem: commit → deploy → conferir
   a primeira execução.
2. **Revogar as chaves removidas** (Discord, OpenRouter, Gemini) nos provedores
   — apagar do `.env` não as invalida. Cópias seguem em `.env.bak-20260728` e
   `.env.pre-g2g-cleanup` (ambos agora ignorados pelo git).
3. **`/opt/poe-hub` na VPS não pode ser apagado.** Parece deploy abandonado
   (mtime de 07/jul, `Dockerfile.scraper`, 1,4 GB) e o Coolify não o usa — mas o
   `poe-hub-ws.service` roda de dentro dele
   (`ExecStart=/opt/poe-hub/node_modules/.bin/tsx scripts/monitor/ws-server.ts`),
   ativo desde 28/07 com 0 restarts. Uma limpeza ali derruba o WS server.
