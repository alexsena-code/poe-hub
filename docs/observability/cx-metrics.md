# Observabilidade do módulo CX — métricas, mensagens e operação

Stack: **prom-client** no ws-server (`GET /metrics` na porta 8766) →
**Prometheus** (scrape 15s) → **Grafana** (dashboards *CX Trading* e
*CX Execução*). Infra como código em `observability/`.

## Endpoint /metrics

- URL: `http://<host>:8766/metrics` (mesma porta/servidor HTTP do WebSocket).
- Auth: o **mesmo `CX_WS_TOKEN`** do canal `/ws/executor`, via
  `?token=<tok>` ou `Authorization: Bearer <tok>`. Sem `CX_WS_TOKEN`
  setado no ws-server (dev), o endpoint fica aberto (mesmo comportamento
  do canal do executor — warning no boot).
- Formato: exposição Prometheus (`text/plain`), inclui as métricas default
  do processo Node (`process_*`, `nodejs_*`).

## Contrato das mensagens (executor → ws-server, canal /ws/executor)

### `metrics`

```json
{
  "type": "metrics",
  "executor_id": "DESKTOP-ABC-cx",
  "ts": "2026-07-04T12:00:00Z",
  "counters": [
    { "name": "cx_bridge_commands_total", "labels": { "cmd": "place", "status": "ok" }, "value": 132 }
  ],
  "gauges": [
    { "name": "cx_slots_open", "labels": {}, "value": 7 }
  ]
}
```

Regras de ingestão:

- **Nome** precisa casar `^[a-z_][a-z0-9_]*$`; caso contrário a amostra é
  descartada (warning no log do ws-server).
- **Labels extras injetadas**: toda série remota ganha
  `{executor_id, league}` (league vem do `register` do executor; `""` se
  desconhecida). O executor **não** consegue sobrescrever essas duas.
- **Cap de 100 séries por executor** (série = nome + conjunto de labels).
  Excedente é descartado com **1 warning** por executor (sem spam).
  Séries já conhecidas continuam atualizáveis mesmo com o cap cheio.
- **Counters remotos são cumulative-gauge**: chegam como valor ACUMULADO
  do processo do executor e são representados no prom como `Gauge` (set),
  mantendo o sufixo `_total` no nome. Na prática nada muda pro PromQL:
  `rate()` / `increase()` funcionam igual (inclusive no reset quando o
  processo do executor reinicia).
- O primeiro sample de um nome define o conjunto de labels daquele nome;
  samples posteriores são projetados nesse conjunto (label faltante = `""`).

### `decision`

```json
{
  "type": "decision",
  "executor_id": "DESKTOP-ABC-cx",
  "ts": "2026-07-04T12:00:00Z",
  "source": "rule",
  "mode": "semi",
  "item": "Orb of Annulment",
  "league": "Mercenaries",
  "action": "place_sell",
  "reason": "spread 8.2% > min 5%, fila < 2x qty",
  "snapshot": { "fair": 12.4, "best_bid": 12.0, "best_ask": 13.1 }
}
```

- `action` é obrigatório; `source` default `rule`; `mode` default `unknown`.
- Vira **INSERT em `cx_decision_log`** (executorId da conexão; `mode` não
  tem coluna própria — é mesclado dentro do `snapshot` persistido) e
  incrementa `cx_decisions_total{action,mode}`.

## Métricas próprias do hub (ws-server)

| Métrica | Tipo | Labels | Significado |
| --- | --- | --- | --- |
| `cx_ws_connections` | gauge | `path` | Conexões WS abertas por path (`/ws/agent`, `/ws/executor`, `/ws/dashboard`) |
| `cx_executors_online` | gauge | — | Executores CX com presença online |
| `cx_job_queue_depth` | gauge | `status` | Fila `cx_job` por status (`pending/sent/acked/done/failed/expired`), poll de 15s no Postgres |
| `cx_job_latency_seconds` | histogram | — | `doneAt - createdAt` do job, observado no `command_ack` done/failed; buckets `[1,2,5,10,30,60,120,300]` |
| `cx_fill_reports_total` | counter | `side` | `fill_report` aplicados com sucesso, por lado (`buy`/`sell`) |
| `cx_ws_messages_total` | counter | `type` | Mensagens recebidas no canal `/ws/executor`, por tipo (tipos desconhecidos = `unknown`) |
| `cx_decisions_total` | counter | `action`, `mode` | Decisões reportadas via mensagem `decision` |

## Métricas esperadas dos executores (via mensagem `metrics`)

Todas re-expostas com `{executor_id, league}`. Counters (`*_total`) são
cumulative-gauge (ver acima).

| Métrica | Tipo remoto | Labels | Significado |
| --- | --- | --- | --- |
| `cx_bridge_commands_total` | counter | `cmd`, `status` | Comandos do CX command bridge (open_cx/select/place/cancel/collect) por resultado |
| `cx_policy_decisions_total` | counter | `action` | Decisões da policy local do executor |
| `cx_slots_open` | gauge | — | Slots de ordem abertos no exchange |
| `cx_slots_max` | gauge | — | Máximo de slots configurado |
| `cx_orders_undercut` | gauge | — | Ordens nossas que foram undercut no book |
| `cx_stock_items_without_sell` | gauge | — | Itens em estoque sem ordem SELL postada |
| `cx_inventory_pct` | gauge | — | Ocupação do inventário (%) |
| `cx_plan_age_seconds` | gauge | — | Idade do `plan.json` (planner parado = valor cresce) |
| `cx_review_queue_depth` | gauge | — | Profundidade da fila de revisão (`pending_review.ndjson`) |

## Subir local (dev)

1. ws-server com token (PowerShell):

   ```powershell
   $env:CX_WS_TOKEN = "dev-token"
   npx tsx scripts/monitor/ws-server.ts
   ```

2. Troque `TROQUE_PELO_CX_WS_TOKEN` em
   `observability/prometheus/prometheus.yml` pelo mesmo valor.

3. Stack:

   ```powershell
   docker compose -f observability/docker-compose.observability.yml up -d
   ```

4. Cheque:
   - Prometheus: <http://localhost:9090/targets> — target `cx-ws-server`
     deve ficar **UP**.
   - Grafana: <http://localhost:3001> — login `admin`/`admin`, pasta
     **CX** com os dashboards *CX Trading* e *CX Execução*.
   - Direto no ws-server:
     `curl -H "Authorization: Bearer dev-token" http://localhost:8766/metrics`

O datasource Postgres do Grafana usa as envs `CX_PG_HOST/PORT/DB/USER/PASSWORD`
(defaults = `.env` de dev do hub: `poth:poth@host.docker.internal:5432/poth`).
Pra apontar pra outro banco, exporte as envs antes do `up` ou crie um `.env`
ao lado do compose.

## Subir na mahou-vps

O Docker já existe no host; o ws-server roda no host (fora do compose).

1. `git pull` no diretório do hub na VPS.
2. Garanta `CX_WS_TOKEN` no ambiente do ws-server (mesmo token que os
   executores usam — já é pré-requisito do canal `/ws/executor`).
3. Edite `observability/prometheus/prometheus.yml` na VPS com o token real.
   O target `host.docker.internal:8766` resolve pro host via
   `extra_hosts: host-gateway` (Linux) — não precisa mudar.
4. Datasource Postgres: crie um usuário read-only e exporte as envs antes
   do `up` (ou `.env` ao lado do compose):

   ```sql
   CREATE ROLE cx_grafana LOGIN PASSWORD '<senha-forte>';
   GRANT CONNECT ON DATABASE poth TO cx_grafana;
   GRANT USAGE ON SCHEMA public TO cx_grafana;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO cx_grafana;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cx_grafana;
   ```

   ```bash
   export CX_PG_USER=cx_grafana CX_PG_PASSWORD='<senha-forte>' CX_PG_DB=poth
   docker compose -f observability/docker-compose.observability.yml up -d
   ```

5. Acesso: as portas 9090/3001 ficam em `127.0.0.1` — use SSH tunnel
   (`ssh -L 3001:127.0.0.1:3001 mahou-vps`) ou publique o Grafana atrás
   do Nginx do host (padrão da VPS), com TLS.

## TODO — auth do Grafana em produção

O compose sobe com `admin`/`admin` (só aceitável porque a porta é
127.0.0.1). Antes de expor via Nginx:

- [ ] Trocar `GF_SECURITY_ADMIN_PASSWORD` (env no compose ou primeiro login).
- [ ] Desabilitar acesso anônimo (já é o default) e manter
      `GF_USERS_ALLOW_SIGN_UP=false`.
- [ ] Considerar auth no Nginx (basic auth/allowlist de IP) além do login
      do Grafana.
- [ ] Usuário Postgres read-only dedicado (receita acima) — nunca o user
      da aplicação.
