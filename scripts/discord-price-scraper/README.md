# Discord Price Scraper

Script CLI para coletar precos de Divine Orbs e outros itens a partir de exportacoes JSON do Discord (via DiscordChatExporter).

## Pre-requisitos

1. **Node.js 18+** e **npm** instalados
2. **DiscordChatExporter CLI** ([GitHub](https://github.com/Tyrrrz/DiscordChatExporter)) para exportar mensagens
3. **PostgreSQL** rodando com o schema do PoE HUB aplicado (`npx prisma migrate dev`)
4. Arquivo `.env` na raiz do projeto com `DATABASE_URL` configurado

## Configuracao

### 1. Configurar Discord Sources

Antes de rodar o scraper, cadastre os canais do Discord no PoE HUB:

- Acesse `/prices/sources` na interface web
- Adicione cada canal com: Server ID, Channel ID, e IDs dos autores CNL

### 2. Exportar mensagens do Discord

Use o DiscordChatExporter CLI para exportar mensagens em formato JSON:

```bash
# Exportar um canal especifico
DiscordChatExporter.Cli export \
  -t <DISCORD_TOKEN> \
  -c <CHANNEL_ID> \
  -f Json \
  -o ./exports/
```

Ou exporte manualmente e coloque os arquivos `.json` no diretorio `exports/`.

### 3. Rodar o scraper

```bash
# Usando o diretorio padrao (./exports/)
npx tsx scripts/discord-price-scraper/index.ts

# Especificando diretorio e liga
npx tsx scripts/discord-price-scraper/index.ts --exports-dir ./meus-exports --league "Settlers of Kalguur"

# Ver ajuda
npx tsx scripts/discord-price-scraper/index.ts --help
```

## Opcoes CLI

| Opcao | Alias | Descricao | Padrao |
|---|---|---|---|
| `--exports-dir` | `-d` | Diretorio com arquivos JSON exportados | `./exports` |
| `--league` | `-l` | Nome da liga para associar aos registros | `null` |
| `--help` | `-h` | Exibir ajuda | |

## Formato do JSON (DiscordChatExporter)

O scraper espera o formato JSON padrao do DiscordChatExporter:

```json
{
  "guild": { "id": "...", "name": "..." },
  "channel": { "id": "...", "name": "..." },
  "messages": [
    {
      "id": "123456789",
      "type": "Default",
      "timestamp": "2026-01-15T10:30:00+00:00",
      "content": "divine 4.50",
      "author": {
        "id": "987654321",
        "name": "trader123",
        "isBot": false
      }
    }
  ]
}
```

## Padroes de preco reconhecidos

O parser reconhece os seguintes formatos de mensagem:

| Formato | Moeda | Exemplo |
|---|---|---|
| `divine 4.50` | Divine | "divine 4.50", "divine: 4,50" |
| `4.50 divine` | Divine | "4.50 divines", "4,50 divine" |
| `4.5 div` | Divine | "4.5 div" |
| `chaos 450` | Chaos | "chaos 450", "chaos: 450" |
| `$4.50` | USD | "$4.50", "$ 4.50" |
| `USD 4.50` | USD | "usd: 4.50", "4.50 usd" |
| `R$25` | BRL | "R$25", "R$ 25.00" |
| `BRL 25` | BRL | "brl: 25", "25 brl" |

Mensagens de bots e mensagens do sistema sao ignoradas automaticamente.

## Idempotencia

O scraper usa `discord_message_id` como chave unica. Executar o mesmo export varias vezes nao cria duplicatas — registros existentes sao automaticamente ignorados via `skipDuplicates`.

## Automacao (Cron)

Para coleta automatica, configure um cron job:

```bash
# A cada 6 horas: exportar e processar
0 */6 * * * cd /opt/poe-hub && DiscordChatExporter.Cli export -t $DISCORD_TOKEN -c $CHANNEL_ID -f Json -o ./exports/ && npx tsx scripts/discord-price-scraper/index.ts --league "Current League"
```

## Saida de exemplo

```
=== Discord Price Scraper ===
Exports directory: /opt/poe-hub/exports
League: Settlers of Kalguur

Found 2 JSON file(s) to process.
Loaded 3 active Discord source(s) from database.

Processing: prices-divine-2026-01.json
  Parsed: 156 price entries, 42 skipped, 0 errors
  Inserted: 148 new, 8 duplicates skipped

Processing: prices-divine-2026-02.json
  Parsed: 203 price entries, 38 skipped, 1 errors
  ERROR: Error parsing message 999888777: Invalid price value: 0
  Inserted: 203 new, 0 duplicates skipped

=== Summary ===
Files processed:    2
New entries:        351
Duplicates skipped: 8
Messages skipped:   80
Errors:             1
```
