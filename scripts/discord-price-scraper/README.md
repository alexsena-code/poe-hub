# Discord Price Scraper

Pipeline automatizado para coletar preços de Divine/Mirror do Discord e armazenar no banco.

## Fluxo

```
Discord Sources (DB) → DiscordChatExporter CLI → Parser (regex) → PriceEntry (DB) → DailyPrice (DB)
                                                                    ↑
                                                              Liga resolvida
                                                            automaticamente
                                                            pela data + leagues
```

## Setup

1. Baixar [DiscordChatExporter CLI](https://github.com/Tyrrrz/DiscordChatExporter/releases)
2. Configurar `.env`:
   ```env
   DISCORD_TOKEN=<seu token do Discord>
   DCE_PATH=<caminho para DiscordChatExporter.Cli.exe>
   ```
3. Cadastrar Discord Sources (via UI em `/prices/sources` ou seed)

## Uso

```bash
# Primeira execução — exporta todo o histórico
npx tsx scripts/discord-price-scraper/index.ts --full

# Execuções seguintes — só mensagens novas (incremental)
npx tsx scripts/discord-price-scraper/index.ts

# Especificar caminho do DCE
npx tsx scripts/discord-price-scraper/index.ts --dce-path /path/to/DiscordChatExporter.Cli.exe
```

## Como funciona

1. **Lê Discord Sources** do banco (canais ativos + CNL author IDs)
2. **Para cada canal:**
   - Busca a data da última mensagem no banco
   - Chama o DiscordChatExporter com `--after <data>` (incremental)
   - Primeira vez: exporta histórico completo
3. **Parser** extrai preços das mensagens com regex calibrado
4. **Liga** é resolvida automaticamente cruzando timestamp com datas das ligas
5. **Insere** no banco com `skipDuplicates` (idempotente)
6. **Agrega** preços diários (mediana, média, min, max, CNL, volume)

## Cron

```bash
# A cada 1 hora
0 * * * * cd /path/to/poe-hub && npx tsx scripts/discord-price-scraper/index.ts >> /var/log/scraper.log 2>&1
```
