# Session 22 — Upload de JSON para histórico de preços

**Tema:** permitir popular o histórico de preços subindo um JSON do
DiscordChatExporter pela UI, reaproveitando o pipeline do scraper sem
precisar de `DISCORD_TOKEN` / DiscordChatExporter rodando localmente.

## Contexto

Hoje o histórico de preços vem do `scripts/discord-price-scraper`, que
roda DiscordChatExporter (CLI) → exporta JSON → parseia via Gemini →
grava `PriceEntry` → agrega `DailyPrice`. O operador queria poder subir
o JSON exportado manualmente e deixar o resto do pipeline rodar.

## Changelog

### Scraper — modo `--from-cache` (`scripts/discord-price-scraper/index.ts`)
- Novo flag `--from-cache`: pula o export do Discord (não exige
  `DISCORD_TOKEN` nem o DCE) e processa os JSONs já presentes em
  `exports/`, derivando `channel.id`/`name`/`guild` do próprio arquivo.
  Source do banco (quando existe) só fornece `cnlAuthorIds`.
- Lógica de parse+insert extraída para `processSingleExport()`,
  compartilhada entre o modo normal (export do Discord) e o `--from-cache`
  (sem duplicação). `poeVersion` derivado do channel name dentro dela.

### Endpoint de upload (`app/api/prices/import/route.ts` — novo)
- `POST` multipart campo `file`. Valida auth (`getServerSession`),
  tamanho (máx 100MB), JSON e shape do DiscordChatExporter
  (`{ guild.id, channel.id, messages[] }`).
- Limpa `.json` antigos de `exports/` (evita reparse de canais velhos =
  gasto de Gemini) e salva em `exports/<channel.id>.json`.
- Retorna `{ channelId, channelName, serverName, messages, savedAs }`.

### Scrape route (`app/api/prices/scrape/route.ts`)
- Aceita `fromCache: true` no body: não limpa o cache de exports e passa
  `--from-cache` ao scraper. Log inicial condicionado ao modo.

### UI (`app/(auth)/farm/prices/page.tsx`)
- Botão **"Subir JSON"** + input file oculto. Faz upload → dispara o
  processamento via `fromCache` → reusa o painel de logs SSE existente.
- Stream-reading SSE extraído para `consumeScrapeStream()`, compartilhado
  entre scrape normal e upload.

## Validação

- `npx tsc --noEmit` — sem erros nos arquivos tocados (erros restantes
  são pré-existentes em módulos não relacionados).
- `npx vitest run app/api/prices/import app/api/prices/scrape` — 17
  passando (13 scrape, incl. 2 novos de `fromCache`; 4 do import novo).
- `npx tsx scripts/discord-price-scraper/index.ts --help` — flag novo
  aparece.

## Parser migrado para OpenRouter (14/06/2026)

O parser LLM (`scripts/discord-price-scraper/llm-parser.ts`) usava o SDK
direto do Gemini (`@google/genai` + `GEMINI_API_KEY`), cujo **free tier
(10 req/min, 20 req/dia)** estourava no meio de um export (CONCURRENCY=10).
Trocado para **OpenRouter** (API OpenAI-compatible via `fetch`):

- `OPENROUTER_API_KEY` (mesma chave do engine), modelo
  `google/gemini-2.5-flash-lite` por padrão, override via `OPENROUTER_MODEL`.
- Custo ~$0.03 por export inteiro (~105 batches).
- Validação real: export poe2 de 28/05–14/06 (3202 msgs) processado
  **completo** em produção (`poth` na VPS) — 2823 preços parseados, 2483
  inseridos, 26 daily_prices; divine R$70 → R$0,50 ao longo da liga.

Contexto de infra (onde o hub roda, DB de produção) na memória do projeto
`project-hub-deploy-architecture`.

## Observações / known issues

- O hub roda local (ngrok), não na Vercel, para o scraping funcionar
  (filesystem + spawn + DiscordChatExporter.exe). O `.env` local aponta o
  `DATABASE_URL` para o Docker local; para gravar em produção, injetar a
  URL do `poth` da VPS no comando (feito assim no processamento acima).
- Limite de upload 100MB; exports muito longos podem estourar — 413 claro.

## O que falta

- (Opcional) suportar upload de múltiplos canais numa tacada — hoje o
  import limpa exports antes de salvar, então é 1 arquivo por vez.
