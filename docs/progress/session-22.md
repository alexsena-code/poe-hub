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

## Observações / known issues

- O modo `from-cache` ainda parseia via **Gemini** (precisa de
  `GEMINI_API_KEY`); o upload só substitui a etapa de coleta no Discord,
  não o parsing.
- Limite de upload 100MB; exports de canais muito ativos em histórico
  longo podem estourar — retorna 413 com mensagem clara.

## O que falta

- (Opcional) suportar upload de múltiplos canais numa tacada — hoje o
  import limpa exports antes de salvar, então é 1 arquivo por vez.
