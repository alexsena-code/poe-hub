# Observability — Setup na VPS

**Contexto:** VPS Hetzner CPX22 (4 vCPU, 8GB RAM) em `77.42.47.106`
rodando múltiplos processos heterogêneos:

- `poe-api` (NestJS) via PM2
- `hardware-deals` (FastAPI Python) — execução variável
- `poe-postgres`, `poe-redis`, `poe-qdrant`, `poe-searxng`, `bgutil-pot`
  e outros containers Docker
- Cron jobs / processos systemd

**Objetivo:** ter um lugar único pra ver métricas e alertas dos
processos, sem precisar SSH em terminais separados.

**Stack escolhida:** Beszel (single tool, UI moderna). Free, OSS, ~50MB
RAM total. Loki/Grafana como Fase 2 opcional pra logs centralizados.

---

## Fase 1 — Beszel

UI moderna em React/Tailwind, dashboards bonitos out of the box pra
host + Docker containers. Dois componentes:

- **Beszel Hub** — UI web (1 container)
- **Beszel Agent** — coleta métricas do host real, expõe pra hub
  (1 container, `--network host`)

### 1.1 Subir o hub

```bash
docker run -d --restart=unless-stopped \
  -p 127.0.0.1:8090:8090 \
  -v beszel_data:/beszel_data \
  --name beszel \
  henrygd/beszel
```

> **Por que `127.0.0.1:8090:8090`:** bind só em loopback, **não expõe a
> porta na internet**. Acesso via SSH tunnel a partir da máquina local:
>
> ```bash
> ssh -L 8090:localhost:8090 root@77.42.47.106
> # Depois abre http://localhost:8090 no browser
> ```

Primeiro acesso: cria conta admin (email + senha forte). Salva no
gerenciador de senhas.

### 1.2 Adicionar a VPS como "system"

No painel Beszel:

1. Botão `+ Add System` (canto superior direito)
2. Nome: `poe-hub-vps` (ou qualquer outro identificador)
3. Host/IP: `host.docker.internal` ou `172.17.0.1` (gateway docker —
   o agent vai rodar fora do container hub via `--network host`)
4. Porta: `45876` (default)
5. Submit — vai aparecer um **Public Key** longa. Copia tudo.

### 1.3 Subir o agent na mesma VPS

```bash
docker run -d --restart=unless-stopped \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e PORT=45876 \
  -e KEY="<COLE_AQUI_A_PUBLIC_KEY>" \
  --name beszel-agent \
  henrygd/beszel-agent
```

> `--network host` é crítico — o agent precisa medir métricas do host
> real (CPU/RAM/disk/network), não da network namespace do container.
> O mount do `docker.sock` permite ele descobrir e monitorar
> automaticamente todos os containers Docker.

Após ~30s, o status do system muda de "Pending" pra "Up" no painel.
A partir daí o dashboard começa a popular com:

- CPU, RAM, swap, disk usage do host
- Throughput de rede
- Lista de containers Docker com CPU/RAM individual
- Top processes por consumo

### 1.4 Configurar alertas

No painel Beszel, dentro de cada system:

1. Botão `Alerts`
2. Configura thresholds (CPU > X%, disk > Y%, container down, etc)
3. **Notification settings** — adiciona webhook do Discord, Telegram
   ou SMTP

URL do webhook do Discord:
`https://discord.com/api/webhooks/<id>/<token>`. Test direto:

```bash
curl -H "Content-Type: application/json" \
  -X POST -d '{"content":"test"}' \
  https://discord.com/api/webhooks/<id>/<token>
```

**Alertas recomendados pra esse setup:**

| Alerta              | Threshold        | Por quê                          |
|---------------------|------------------|----------------------------------|
| CPU sustained       | > 80% por 10min  | Pega processo runaway            |
| Memory              | > 85%            | Antes do OOM kill                |
| Disk `/`            | > 80%            | Antes de encher                  |
| Container down      | qualquer         | `bgutil-pot` já estava unhealthy |
| Container restart   | > 3 em 1h        | Crash loop como o do session 21  |

### 1.5 Smoke test

```bash
docker ps --filter name=beszel --format "table {{.Names}}\t{{.Status}}"
# Esperado:
# beszel         Up Xm
# beszel-agent   Up Xm
```

E no dashboard, depois de ~1min, todos os containers Docker devem
aparecer listados com métricas em real-time.

---

## Fase 2 — Logs centralizados (opcional, postergada)

**Quando adicionar:** quando você sentir saudade de `tail -f` em
vários terminais. Beszel não cobre logs centralizados, só métricas.

**Stack:**

- **Loki** — armazena logs (storage filesystem, retenção 30d default)
- **Grafana** — UI pra queries (`{app="poe-api"} |= "ERROR"`)
- **Alloy** — agente que coleta logs de PM2 files, Docker socket,
  systemd journal e manda pro Loki

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
      - "127.0.0.1:3030:3000"   # 3030 host → 3000 container (engine usa 3000)
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

### 2.2 Fontes de log a configurar no Alloy

```alloy
// PM2 logs
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

### 2.3 Queries úteis no Grafana

```logql
# Tudo do engine nas últimas 24h
{app="poe-api"}

# Só erros do Prisma
{app="poe-api"} |~ "PrismaClient.*Error"

# Crash loops (start sequence)
{app="poe-api"} |= "Nest application successfully started"

# Auth fails no Postgres
{container="poe-postgres"} |= "FATAL: password authentication failed"

# Slow queries Prisma (>1s)
{app="poe-api"} |~ "duration: \\d{4,}ms"
```

---

## Manutenção

### Updates

```bash
# Beszel hub
docker pull henrygd/beszel
docker stop beszel && docker rm beszel
# ... e roda o `docker run` original

# Beszel agent
docker pull henrygd/beszel-agent
docker stop beszel-agent && docker rm beszel-agent
# ... e roda o `docker run` original
```

Pra single operator, manual é OK (1×/mês).

### Backup do volume

O volume `beszel_data` contém config, accounts, alertas, histórico de
métricas (SQLite interno).

```bash
docker run --rm \
  -v beszel_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/beszel-$(date +%Y%m%d).tar.gz -C /data .
```

### Custo de RAM observado

| Container       | RAM idle | RAM peak |
|-----------------|----------|----------|
| beszel (hub)    | 30-50MB  | 100MB    |
| beszel-agent    | 15-25MB  | 50MB     |
| Loki (Fase 2)   | 80-120MB | 250MB    |
| Grafana (Fase 2)| 70-100MB | 200MB    |
| Alloy (Fase 2)  | 50-80MB  | 150MB    |

Total Fase 1: ~50MB. Total Fase 1+2: ~300MB. Em 8GB de RAM da VPS,
folgado.

### Quando reavaliar

- Se a VPS começar a ficar sem RAM (Beszel vai te avisar via alerta)
- Se logs explodirem em volume (>5GB/dia) — Loki precisa retention
  policy mais agressiva
- Se quiser retenção >30d de logs — migrar storage de filesystem pra
  S3/MinIO

---

## Alternativas consideradas

Avaliadas e rejeitadas pra esse use case:

| Ferramenta    | Por que não                                                  |
|---------------|--------------------------------------------------------------|
| **Netdata**   | UI datada (do começo dos anos 2010), embora funcionalmente sólido. Beszel cobre o mesmo escopo com UI moderna |
| **Uptime Kuma** | Útil pra uptime externo, mas escopo diferente do Beszel (probes HTTP/TCP de fora). Deixar como TODO se quiser monitorar Vercel/DNS/SSL externamente. Idealmente roda em outra VPS pra detectar quando a principal cair |
| **Coolify**   | Self-hosted PaaS com monitoring built-in. Overkill — vem com deploy/build/terminals |
| **OpenObserve** | Logs+metrics+traces unificados, UI moderna. Mais pesado e foco em volumes maiores |
| **Grafana stack standalone** | Sem Beszel, viável mas requer mais setup (datasources, dashboards prontos, alertas) |

---

## Troubleshooting

### Agent não consegue conectar no hub

```bash
docker logs beszel-agent --tail 30
```

Se aparecer "connection refused": confirma que o hub está rodando
(`docker ps | grep beszel`) e que o KEY no agent é exatamente o que
o hub gerou (sem espaços extras).

### Beszel dashboard mostra "0 systems"

O agent precisa ter `--network host` e o `KEY` correto. Testa
manualmente:

```bash
docker exec beszel-agent env | grep KEY
# Compara com o que aparece no hub: Settings → System → Public Key
```

### Containers Docker não aparecem na lista

Confirma que o agent tem mount do socket:

```bash
docker inspect beszel-agent --format '{{ .HostConfig.Binds }}'
# Esperado: contém /var/run/docker.sock
```

### "host.docker.internal" não resolve

Em Linux, isso varia. Alternativas testadas:

- `host.docker.internal` — funciona em Docker Desktop, pode falhar em Linux puro
- `172.17.0.1` — gateway da default bridge network, sempre funciona
- IP da `docker0` interface — `ip -4 addr show docker0` pra confirmar
