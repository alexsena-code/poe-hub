# Discord Price Scraper

Pipeline automatizado para coletar preços de Divine/Mirror do Discord e armazenar no banco.

## Fluxo

```
Discord Sources (DB) → DiscordChatExporter CLI → Parser (LLM/regex) → PriceEntry (DB) → DailyPrice (DB)
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
   DATABASE_URL=postgresql://poth:poth@localhost:5432/poth
   ```
3. Cadastrar Discord Sources via UI em `/prices/sources` (ou seed)

---

## Execução Manual

### Pipeline completo (index.ts)

```bash
# Primeira execução — exporta todo o histórico
npx tsx scripts/discord-price-scraper/index.ts --full

# Execuções seguintes — só mensagens novas (incremental)
npx tsx scripts/discord-price-scraper/index.ts

# Especificar caminho do DCE manualmente
npx tsx scripts/discord-price-scraper/index.ts --dce-path /path/to/DiscordChatExporter.Cli.exe
```

### Cron runner (cron-runner.ts)

O `cron-runner.ts` é o ponto de entrada para o cron. Ele faz um preflight no banco,
invoca o pipeline completo como processo filho e registra início/fim com timestamps.

```bash
# Execução incremental (modo padrão)
npx tsx scripts/discord-price-scraper/cron-runner.ts

# Forçar histórico completo
npx tsx scripts/discord-price-scraper/cron-runner.ts --full
```

**Códigos de saída:**
- `0` — ciclo concluído com sucesso
- `1` — erro fatal (banco inacessível, nenhuma source ativa, etc.)

---

## Cron via Docker (recomendado)

O `docker-compose.yml` inclui o serviço `scraper` que usa supercronic para
executar o cron-runner dentro do container.

```bash
# Subir tudo (app + banco + scraper cron)
docker compose up -d

# Subir só o cron scraper (banco já rodando)
docker compose up -d scraper

# Ver logs do cron em tempo real
docker compose logs -f scraper

# Parar o cron
docker compose stop scraper
```

### Como funciona o cron no container

O `Dockerfile.scraper` instala [supercronic](https://github.com/aptible/supercronic),
um cron confiável para containers (sem syslog, sem PID 1 issues). A crontab é
gerada durante o build com o schedule configurado via build arg.

O schedule padrão é `*/30 * * * *` (a cada 30 minutos).

### Como mudar o schedule

**Opção 1 — Rebuild com build arg:**
```bash
docker compose build --build-arg CRON_SCHEDULE="0 * * * *" scraper
docker compose up -d scraper
```

**Opção 2 — Editar o `docker-compose.yml`:**
```yaml
scraper:
  build:
    args:
      CRON_SCHEDULE: "0 * * * *"   # a cada hora
```
Depois: `docker compose up -d --build scraper`

**Exemplos de schedule:**
| Schedule           | Significado            |
|--------------------|------------------------|
| `*/30 * * * *`     | A cada 30 minutos      |
| `0 * * * *`        | A cada hora            |
| `0 */2 * * *`      | A cada 2 horas         |
| `0 9,18 * * *`     | Às 9h e 18h            |

---

## Cron via sistema operacional (alternativo)

Use o script `scripts/run-scraper.sh` para adicionar ao crontab do sistema:

```bash
chmod +x scripts/run-scraper.sh

# Editar crontab
crontab -e

# Adicionar linha (a cada 30 minutos):
*/30 * * * * /absolute/path/to/poe-hub/scripts/run-scraper.sh >> /var/log/poe-scraper.log 2>&1
```

Os logs ficam em `/var/log/poe-scraper.log`. Cada ciclo imprime timestamps de
início e fim.

---

## Como funciona o pipeline

1. **Pre-flight** — verifica conectividade com o banco e conta sources ativas
2. **Lê Discord Sources** do banco (canais ativos + CNL author IDs)
3. **Para cada canal:**
   - Busca a data da última mensagem no banco
   - Chama o DiscordChatExporter com `--after <data>` (incremental)
   - Primeira vez sem dados: exporta histórico completo
   - Arquivo exportado é reutilizado se > 1MB (cache de sessão)
4. **Parser LLM** extrai preços das mensagens
5. **Liga** é resolvida automaticamente cruzando timestamp com datas das ligas
6. **Insert** em batch com `skipDuplicates` por `discord_message_id` (idempotente)
7. **Agrega** preços diários (mediana, média, min, max, CNL price, volume)

O script é **idempotente** — pode ser re-executado sem duplicar dados.

---

## DiscordChatExporter no Docker

O DCE é um binário externo (Windows `.exe` ou Linux binary). Dentro do container:

- Monte o binário do DCE como volume ou copie para dentro da imagem
- Configure `DCE_PATH` no `.env` apontando para o caminho dentro do container

Exemplo no `.env`:
```env
DCE_PATH=/tools/DiscordChatExporter.Cli
```

E no `docker-compose.yml`:
```yaml
scraper:
  volumes:
    - scraper_exports:/app/exports
    - /host/path/to/DiscordChatExporter.Cli:/tools/DiscordChatExporter.Cli:ro
```
