# DB Hardening — Postgres na VPS

**Contexto:** Postgres 16 no container `poe-postgres` (image `postgres:16`)
numa VPS Hetzner (IP `77.42.47.106`). User superuser único: `poe`. Três DBs,
todos owned por `poe`:

| DB              | Quem usa                                | Como conecta          |
|-----------------|-----------------------------------------|-----------------------|
| `poth`          | hub (Vercel)                            | Internet pública 5432 |
| `poe_content`   | engine (`path-of-trade-content`, VPS)   | Loopback              |
| `hardware_deals`| hardware-deals (FastAPI Python, VPS)    | Loopback              |

Apenas o `poth` precisa aceitar conexão remota (da Vercel). Os outros 2 são
acessados localmente e o ideal é nem aceitarem conexão da internet.

A porta 5432 está aberta na internet pra Vercel chegar. Por isso o BSI manda
report periódico via Hetzner. Em vez de migrar pra DB gerenciado, este runbook
aplica defesa em profundidade na VPS.

---

## Plano

1. Trocar senha do `poe` (superuser único) por string forte.
2. Criar user `poth_app` com privilégios mínimos (CRUD only no DB `poth`)
   pra Vercel usar — Vercel para de conectar como superuser.
3. Bloquear `poth_app` de conectar nos outros 2 DBs.
4. **Restringir `poe` a conexões locais** via `pg_hba.conf` — defesa principal
   contra brute force no superuser.
5. Ativar logs de auth no Postgres pra fail2ban consumir.
6. Configurar fail2ban pra banir IPs com brute force no `poth_app`.
7. Atualizar `DATABASE_URL` na Vercel.
8. Smoke test.

> SSL/TLS forçado fica fora deste runbook. Postgres 16 aceita TLS opcional,
> mas habilitar `hostssl` requer cert + reload. Plano separado se for o caso.

---

## Passo 1 — Gerar senhas fortes

Na sua máquina local, gera 2 senhas:

```bash
openssl rand -base64 32   # senha nova pro poe (superuser, migrations + apps locais)
openssl rand -base64 32   # senha pro poth_app (Vercel) — usada no DATABASE_URL
```

Guarda no 1Password / gerenciador de senhas. Vou referenciar como
`<SENHA_POE>` e `<SENHA_APP>` daqui pra frente.

---

## Passo 2 — SQL no Postgres

Postgres roda no container `poe-postgres` (image `postgres:16`, definido em
`path-of-trade-content/docker-compose.yml`). O superuser é `poe` (porque
`POSTGRES_USER=poe` no compose substitui o `postgres` default).

```bash
ssh root@77.42.47.106
docker exec -it poe-postgres psql -U poe -d postgres
```

Confirma o estado atual antes de mexer:

```sql
\du
-- Esperado (estado atual): só `poe` (Superuser, Create role, Create DB).
\l
-- Esperado: 4 DBs (postgres, poth, poe_content, hardware_deals), todos owned por poe.
```

Roda o SQL abaixo (substitui as senhas placeholder):

```sql
-- 1. Trocar senha do superuser poe
ALTER USER poe WITH PASSWORD '<SENHA_POE>';

-- 2. Criar o user limitado pra Vercel
CREATE ROLE poth_app WITH LOGIN PASSWORD '<SENHA_APP>';

-- 3. Conectar no DB do hub
\c poth

-- 4. GRANTs de CRUD no schema public (sem CREATE/DROP/ALTER)
GRANT CONNECT ON DATABASE poth TO poth_app;
GRANT USAGE  ON SCHEMA public  TO poth_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO poth_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO poth_app;

-- 5. Default privileges — tabelas/sequences criadas em migrations futuras
--    (rodadas como `poe`, dono) já saem com GRANTs pro poth_app
ALTER DEFAULT PRIVILEGES FOR ROLE poe IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO poth_app;
ALTER DEFAULT PRIVILEGES FOR ROLE poe IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO poth_app;

-- 6. Isolamento cross-DB — poth_app só conecta no `poth`
\c postgres

REVOKE CONNECT ON DATABASE poe_content     FROM PUBLIC;
GRANT  CONNECT ON DATABASE poe_content     TO poe;

REVOKE CONNECT ON DATABASE hardware_deals  FROM PUBLIC;
GRANT  CONNECT ON DATABASE hardware_deals  TO poe;

REVOKE CONNECT ON DATABASE poth            FROM PUBLIC;
GRANT  CONNECT ON DATABASE poth            TO poe, poth_app;
```

**Verificar:**

```sql
-- Listar atributos do poth_app (deve aparecer sem Superuser, sem Create*)
\du poth_app

-- Ver GRANTs no schema public do poth
\c poth
\dp
```

---

## Passo 3 — Restringir `poe` a conexões locais (`pg_hba.conf`)

> **Por quê:** `poe` é superuser. Se a senha vazar, atacante remoto teria
> controle total. Limitando ele a loopback/Docker network, **só apps que rodam
> na própria VPS** (engine, hardware-deals) conseguem se autenticar como `poe`.
> A Vercel passa a ser **obrigada** a usar `poth_app` (que tem só CRUD).

### Descobrir o path do `pg_hba.conf`

```bash
docker exec poe-postgres psql -U poe -d postgres -c "SHOW hba_file;"
# Tipicamente: /var/lib/postgresql/data/pg_hba.conf
```

### Editar

Backup primeiro:

```bash
docker exec poe-postgres cp /var/lib/postgresql/data/pg_hba.conf \
                            /var/lib/postgresql/data/pg_hba.conf.bak
```

Edita o arquivo (do host, via volume Docker):

```bash
nano /var/lib/docker/volumes/path-of-trade-content_postgres_data/_data/pg_hba.conf
```

**Estado atual** (default postgres image): provavelmente algo como:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             all                     scram-sha-256
```

A última linha (`host all all all`) é o que aceita Vercel. Substituir por:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# Conexões dentro do próprio container (psql via docker exec)
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# Apps locais via Docker network (engine, hardware-deals em containers irmãos)
host    all             poe             172.18.0.0/16           scram-sha-256

# Vercel — só `poth_app`, só no DB `poth`. `poe` NÃO aceita de fora.
host    poth            poth_app        0.0.0.0/0               scram-sha-256
```

> Subnet `172.18.0.0/16` confirmado via `docker network inspect` no
> `poe-postgres`. Se um dia trocar a Docker network (ex: rebuild com nome
> diferente), reconfirmar e atualizar essa linha.

Aplica sem restart:

```bash
docker exec poe-postgres psql -U poe -d postgres -c "SELECT pg_reload_conf();"
```

**Smoke test imediato** (de outro IP, ex: sua máquina local):

```bash
# poe de fora deve FALHAR:
psql "postgresql://poe:<SENHA_POE>@77.42.47.106:5432/postgres"
# FATAL: no pg_hba.conf entry for host "<seu IP>", user "poe", database "postgres"

# poth_app no poth deve funcionar:
psql "postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poth" -c "SELECT 1;"
# 1

# poth_app no poe_content deve falhar:
psql "postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poe_content"
# FATAL: no pg_hba.conf entry ... OU permission denied for database
```

> **Atenção:** se o engine ou hardware-deals rodarem em containers Docker
> separados (não no `poe-postgres` em si), eles conectam pela Docker network
> com IPs dos ranges acima. Verifique antes de aplicar — se algum app local
> não conectar mais, ajuste a faixa em `host all poe ...`.

---

## Passo 4 — Atualizar `DATABASE_URL` na Vercel

Vai em Vercel → Project → Settings → Environment Variables e troca
`DATABASE_URL` por:

```
postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poth
```

Faz redeploy. **Não roda migrations da Vercel** — `poth_app` não tem permissão
de `CREATE TABLE`. Migrations continuam rodando manualmente via SSH com user
`poe` (superuser, owner dos schemas).

---

## Passo 5 — Logs de auth no Postgres

Pra fail2ban detectar tentativas falhas, o Postgres precisa logar conexões
e disconnections com IP. Aplicar via `ALTER SYSTEM` (escreve em
`postgresql.auto.conf` — mais limpo que editar arquivo à mão):

```bash
docker exec -it poe-postgres psql -U poe -d postgres
```

```sql
ALTER SYSTEM SET log_connections    = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_hostname       = off;
ALTER SYSTEM SET log_line_prefix    = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_destination    = 'stderr';
ALTER SYSTEM SET logging_collector  = on;
ALTER SYSTEM SET log_directory      = 'log';
ALTER SYSTEM SET log_filename       = 'postgresql-%Y-%m-%d_%H%M%S.log';
SELECT pg_reload_conf();
```

> ⚠️ `logging_collector` exige **restart** (não basta reload). Os outros
> settings entram com reload. Como engine está em produção rodando local,
> o restart cai por ~5s — agendar momento OK.

Restart do container:

```bash
docker restart poe-postgres
```

Confirma que está logando:

```bash
# De outro terminal, força conexão com senha errada:
psql "postgresql://poth_app:errada@77.42.47.106:5432/poth"

# Vê os logs do container (deve aparecer FATAL: password authentication failed):
docker exec poe-postgres tail -50 /var/lib/postgresql/data/log/postgresql-*.log
```

---

## Passo 6 — Fail2ban

### Instalação

```bash
sudo apt update && sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### Filter

Cria `/etc/fail2ban/filter.d/postgresql.conf`:

```ini
[Definition]
failregex = ^.*FATAL:\s+password authentication failed for user.*client=<HOST>.*$
            ^.*FATAL:\s+no pg_hba.conf entry for host "<HOST>".*$
ignoreregex =
```

> O regex assume `log_line_prefix` do passo 4 (com `client=%h`). Se você manteve
> outro prefix, ajusta o `<HOST>`.

### Descobrir o path do volume no host

O volume do `poe-postgres` é nomeado (`postgres_data` no compose do engine).
Pra achar o path real:

```bash
docker volume inspect path-of-trade-content_postgres_data \
  --format '{{ .Mountpoint }}'
# Ex: /var/lib/docker/volumes/path-of-trade-content_postgres_data/_data
```

> Se o nome do projeto compose for diferente (ex: rodou com `-p` flag), ajusta.
> Lista tudo com `docker volume ls | grep postgres`.

Logs do Postgres ficam em `<MOUNTPOINT>/log/postgresql-*.log`. Confirma:

```bash
ls /var/lib/docker/volumes/path-of-trade-content_postgres_data/_data/log/
```

### Jail

Cria `/etc/fail2ban/jail.d/postgresql.local` (ajusta `logpath` com o caminho
real do passo anterior):

```ini
[postgresql]
enabled  = true
port     = 5432
filter   = postgresql
logpath  = /var/lib/docker/volumes/path-of-trade-content_postgres_data/_data/log/postgresql-*.log
maxretry = 5
findtime = 600
bantime  = 3600
```

### Aplicar e testar

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status postgresql       # deve mostrar a jail ativa

# Simula 5 falhas de outra máquina:
for i in {1..6}; do psql "postgresql://poth_app:errada@77.42.47.106:5432/poth"; done

# Verifica ban:
sudo fail2ban-client status postgresql
# IP listado em "Banned IP list"

# Desbanir manualmente:
sudo fail2ban-client set postgresql unbanip <SEU_IP>
```

---


## Smoke test final

1. **psql remoto com `poth_app`** (da sua máquina local):
   ```bash
   psql "postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poth" \
     -c "SELECT count(*) FROM \"League\";"
   ```
   Deve retornar contagem.

2. **psql remoto tentando escrever schema** (deve falhar):
   ```bash
   psql "postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poth" \
     -c "CREATE TABLE x (id int);"
   # ERROR: permission denied for schema public
   ```

3. **psql remoto tentando o outro DB** (deve falhar):
   ```bash
   psql "postgresql://poth_app:<SENHA_APP>@77.42.47.106:5432/poe_content"
   # FATAL: permission denied for database "poe_content"
   ```

4. **Hub em produção:** abre `https://hub.pathoftrade.net/dashboard`, confere
   que dados carregam. Checa logs Vercel — sem `P1008`/`SocketTimeout` nem
   `permission denied`.

---

## Rollback

Se algo quebrar:

```sql
-- Volta DATABASE_URL pra user antigo (poth) com a senha nova
-- na Vercel, e:
DROP OWNED BY poth_app;
DROP ROLE   poth_app;
```

Fail2ban: `sudo fail2ban-client stop postgresql` ou `enabled = false`
no jail.

---

## Checklist

- [ ] Senhas geradas e guardadas no gerenciador
- [ ] `ALTER USER poe` com senha forte aplicado
- [ ] `poth_app` criado com GRANTs CRUD no DB `poth`
- [ ] `ALTER DEFAULT PRIVILEGES FOR ROLE poe` configurado
- [ ] REVOKE/GRANT cross-DB aplicado nos 3 DBs (`poth`, `poe_content`, `hardware_deals`)
- [ ] `pg_hba.conf` editado: `poe` só loopback/Docker, `poth_app` aceita 0.0.0.0/0 só no `poth`
- [ ] `pg_reload_conf()` rodado, smoke test do `pg_hba` (poe de fora falha, poth_app conecta)
- [ ] `DATABASE_URL` da Vercel atualizado pra `poth_app`, redeploy OK
- [ ] Engine + hardware-deals (apps locais) ainda conectam normalmente
- [ ] `ALTER SYSTEM SET log_connections=on` + restart container
- [ ] Fail2ban filter+jail criados, status `Active`
- [ ] Smoke test: SELECT funciona, CREATE TABLE falha, outro DB nega
- [ ] Hub em produção verificado, sem regressão
