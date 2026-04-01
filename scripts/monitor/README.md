# DPB Monitor

Monitoramento em tempo real dos bots DreamPoeBot integrado ao PoE HUB.

## Arquitetura

```
PC com DreamPoeBot
  └─ agent.py (Python) → WebSocket → ws://servidor:8766/ws/agent

Servidor PoE HUB
  ├─ Next.js (porta 3000) — UI + API REST
  └─ ws-server.ts (porta 8766) — WebSocket server
       ├─ Recebe logs dos agents
       ├─ Detecta alertas (stuck, hideout, loops, erros)
       ├─ Buffer de 300 logs por bot (em memoria)
       ├─ Salva alertas + status no PostgreSQL
       └─ Envia notificacoes Discord via webhook
```

## Setup

### 1. Servidor (WS Server)

```bash
# No mesmo servidor do PoE HUB
npx tsx scripts/monitor/ws-server.ts
```

Variáveis de ambiente opcionais no `.env`:
```
MONITOR_WS_PORT=8766
DISCORD_MONITOR_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 2. Agent (em cada PC com bots)

**Requisitos:** Python 3.8+, aiohttp, watchdog

```bash
pip install aiohttp watchdog
```

**Rodar:**
```bash
# Apontar pro servidor
python agent.py --server ws://IP_DO_SERVIDOR:8766/ws/agent --logs "C:\Users\SEU_USER\AppData\Local\DreamPoeBot\Logs"

# Com ngrok (HTTPS)
python agent.py --server wss://seu-tunnel.ngrok-free.app/ws/agent --logs "C:\...\Logs"

# Filtrar apenas logs recentes (ultimos 30 min)
python agent.py --server ws://IP:8766/ws/agent --logs "C:\...\Logs" --max-age 30
```

O agent automaticamente:
- Detecta todos os arquivos de log (.txt) no diretorio
- Extrai config_name, character_name, versao do bot
- Envia logs em tempo real via WebSocket (batches de 50 linhas)
- Reconecta automaticamente se perder conexao
- Envia heartbeat a cada 30 segundos

### 3. Dashboard

Acesse `http://servidor:3000/monitor` no PoE HUB.

## Alertas

| Tipo | Condicao | Severidade |
|------|----------|------------|
| **Erro** | Log level ERROR (exceto false positives) | high |
| **Keyword** | crash, banned, kicked, login failed, fatal | critical |
| **Loop** | Mesmo pattern 10x em 30s (stuck, vendor fail) | high |
| **Loop persistente** | Pattern 50x em 5min (walkable, pathfinding) | medium |
| **Hideout** | Bot no hideout >10 minutos | medium |
| **Inatividade** | Sem logs >5 minutos | high |

Alertas sao enviados pro Discord via webhook e salvos no banco.

## Vincular ao Bot cadastrado

Na pagina `/monitor`, cada instancia pode ser vinculada a um Bot do cadastro.
Isso permite cruzar dados de monitoramento com o cadastro de bots (nick, proxy, status).
