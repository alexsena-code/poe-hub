# Runbook — deploy do módulo CX na mahou-vps

Deploy de produção do lado servidor do módulo CX: **ws-server** (systemd,
porta 8766), **Nginx WSS** em `ws.pathoftrade.net`, **observability**
(Prometheus + Grafana via compose) e **migrations** no Postgres de prod.
O **cx_executor continua no PC do operador** — só passa a apontar pro WSS
público.

Artefatos: `deploy/cx/` (unit, nginx conf, prometheus de prod, setup
idempotente). Referências: `docs/observability/cx-metrics.md`,
`docs/security/db-hardening.md`.

## Topologia alvo

```
PC do operador                     mahou-vps (77.42.47.106)              Vercel
┌──────────────┐   wss (443)   ┌──────────────────────────────┐   ┌────────────┐
│ cx_executor  ├──────────────►│ Nginx ws.pathoftrade.net     │   │ poe-hub    │
│ (+ plugin)   │               │   └► ws-server :8766 (sysd)  │◄──┤ (browser do│
└──────────────┘               │        │ DATABASE_URL        │   │  usuário   │
                               │        ▼                     │   │  conecta   │
                               │ poe-postgres (docker, poth)  │   │  no wss)   │
                               │ Prometheus/Grafana (compose, │   └────────────┘
                               │  127.0.0.1 + túnel SSH)      │
                               └──────────────────────────────┘
```

## 0. Pré-requisitos e decisões do operador

Antes de começar, tenha em mãos / decida:

| Item | Valor sugerido | Observação |
| --- | --- | --- |
| Subdomínio do WSS | `ws.pathoftrade.net` | pode trocar via `DOMAIN=` no setup |
| Usuário de serviço na VPS | `poehub` (criado pelo setup) | alternativa: `RUN_USER=root` (padrão do poe-hub-bot, menos seguro) |
| Branch a deployar | `main` (após merge do `feat/cx-management`) | `BRANCH=feat/cx-management` pra validar antes do merge |
| Senha do `poth_app` | a mesma que está na Vercel (`DATABASE_URL`) | vai no `.env.ws` |
| Senha nova do Grafana | gerar (forte) | trocar o `admin/admin` do compose |
| Senha do role `cx_grafana` | gerar (forte) | user read-only do Postgres |
| SSH | alias `mahou-vps` (chave `~/.ssh/mahou_vps_ed25519`) | já configurado |

Na VPS já existem: Docker (`poe-postgres` etc.), Nginx, PM2/systemd, e o
repo em `/opt/poe-hub` (com `.env` **STALE** — não use os valores dele).

**Rollback geral**: cada passo abaixo tem um bloco *Rollback*. Nenhum passo
mexe no que já roda hoje (front na Vercel, worker cxapi, poe-postgres) até
o passo 9 (Vercel) e 10 (secrets) — até lá, tudo é adição.

## 1. Gerar o token de produção

No seu terminal (qualquer máquina):

```bash
openssl rand -hex 32
```

Guarde no gerenciador de senhas. Esse **único** token é usado em 3 lugares:

1. `CX_WS_TOKEN` no `/opt/poe-hub/.env.ws` (ws-server);
2. `--token` do cx_executor no PC (ou env `CX_WS_TOKEN` lá);
3. `credentials:` do `prometheus.yml` da VPS (passo 7).

*Rollback / rotação*: gerar outro token e trocar nos 3 lugares +
`systemctl restart poe-hub-ws`. Executores com token velho caem com
código 4001.

## 2. DNS do subdomínio

No provedor DNS do `pathoftrade.net`, crie o registro:

```
ws.pathoftrade.net.  A  77.42.47.106
```

Confirme antes de seguir (o certbot do passo 6 depende disso):

```bash
dig +short ws.pathoftrade.net   # deve devolver 77.42.47.106
```

*Rollback*: apagar o registro A.

## 3. Rodar o setup na VPS

```bash
ssh mahou-vps
sudo BRANCH=main bash /opt/poe-hub/deploy/cx/setup-vps.sh
```

(Se a branch com `deploy/cx/` ainda não estiver na VPS, faça antes um
`cd /opt/poe-hub && git fetch && git checkout <branch> && git pull`.)

O script é idempotente e faz: usuário `poehub`, `git pull`, `npm ci`
(com devDeps — o ws-server roda com o **tsx** do repo, sem build; decisão
documentada no cabeçalho de `deploy/cx/poe-hub-ws.service`), cria
`/opt/poe-hub/.env.ws` de exemplo, instala unit + nginx conf (com backup
`.bak.<timestamp>` dos anteriores) e habilita o serviço. Ele **não inicia**
o serviço enquanto o `.env.ws` tiver placeholder.

*Rollback*: `systemctl disable --now poe-hub-ws`, restaurar os `.bak.*`
de `/etc/systemd/system/poe-hub-ws.service` e
`/etc/nginx/sites-available/ws.pathoftrade.net` (ou remover conf+symlink e
`nginx -t && systemctl reload nginx`). O repo volta com
`git -C /opt/poe-hub checkout <commit anterior>`.

## 4. Migrations do Prisma no Postgres de prod

**Não use `prisma migrate deploy` via TCP** — a senha real do superuser
`poe` não está disponível (o `.env` de `/opt/poe-hub` está stale) e o
`pg_hba` restringe o `poe` à rede Docker; a conexão falha com P1000. O
caminho comprovado é o **socket local via `docker exec`** (trust, sem
senha), registrando o histórico na mão. Se preferir túnel SSH com
`prisma migrate deploy`, precisaria da senha do `poe` — hoje não é opção.

4.1. Veja o que falta aplicar:

```bash
ssh mahou-vps
cd /opt/poe-hub && git pull
docker exec poe-postgres psql -U poe -d poth \
  -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at;"
ls prisma/migrations/
```

Esperado pendente neste deploy: `20260704094608_add_cx_management`
(as de 2026-07-02, `add_cx_fills` e `add_cx_market_signals`, já foram
aplicadas no deploy anterior).

4.2. Aplique cada migration pendente `M` (transação única, para no erro):

```bash
M=20260704094608_add_cx_management
docker exec -i poe-postgres psql -U poe -d poth -1 -v ON_ERROR_STOP=1 \
  < prisma/migrations/$M/migration.sql
```

4.3. Registre no histórico do Prisma — o **checksum é o `sha256sum` do
`migration.sql`** (o Prisma valida isso byte a byte):

```bash
SHA=$(sha256sum prisma/migrations/$M/migration.sql | cut -d' ' -f1)
docker exec poe-postgres psql -U poe -d poth -c "INSERT INTO _prisma_migrations \
  (id, checksum, finished_at, migration_name, started_at, applied_steps_count) \
  VALUES (gen_random_uuid()::text, '$SHA', now(), '$M', now(), 1);"
```

4.4. **Default privileges**: não precisa de GRANT manual — existe
`ALTER DEFAULT PRIVILEGES` que dá CRUD ao `poth_app` em tabelas novas
criadas pelo `poe`. **Confirme** (deve aparecer `poth_app=arwd/poe`):

```bash
docker exec poe-postgres psql -U poe -d poth -c '\dp cx_job'
```

Se não aparecer (migration rodada com outro user, por ex.), corrija:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO poth_app;
```

*Rollback*: as tabelas novas são aditivas — `DROP TABLE` das tabelas da
migration (ver o `migration.sql`: `cx_executor`, `cx_job`, `cx_params`,
`cx_log`, `cx_decision_log`, …) e `DELETE FROM _prisma_migrations WHERE
migration_name = '<M>';`. Nada do app antigo depende delas.

## 5. Configurar e subir o ws-server

5.1. Edite `/opt/poe-hub/.env.ws` (root, `chmod 640 root:poehub`):

```
CX_WS_TOKEN=<token do passo 1>
DATABASE_URL=postgresql://poth_app:<senha>@127.0.0.1:5432/poth
MONITOR_WS_PORT=8766
```

Defina **todas** as chaves no `.env.ws`: o ws-server também carrega o
`.env` (dotenv) do diretório, que está stale — o `EnvironmentFile` do
systemd vence, mas só pras chaves definidas nele.

5.2. Suba e verifique:

```bash
systemctl restart poe-hub-ws
journalctl -u poe-hub-ws -n 20 --no-pager
```

No log **não** pode aparecer o aviso `CX_WS_TOKEN não setada`. Teste o
/metrics localmente (na VPS):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8766/metrics                 # 401
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:8766/metrics | head -n 5   # 200
```

*Rollback*: `systemctl disable --now poe-hub-ws`.

## 6. Nginx + Certbot (WSS público)

O server block já foi instalado no passo 3. Emita o certificado:

```bash
certbot --nginx -d ws.pathoftrade.net
nginx -t && systemctl reload nginx
```

Verifique de FORA da VPS (PC do operador):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://ws.pathoftrade.net/metrics   # 403 (negado no Nginx)
curl -s -o /dev/null -w '%{http_code}\n' https://ws.pathoftrade.net/          # 404
# handshake WS (426/400/101 = chegou no ws-server; connection refused = problema)
curl -si https://ws.pathoftrade.net/ws/dashboard -H 'Upgrade: websocket' \
  -H 'Connection: upgrade' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGVzdA==' | head -n 1
```

*Rollback*: `certbot delete --cert-name ws.pathoftrade.net`; remover
`/etc/nginx/sites-enabled/ws.pathoftrade.net` e recarregar o nginx.

## 7. Observability (Prometheus + Grafana)

7.1. Config do Prometheus com o token (fica só na VPS, **não commitar**):

```bash
cd /opt/poe-hub
cp deploy/cx/prometheus-prod.yml observability/prometheus/prometheus.yml
sed -i 's/TROQUE_PELO_CX_WS_TOKEN/<token do passo 1>/' observability/prometheus/prometheus.yml
```

7.2. Usuário read-only do Postgres pro Grafana (socket, como no passo 4):

```bash
docker exec poe-postgres psql -U poe -d poth <<'SQL'
CREATE ROLE cx_grafana LOGIN PASSWORD '<senha-forte-do-passo-0>';
GRANT CONNECT ON DATABASE poth TO cx_grafana;
GRANT USAGE ON SCHEMA public TO cx_grafana;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cx_grafana;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cx_grafana;
SQL
```

(Se o role já existir, use `ALTER ROLE cx_grafana PASSWORD '...'`.)

7.3. Envs do compose — crie `observability/.env` (não commitar) ao lado do
compose ou exporte antes do `up`:

```bash
cat > observability/.env <<'EOF'
CX_PG_USER=cx_grafana
CX_PG_PASSWORD=<senha do cx_grafana>
CX_PG_DB=poth
EOF
docker compose -f observability/docker-compose.observability.yml \
  --env-file observability/.env up -d
```

7.4. Troque a senha do Grafana (o compose sobe `admin/admin` — só
tolerável porque a porta é 127.0.0.1): primeiro login em `:3001` via
túnel pede a troca, ou `docker exec cx-grafana grafana cli admin
reset-admin-password '<senha nova>'`.

7.5. Verifique via túnel SSH (as portas 9090/3001 são 127.0.0.1 de
propósito — NÃO publique):

```bash
ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 mahou-vps
# browser: http://localhost:9090/targets  → job cx-ws-server UP
#          http://localhost:3001          → pasta CX (Trading / Execução)
```

*Rollback*: `docker compose -f observability/docker-compose.observability.yml
down` (dados ficam nos volumes; `down -v` apaga). `DROP ROLE cx_grafana;`
se quiser reverter o role (antes: `DROP OWNED BY cx_grafana;`).

## 8. Executor no PC do operador

No PC (onde rodam plugin + bridge), aponte pro WSS público:

```powershell
python executor\cx_executor.py `
  --server wss://ws.pathoftrade.net/ws/executor `
  --token <token do passo 1> `
  --fills "C:\...\currency_exchange_fills.ndjson"
```

(ou envs `CX_WS_SERVER` / `CX_WS_TOKEN`, que são os defaults dos flags.)
No log do executor deve aparecer o register aceito; token errado = close
4001. *Rollback*: voltar `--server` pro endpoint antigo (ngrok/local).

## 9. Front na Vercel

No projeto poe-hub da Vercel (Settings → Environment Variables, Production):

```
NEXT_PUBLIC_MONITOR_WS_URL=wss://ws.pathoftrade.net/ws/dashboard
```

Remova o valor antigo do ngrok e **redeploye** (env `NEXT_PUBLIC_*` é
inlined no build). *Rollback*: restaurar o valor anterior + redeploy.

## 10. Migrar secrets da GGG na VPS (config.json → secrets.json)

O worker (cxw) na VPS ainda lê `client_id`/`client_secret` do
`config.json` (formato legado — compat mantida no `cxw/config.py`, com
prioridade env > `secrets.json` > `config.json`). Migre:

```bash
ssh mahou-vps
crontab -l | grep -i cx      # localiza o diretório do worker na VPS
cd <dir-do-worker>/worker    # onde está o config.json
# 1. cria o secrets.json com os MESMOS valores que estão no config.json
cat > secrets.json <<'EOF'
{
  "client_id": "<client_id da GGG>",
  "client_secret": "<client_secret da GGG>"
}
EOF
chmod 600 secrets.json
# 2. remove client_id/client_secret do config.json (edite na mão)
# 3. teste o poll manualmente (mesmo comando do cron) e confira o log
```

*Rollback*: recolocar as chaves no `config.json` (o `secrets.json`
sobrepõe, então só remova-o se as chaves estiverem erradas).

## 11. Verificação final (end-to-end)

1. **Serviço**: `systemctl status poe-hub-ws` ativo; `journalctl -u
   poe-hub-ws -f` sem erros de DB.
2. **Métricas via túnel**: `ssh -L 8766:127.0.0.1:8766 mahou-vps` e
   `curl -H "Authorization: Bearer <token>" http://localhost:8766/metrics`
   → deve listar `cx_ws_connections`, `cx_job_queue_depth`, …
3. **Prometheus**: target `cx-ws-server` UP (passo 7.5).
4. **Executor conectado**: gauge `cx_executors_online` = 1 no /metrics; no
   Grafana (CX Execução) o executor aparece online.
5. **Job pela UI**: no hub (Vercel), módulo CX → disparar um `read_state`
   pro executor → status do job vai `pending → sent → acked → done` e o
   resultado aparece. Isso valida UI → Postgres → ws-server → executor →
   plugin, o caminho inteiro.
6. **Dashboard WS**: página do monitor no hub conecta (sem erro de WS no
   console do browser) — valida o `NEXT_PUBLIC_MONITOR_WS_URL`.

## 12. Checklist de segurança

- [ ] **Token forte** (`openssl rand -hex 32`), guardado em gerenciador de
      senhas; nunca em commit (o `prometheus.yml` da VPS e o `.env.ws`
      ficam fora do git — o de dev local também não deve ser commitado).
- [ ] **Porta 8766 NUNCA exposta**: o ws-server escuta em `0.0.0.0` (o
      código não tem bind configurável) — o firewall é OBRIGATÓRIO.
      Confira `ufw status` (e o firewall da Hetzner Cloud, se houver):
      públicas só **80/443** (+ SSH). Teste de fora:
      `curl -m 5 http://77.42.47.106:8766/metrics` deve dar timeout/refused.
- [ ] **/metrics não-público**: 403 no Nginx (teste do passo 6); acesso
      humano só por túnel SSH; Prometheus scrapa direto na 8766 local.
- [ ] **Grafana**: senha do admin trocada (nada de `admin/admin`), porta
      127.0.0.1 + túnel SSH (não publicar no Nginx sem auth extra),
      `GF_USERS_ALLOW_SIGN_UP=false` (já é o default do compose).
- [ ] **Postgres**: Grafana usa o role **read-only** `cx_grafana` (nunca
      `poth_app`/`poe`); ws-server usa `poth_app` (CRUD, sem DDL).
- [ ] **.env.ws** com `chmod 640 root:poehub`; `secrets.json` do worker
      com `chmod 600`.
- [ ] **Ciente**: `/ws/dashboard` e `/ws/agent` não têm auth (por design —
      o browser conecta direto). O que eles expõem são logs/telemetria dos
      bots; comandos de executor (canal `/ws/executor`) exigem token. Se
      isso incomodar, é trabalho futuro (token de dashboard).

## Apêndice — arquivos deste deploy

| Arquivo | Papel |
| --- | --- |
| `deploy/cx/poe-hub-ws.service` | unit systemd (fonte; o setup ajusta o node path) |
| `deploy/cx/nginx-ws.conf` | server block WSS (fonte; o setup ajusta o domínio) |
| `deploy/cx/setup-vps.sh` | instalação/atualização idempotente na VPS |
| `deploy/cx/prometheus-prod.yml` | prometheus.yml de prod (placeholder de token) |
| `observability/docker-compose.observability.yml` | stack Prometheus + Grafana |
| `docs/observability/cx-metrics.md` | contrato de métricas + operação |
