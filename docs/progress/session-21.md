## Session 21 — Sanity image preview fix + DB connection lessons

**Theme:** Caçada do bug de preview de imagem (Vercel envs Sensitive
quebram NEXT_PUBLIC vars no build) + sessão longa de debug do engine
em crash loop que terminou descobrindo que apps locais devem usar
`localhost`, não IP público no `DATABASE_URL`.

### Bugs corrigidos

- **Imagens 404 no preview de post** — `NEXT_PUBLIC_SANITY_PROJECT_ID`
  e `NEXT_PUBLIC_SANITY_DATASET` estavam marcadas como **Sensitive**
  no painel Vercel. Vercel não expõe envs Sensitive em build time, e
  como `NEXT_PUBLIC_*` são inlinadas no bundle do client, elas viraram
  string vazia em prod → URLs `https://cdn.sanity.io/images///<hash>.webp`
  retornando 404 via `_next/image`. Operador desmarcou Sensitive.

- **Engine `poe-api` em crash loop** — vários problemas em camadas:
  1. `.env` apontando pro DB do hub (`poth`) em vez do DB do engine
     (`poe_content`).
  2. Após corrigir DB, `pm2 restart --update-env` não recarregou o
     `env_file` declarado no `ecosystem.config.js` (esse flag só atualiza
     o bloco `env: {}` hardcoded, não relê arquivos). Precisa
     `pm2 delete && pm2 start`.
  3. Causa raiz final: `DATABASE_URL` apontava pra IP público
     (`77.42.47.106`), o que faz o pacote sair pela WAN e voltar.
     Postgres no container vê o cliente como vindo do IP público, não
     do gateway docker (`172.18.0.1`), e a regra
     `host all poe 172.18.0.0/16 scram-sha-256` do `pg_hba.conf` não
     bate. Fix: trocar host pra `localhost` no `.env`.

### Mudanças

- `lib/sanity/client.ts` — `sanityPublicConfig` (objeto) →
  `getSanityPublicConfig()` (função lazy). Lança erro com mensagem
  clara (mencionando a pegadinha do "Sensitive" no Vercel) quando
  `NEXT_PUBLIC_SANITY_PROJECT_ID` ou `_DATASET` vierem vazios.
- `lib/sanity/image-url.ts` — usa a nova função.
- `components/editor/preview/portable-text-components.tsx:198-247` —
  `try/catch` no `imageUrlFor`. Em caso de erro, renderiza um placeholder
  vermelho com a mensagem em vez de derrubar a árvore React inteira do
  preview.
- `docs/security/db-hardening.md` — nova seção "Passo 4.5 — Apps locais
  usam localhost" documentando a pegadinha do IP público vs docker
  network, com tabela de qual user/host cada app usa, smoke test de
  validação e nota sobre PM2 `--update-env` não relê `env_file`.

### Validação

- Sanity image fix testado via `npm run dev` localmente (preview
  renderizando imagem corretamente).
- Engine subindo limpo: `[ConfigSeederService] Boot seed complete: 0
  seeded, 9 already populated` + `[NestApplication] Nest application
  successfully started` + `API running on http://localhost:3000`.

### Open items

- Rotacionar senha do user `poe` (foi exposta no chat durante debug).
- Verificar se hardware-deals também está com IP público no `.env` —
  comando: `sudo grep -rl "@77.42.47.106:5432" /opt/ | grep -v node_modules`.
- Atualizar Vercel: as envs `NEXT_PUBLIC_SANITY_*` precisam ficar
  desmarcadas como Sensitive **permanentemente** — qualquer recriação
  acidental quebra o preview de novo.
