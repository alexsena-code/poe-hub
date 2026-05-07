# Observability — Setup na VPS

**Contexto:** VPS Hetzner CPX22 (4 vCPU, 8GB RAM) em `77.42.47.106`
rodando múltiplos processos heterogêneos:

- `poe-api` (NestJS) via PM2
- `hardware-deals` (FastAPI Python) — execução variável
- `poe-postgres` (Docker) e outros containers
- Cron jobs / processos systemd

**Objetivo:** ter um lugar único pra ver métricas, alertas, uptime e
(opcionalmente) logs sem precisar SSH em terminais separados.

**Stack escolhida:** self-host gratuito na própria VPS, dois containers
Docker pra começar (Netdata + Uptime Kuma), Loki/Grafana como Fase 2
opcional. Total esperado de RAM extra: ~150MB Fase 1, +250MB se Fase 2.

---

## Resumo de cobertura

| Sintoma                               | Ferramenta            | Fase |
|---------------------------------------|-----------------------|------|
| Métricas CPU/RAM/disco/rede           | Netdata               | 1    |
| Alertas crash/OOM/container down      | Netdata + Cloud free  | 1    |
| Uptime externo (`hub.pathoftrade.net`)| Uptime Kuma           | 1    |
| Logs centralizados searchable         | Loki + Grafana + Alloy| 2    |

---

## Fase 1 — Netdata + Uptime Kuma

### 1.1 Netdata (métricas + alertas)

Auto-discovery: detecta processos PM2, containers Docker, FastAPI,
systemd units e monta dashboards sozinho. Alertas built-in pra OOM, disk
full, container reiniciando, PM2 crash.

```bash
docker run -d --name netdata \
  --restart unless-stopped \
  -p 127.0.0.1:19999:19999 \
  -v netdataconfig:/etc/netdata \
  -v netdatalib:/var/lib/netdata \
  -v netdatacache:/var/cache/netdata \
  -v /etc/passwd:/host/etc/passwd:ro \
  -v /etc/group:/host/etc/group:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /etc/os-release:/host/etc/os-release:ro \
  -v /var/log:/host/var/log:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --cap-add SYS_PTRACE \
  --security-opt apparmor=unconfined \
  netdata/netdata
```

> **Por que `127.0.0.1:19999:19999` em vez de `19999:19999`:** bind só
> em loopback do host, **não expõe a porta na internet**. Acesso via SSH
> tunnel a partir da máquina local:
>
> ```bash
> ssh -L 19999:localhost:19999 root@77.42.47.106
> # Depois abre http://localhost:19999 no browser
> ```

#### Conectar ao Netdata Cloud (free, opcional)

Sem isso, dashboards funcionam mas alertas só ficam no painel local
(precisa estar olhando pra ver). Conectar dá:
- Notificações via Discord, Telegram, email, Slack
- Dashboard remoto sem SSH tunnel
- Múltiplas VPS no mesmo painel (futuro)

```bash
# 1. Cria conta em https://app.netdata.cloud (free, single user)
# 2. Settings → Spaces → Connect Nodes → copia o token + room ID
# 3. Roda dentro do container:
docker exec -it netdata netdata-claim.sh \
  -token=<TOKEN> \
  -rooms=<ROOM_ID> \
  -url=https://app.netdata.cloud
```

Depois no painel cloud → Notifications → adiciona Discord/Telegram
webhook. Alertas default já cobrem:

- PM2 process restart (>3 em 1h)
- Container Docker offline
- CPU > 90% sustained
- RAM > 85%
- Disk > 80% (filesystem `/`)
- Postgres conexões > 80% do max
- Network errors

Pra adicionar custom (ex: alerta se `poe-api` reiniciou nas últimas
10min), edita `health.d/*.conf` no volume `netdataconfig`.

### 1.2 Uptime Kuma (uptime externo)

Roda HTTP/TCP/ping checks contra serviços públicos. Dá status page +
alertas quando algo cai.

```bash
docker run -d --restart=always \
  -p 127.0.0.1:3001:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma louislam/uptime-kuma:1
```

Acesso via SSH tunnel:

```bash
ssh -L 3001:localhost:3001 root@77.42.47.106
# http://localhost:3001 — primeiro acesso cria a conta admin
```

**Monitors recomendados pra adicionar no painel:**

| Nome              | Tipo  | URL/Host                              | Intervalo |
|-------------------|-------|---------------------------------------|-----------|
| Hub (Vercel)      | HTTP  | `https://hub.pathoftrade.net`         | 60s       |
| Public site       | HTTP  | `https://pathoftrade.net`             | 60s       |
| Engine health     | HTTP  | `http://77.42.47.106:3000/health`     | 30s       |
| Postgres TCP      | TCP   | `77.42.47.106:5432`                   | 60s       |
| Hardware-deals    | HTTP  | `<URL local do hardware-deals>`       | 60s       |

**Notifications:** mesmo Discord/Telegram webhook usado no Netdata.
Settings → Notifications → Add → pega do gerenciador de webhooks.

### 1.3 Acesso permanente sem SSH tunnel (opcional)

Se SSH tunnel for chato dia a dia, dá pra colocar Nginx com basic auth
+ HTTPS via Caddy. Esboço:

```bash
# /etc/caddy/Caddyfile (já tendo Caddy instalado)
ops.pathoftrade.net {
  basicauth {
    operator <BCRYPT_HASH>
  }
  handle_path /netdata/* {
    reverse_proxy localhost:19999
  }
  handle_path /uptime/* {
    reverse_proxy localhost:3001
  }
}
```

Hash da senha: `caddy hash-password` (interativo).

> ⚠️ Postergar isso até a Fase 1 estabilizar. SSH tunnel funciona bem
> pra single operator e não amplia superfície de ataque.

---

## Fase 1 — Smoke test

Depois que ambos containers subirem:

```bash
# Containers running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
# Esperado: netdata + uptime-kuma listados como "Up"

# Netdata respondendo
curl -s http://localhost:19999/api/v1/info | head -5

# Uptime Kuma respondendo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
# Esperado: 200 ou 302
```

---

## Fase 2 — Logs centralizados (Loki + Grafana + Alloy)

> Adicionar **só depois** que Fase 1 estiver estável uma semana.
> Adicionar tudo de uma vez aumenta o risco de quebrar e te fazer
> abandonar.

**Stack:**

- **Loki** — armazena logs (storage: filesystem na própria VPS, retenção 30d default)
- **Grafana** — UI única pra queries de logs (`{app="poe-api"} |= "ERROR"`) e gráficos
- **Alloy** — agente que coleta logs de stdout do PM2, Docker, systemd journal e arquivos no host, manda pro Loki. Sucessor do Promtail/Grafana Agent

### 2.1 docker-compose.yml esboço

Salva em `/opt/observability/docker-compose.yml`:

```yaml
services:
  loki:
    image: grafana/loki:3.2.0
    container_name: loki
    restart: unless-stopped
    ports:
      - "127.0.0.1:3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  grafana:
    image: grafana/grafana:11.3.0
    container_name: grafana
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<GERAR>
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana

  alloy:
    image: grafana/alloy:v1.5.0
    container_name: alloy
    restart: unless-stopped
    volumes:
      - ./alloy-config.alloy:/etc/alloy/config.alloy:ro
      - /var/log:/var/log:ro
      - /opt/poetrade-content/logs:/var/log/poe-api:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: run /etc/alloy/config.alloy --server.http.listen-addr=0.0.0.0:12345

volumes:
  loki-data:
  grafana-data:
```

> ⚠️ Conflito de porta: Grafana usa 3000 por padrão, mas o engine
> `poe-api` também roda em 3000. Trocar uma das duas — sugestão é
> Grafana ir pra 3030 (ajusta no `ports:`).

### 2.2 Fontes de log a configurar no Alloy

```alloy
// PM2 logs (já estão em arquivo)
loki.source.file "pm2_poe_api" {
  targets = [
    { __path__ = "/var/log/poe-api/poe-api-out.log", app = "poe-api", stream = "stdout" },
    { __path__ = "/var/log/poe-api/poe-api-error.log", app = "poe-api", stream = "stderr" },
  ]
  forward_to = [loki.write.local.receiver]
}

// Docker containers (auto-discovery)
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

loki.source.docker "docker_logs" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.docker.containers.targets
  forward_to = [loki.write.local.receiver]
}

// systemd journal (hardware-deals, cron)
loki.source.journal "systemd" {
  forward_to = [loki.write.local.receiver]
  labels     = { source = "systemd" }
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

### 2.3 Datasource + dashboards no Grafana

1. Login (`admin` + senha do `GF_SECURITY_ADMIN_PASSWORD`)
2. Connections → Data sources → Add → Loki → URL `http://loki:3100`
3. Explore → seleciona Loki → query `{app="poe-api"} |= "ERROR"`
4. Importar dashboards prontos:
   - ID 13639 — Logs / App
   - ID 16966 — Docker Logs (Loki)

### 2.4 Queries úteis pra ter à mão

```logql
# Tudo do engine nas últimas 24h
{app="poe-api"}

# Só erros do Prisma
{app="poe-api"} |~ "PrismaClient.*Error"

# Crash loops (start sequence)
{app="poe-api"} |= "Nest application successfully started"

# Tentativas falhas de auth no Postgres
{container="poe-postgres"} |= "FATAL: password authentication failed"

# Slow queries Prisma (>1s)
{app="poe-api"} |~ "duration: \\d{4,}ms"
```

---

## Mantenimento

### Backup dos volumes

Os volumes Docker contêm config + histórico:
- `netdataconfig`, `netdatalib`, `netdatacache`
- `uptime-kuma`
- `loki-data`, `grafana-data` (Fase 2)

Backup mínimo (snapshot de config — métricas históricas são caras de
preservar e raramente vale a pena):

```bash
docker run --rm \
  -v uptime-kuma:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/uptime-kuma-$(date +%Y%m%d).tar.gz -C /data .
```

### Updates

```bash
docker pull netdata/netdata && docker stop netdata && docker rm netdata
# ... e roda o `docker run` original de novo
```

Pode ser scriptado, mas pra single operator manual é OK (1×/mês).

### Custo de RAM observado

Estimativa baseada em deploys similares:

| Container       | RAM idle | RAM peak |
|-----------------|----------|----------|
| Netdata         | 60-100MB | 200MB    |
| Uptime Kuma     | 40-60MB  | 100MB    |
| Loki (Fase 2)   | 80-120MB | 250MB    |
| Grafana (Fase 2)| 70-100MB | 200MB    |
| Alloy (Fase 2)  | 50-80MB  | 150MB    |

Total Fase 1: ~150MB. Total Fase 1+2: ~400MB. Em 8GB de RAM da VPS,
folgado.

### Quando reavaliar

- Se a VPS começar a ficar sem RAM (Netdata vai te avisar)
- Se logs explodirem em volume (>5GB/dia) — Loki precisa retention
  policy mais agressiva
- Se quiser retenção >30d de logs — migrar storage de filesystem pra
  S3/MinIO

---

## Troubleshooting

### Netdata não detecta meu app PM2

Auto-discovery do Netdata olha processos do host via `--cap-add
SYS_PTRACE`. Confirma que o container tem essa cap:

```bash
docker inspect netdata --format '{{ .HostConfig.CapAdd }}'
# Esperado: [SYS_PTRACE]
```

Se PM2 ainda não aparece, força refresh:

```bash
docker exec netdata netdatacli reload-health
```

### Uptime Kuma não consegue testar `localhost:5432`

O container só vê seu próprio loopback, não da host. Use `tcp://172.17.0.1:5432` (gateway docker) ou `tcp://77.42.47.106:5432` (IP público).

### Alertas do Netdata Cloud não chegam no Discord

Webhook URL precisa do formato completo:
`https://discord.com/api/webhooks/<id>/<token>`. Test direto:

```bash
curl -H "Content-Type: application/json" \
  -X POST -d '{"content":"test"}' \
  https://discord.com/api/webhooks/<id>/<token>
```

Se chegar, é problema de config no Cloud — re-cola a URL.
