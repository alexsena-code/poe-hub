#!/usr/bin/env bash
# setup-vps.sh — instala/atualiza o ws-server do módulo CX na mahou-vps.
#
# IDEMPOTENTE: pode rodar quantas vezes quiser; é também o script de
# "re-deploy" (git pull + npm ci + restart). Rode NA VPS, como root:
#   sudo bash /opt/poe-hub/deploy/cx/setup-vps.sh
# (na primeira vez, baixe o script antes: curl do GitHub ou scp)
#
# O que faz:
#   1. cria o usuário de serviço (poehub, system, sem login)
#   2. clona/atualiza o repo em /opt/poe-hub (branch $BRANCH)
#   3. npm ci (com devDependencies — o tsx e o prisma CLI vivem lá)
#   4. cria /opt/poe-hub/.env.ws de exemplo se ausente (com placeholders)
#   5. instala o unit systemd (com backup do anterior + node path real)
#   6. instala o server block do Nginx (com backup), nginx -t, reload
#   7. systemctl enable; start SÓ se o .env.ws não tiver mais placeholder
#   8. certbot: comentado no fim — passo manual consciente
#
# O que NÃO faz (ver docs/deploy/cx-vps-runbook.md):
#   - migrations do Prisma (vão por socket no poe-postgres — passo manual)
#   - stack de observability (compose + prometheus-prod.yml + user Grafana)
#   - firewall (confira que 8766 NÃO está exposta — só 80/443 públicas)

set -euo pipefail

# ------------------------------------------------------------------ config
REPO_URL="${REPO_URL:-https://github.com/alexsena-code/poe-hub.git}"
REPO_DIR="${REPO_DIR:-/opt/poe-hub}"
BRANCH="${BRANCH:-main}"          # export BRANCH=feat/cx-management pra testar a branch
RUN_USER="${RUN_USER:-poehub}"
DOMAIN="${DOMAIN:-ws.pathoftrade.net}"
SERVICE_NAME="poe-hub-ws"

UNIT_SRC="$REPO_DIR/deploy/cx/poe-hub-ws.service"
UNIT_DST="/etc/systemd/system/$SERVICE_NAME.service"
NGINX_SRC="$REPO_DIR/deploy/cx/nginx-ws.conf"
NGINX_DST="/etc/nginx/sites-available/$DOMAIN"
ENV_FILE="$REPO_DIR/.env.ws"

log()  { echo "[setup-vps] $*"; }
fail() { echo "[setup-vps] ERRO: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "rode como root (sudo)."
command -v git  >/dev/null || fail "git não encontrado."
command -v node >/dev/null || fail "node não encontrado no PATH do root."
command -v npm  >/dev/null || fail "npm não encontrado."

NODE_BIN="$(command -v node)"
log "node: $NODE_BIN ($(node --version))"

# Backup com timestamp, só se o conteúdo mudou. backup_if_changed <src> <dst>
backup_if_changed() {
  local src="$1" dst="$2"
  if [ -f "$dst" ] && ! cmp -s "$src" "$dst"; then
    cp -a "$dst" "$dst.bak.$(date +%Y%m%d%H%M%S)"
    log "backup: $dst -> $dst.bak.*"
  fi
}

# ------------------------------------------------- 1. usuário de serviço
if ! id -u "$RUN_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$REPO_DIR" --no-create-home --shell /usr/sbin/nologin "$RUN_USER"
  log "usuário $RUN_USER criado"
else
  log "usuário $RUN_USER já existe"
fi

# ------------------------------------------------- 2. clone/update do repo
if [ ! -d "$REPO_DIR/.git" ]; then
  log "clonando $REPO_URL em $REPO_DIR (branch $BRANCH)"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  log "atualizando $REPO_DIR (branch $BRANCH)"
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" checkout "$BRANCH"
  # --ff-only: se a VPS tiver commit local divergente, PARE e investigue
  git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
fi

# ------------------------------------------------- 3. dependências
# devDependencies incluídas de propósito: tsx (runtime do ws-server) e o
# CLI do prisma são devDeps. O postinstall roda `prisma generate` (não
# precisa de banco). NODE_ENV é setado só no unit, não aqui.
log "npm ci (com devDependencies)"
(cd "$REPO_DIR" && npm ci --include=dev)

# ------------------------------------------------- 4. .env.ws de exemplo
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
# /opt/poe-hub/.env.ws — ambiente do poe-hub-ws (systemd EnvironmentFile).
# NUNCA commitar. Formato systemd: KEY=valor, sem `export`, sem aspas extras.

# Token do canal /ws/executor e do GET /metrics. Gere com:
#   openssl rand -hex 32
# e use O MESMO no executor (--token) e no prometheus.yml da VPS.
CX_WS_TOKEN=TROQUE_ME

# Postgres de prod (container poe-postgres). Mesmo user/senha que a Vercel
# usa (poth_app, só CRUD) — trocando o host pra 127.0.0.1.
DATABASE_URL=postgresql://poth_app:TROQUE_ME@127.0.0.1:5432/poth

# Porta do ws-server (default 8766 — o Nginx e o Prometheus apontam pra ela)
MONITOR_WS_PORT=8766
EOF
  chown root:"$RUN_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  log "criado $ENV_FILE de exemplo — EDITE os TROQUE_ME antes de iniciar"
else
  log "$ENV_FILE já existe — mantido como está"
fi

# ------------------------------------------------- 5. unit systemd
[ -f "$UNIT_SRC" ] || fail "unit não encontrado: $UNIT_SRC (branch certa?)"
TMP_UNIT="$(mktemp)"
sed "s|^ExecStart=/usr/bin/node |ExecStart=$NODE_BIN |; s|^User=poehub$|User=$RUN_USER|; s|^Group=poehub$|Group=$RUN_USER|" \
  "$UNIT_SRC" > "$TMP_UNIT"
backup_if_changed "$TMP_UNIT" "$UNIT_DST"
install -m 644 "$TMP_UNIT" "$UNIT_DST"
rm -f "$TMP_UNIT"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
log "unit instalado: $UNIT_DST (ExecStart usa $NODE_BIN)"

# ------------------------------------------------- 6. nginx
if command -v nginx >/dev/null; then
  [ -f "$NGINX_SRC" ] || fail "nginx conf não encontrado: $NGINX_SRC"
  TMP_NGINX="$(mktemp)"
  sed "s|ws\.pathoftrade\.net|$DOMAIN|g" "$NGINX_SRC" > "$TMP_NGINX"
  backup_if_changed "$TMP_NGINX" "$NGINX_DST"
  install -m 644 "$TMP_NGINX" "$NGINX_DST"
  rm -f "$TMP_NGINX"
  ln -sfn "$NGINX_DST" "/etc/nginx/sites-enabled/$DOMAIN"
  if nginx -t; then
    systemctl reload nginx
    log "nginx: $DOMAIN instalado e recarregado"
  else
    fail "nginx -t falhou — corrija antes de recarregar (conf em $NGINX_DST)"
  fi
else
  log "AVISO: nginx não encontrado — pulei o server block ($NGINX_DST)"
fi

# ------------------------------------------------- 7. start (se configurado)
if grep -q "TROQUE_ME" "$ENV_FILE"; then
  log "AVISO: $ENV_FILE ainda tem placeholders — NÃO iniciei o serviço."
  log "Edite o arquivo e rode: systemctl restart $SERVICE_NAME"
else
  systemctl restart "$SERVICE_NAME"
  sleep 2
  systemctl --no-pager --lines=5 status "$SERVICE_NAME" || true
  log "serviço (re)iniciado. Logs: journalctl -u $SERVICE_NAME -f"
fi

# ------------------------------------------------- 8. certbot (MANUAL)
# TLS é passo manual consciente (mexe no conf do nginx e emite cert):
#   certbot --nginx -d "$DOMAIN"
# Pré-requisito: DNS do $DOMAIN apontando pra VPS e porta 80 aberta.
log "feito. Próximos passos: migrations, certbot e observability — ver docs/deploy/cx-vps-runbook.md"
