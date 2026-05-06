# Session 20 — DB hardening (Postgres exposto na VPS)

Tema: hardening do Postgres exposto publicamente na VPS Hetzner em
resposta aos reports recorrentes do BSI/CERT-Bund via Hetzner Abuse.
Em vez de migrar pra DB gerenciado (Neon/Vercel Postgres/Supabase),
optamos por defesa em profundidade na VPS — manter os dados em casa.

## Trigger

Email do Hetzner Abuse encaminhando report do CERT-Bund: PostgreSQL
aberto na 5432 do IP `77.42.47.106`. Operador fechou o firewall, e o
hub na Vercel parou imediatamente com `P1008 SocketTimeout` (Vercel
runtime conecta via internet pública, não via Docker network local).

Reabrir a porta resolveu o app, mas trouxe de volta o vetor que o BSI
reportou. Decidimos hardenizar em vez de migrar.

## Por que não migramos

- **Solo operator + dados pequenos** (preços, sales, bot configs).
  Free tier de Neon (0.5GB) caberia, mas adicionar mais um SaaS em
  rotação não justifica.
- **Engine + hardware-deals + scraper rodam na própria VPS** e usam o
  mesmo Postgres em DBs separados (`poe_content`, `hardware_deals`).
  Migrar só o `poth` quebraria o modelo de "um Postgres, três DBs".

## Estado descoberto na VPS

| DB              | Owner | Quem usa                                     | Como conecta          |
|-----------------|-------|----------------------------------------------|-----------------------|
| `poth`          | `poe` | hub (Vercel)                                 | Internet pública 5432 |
| `poe_content`   | `poe` | engine (`path-of-trade-content`, na VPS)     | Loopback              |
| `hardware_deals`| `poe` | hardware-deals (FastAPI Python, na VPS)      | Loopback              |

**Único role era `poe` (superuser)** — Vercel conectava como superuser,
risco alto. Container: `poe-postgres` (image `postgres:16`) na Docker
network `poetrade-content_default` (subnet `172.18.0.0/16`).

## O que foi aplicado

1. **Senhas rotacionadas** — `poe` ganhou senha forte; user novo
   `poth_app` criado pra Vercel usar.
2. **`poth_app` com privilégios mínimos** — só `SELECT/INSERT/UPDATE/
   DELETE` no schema `public` do DB `poth`. `ALTER DEFAULT PRIVILEGES
   FOR ROLE poe` configurado pra migrations futuras herdarem os GRANTs.
3. **Cross-DB isolation** — `REVOKE CONNECT FROM PUBLIC` nos 3 DBs +
   `GRANT CONNECT TO poe` (e `poth_app` só no `poth`).
4. **`pg_hba.conf` restritivo** — `poe` só aceita conexão da Docker
   network 172.18.0.0/16 (apps locais). `poth_app` aceita 0.0.0.0/0
   só no DB `poth`.
5. **Postgres logging em arquivo** com `log_line_prefix` incluindo
   `client=%h` (necessário pro fail2ban capturar IP).
6. **fail2ban** detectando falhas de auth + banindo via `chain =
   DOCKER-USER` (resolveu fail2ban-Docker integration: bans em INPUT
   não pegam tráfego pra containers).
7. **`DATABASE_URL` da Vercel** migrada de `poe`/superuser pra
   `poth_app` com a senha nova.

## Correções não-óbvias descobertas na execução

Anotadas no runbook `docs/security/db-hardening.md` pra Claude/operador
futuro não tropeçar:

- **`backend = polling`** no jail — Ubuntu 24.04 default vai pra systemd
  journal e ignora `logpath`. Sintoma: status mostra `Journal matches:`
  em vez de `File list:`.
- **`chain = DOCKER-USER` + `banaction = iptables-multiport`** — sem
  isso, `f2b-postgresql` chain vai pra `INPUT` e Docker bypassa
  (DNAT acontece antes). Sintoma: `Currently banned: 1` mas pacotes
  continuam chegando no Postgres.
- **`ignoreip 172.18.0.0/16`** — gateway Docker aparece como
  `client=172.18.0.1` quando apps locais conectam via loopback do
  host. Sem ignoreip, fail2ban baniria o gateway e quebraria todos
  os apps locais.
- **Volume name é `poetrade-content_postgres_data`** (legacy do nome
  do diretório `poetrade-content` no compose), não
  `path-of-trade-content_postgres_data`.

## Validação

Smoke tests da máquina local:

- ✅ `poe` de fora bloqueado (`no pg_hba.conf entry`)
- ✅ `poth_app` no `poth` autentica e funciona
- ✅ `poth_app` em `poe_content`/`hardware_deals` bloqueado
- ✅ Após 6 falhas, `Currently banned: 1` no fail2ban
- ✅ Pós-ban: `Connection refused` em vez de `FATAL` (REJECT do
  iptables responde com ICMP antes do pacote chegar no Postgres)

Hub em `https://hub.pathoftrade.net/dashboard` funcionando com o user
não-superuser.

## Pendências (não urgentes)

- **TLS forçado** (`hostssl` no `pg_hba.conf` + `?sslmode=require` no
  `DATABASE_URL`). Postgres 16 já vem com cert auto-assinado funcional
  por default; é flip de switch. Custo baixo, ganho de proteção contra
  sniffing de queries em trânsito (não da senha — SCRAM-SHA-256 já
  protege a senha mesmo sem TLS).
- **Backups automáticos** com `pg_dump` cron + cópia off-host. Não é
  hardening, é blast radius.
- **BSI continuará reportando** porta 5432 aberta (scan automático).
  Pra silenciar, mudar pra porta não-padrão (ex: 49152+) é a Opção 1
  que discutimos. Atualmente decidimos conviver com os reports.

## Referências

- Runbook completo: [`docs/security/db-hardening.md`](../security/db-hardening.md)
- Commits: `b3c8cbb` (runbook inicial) → `d426943` (atualização com
  correções da execução real)
