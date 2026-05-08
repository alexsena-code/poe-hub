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

---

### Editor: paste de imagens, modo bilingue, edit/delete de publicados

Sessão de trabalho 2026-05-07 noite, motivada por reclamação do user
de que o post EN publicado tinha apenas 1 imagem enquanto o PT tinha
5 (bug observado em produção via Playwright). Investigação revelou
três problemas distintos.

**1. Paste consecutivo de imagens sobrescrevia a anterior.**
`insertImageNode` em `components/editor/extensions/image-upload.ts`
chamava `tr.replaceSelectionWith(node)`, que deixa a seleção como
`NodeSelection` no nó inserido. Próximo Ctrl+V substituía em vez de
acumular. Fix: após inserir, mover cursor pra `TextSelection.near` da
posição depois do nó; se imagem caiu no fim do doc, anexar parágrafo
vazio. Função exportada pra teste. 2 testes de regressão em
`__tests__/image-upload.test.ts` (3 pastes consecutivos = 3 imagens
no doc; imagem no fim do doc gera parágrafo).

**2. Editor bilingue (toggle PT/EN).** User pediu pra editar PT e EN
no mesmo lugar sem duplicar trabalho. Pareamento via
`translation.metadata` (plugin i18n do Sanity) — schema do post em
`poetrade-dev/sanity/schemas/post.ts` não tem campo `translationOf`,
a relação fica num doc separado consultável via GROQ
`*[_type == "translation.metadata" && references(^._id)]`. Novo
endpoint `app/api/sanity/draft/[id]/sibling/route.ts` retorna o
draft do irmão. Página `[id]/edit/page.tsx` faz fetch paralelo
primary + sibling. EditorShell aceita prop `sibling` e monta dois
`useEditorPane` (novo hook em `hooks/use-editor-pane.ts`); ambos
Tiptaps ficam montados pra autosave independente, mas só um é
visível por vez via toggle PT-BR/EN no header. Tentei broadcast de
imagem entre panes — descartado por inserir no fim do doc passivo
(UX confusa); paste continua per-idioma.

**3. Posts publicados não editáveis nem deletáveis.**
`GET /api/sanity/draft/[id]` só procurava `drafts.<id>`, retornava
404 pra published-only. Fix: tentar draft, fallback pra published.
Editar publicado dispara autosave que cria `drafts.<id>` automa-
ticamente; publish promove draft de volta numa transaction. Pra
deletar, adicionei `deletePost(id)` em `lib/sanity/publish.ts` que
apaga draft + published em transaction. `DELETE` handler usa
`deletePost`; nome da rota mantido por inércia. `PostRow` mostra
botão Trash em ambas as seções com copy adaptada (rascunho vs post
publicado). Mock do Sanity client em `draft.test.ts` estendido com
`transaction()` builder pra cobrir o novo caminho.

**Validação:**
- Vitest: `npx vitest run components/editor` (202/202),
  `npx vitest run lib/sanity/__tests__/publish.test.ts
  app/api/sanity/__tests__/draft.test.ts` (51/51).
- Typecheck: `npx tsc --noEmit` — zero erros novos nos arquivos
  tocados.
- Smoke via Playwright em `localhost:3000`: post EN publicado
  `X9x3hBipkhUy0zLYA16wm` que dava 404 agora carrega; lista do
  blog mostra 39 botões Trash (8 rascunho + 31 publicado); toggle
  PT-BR/EN troca conteúdo e título do EditorTitleBar conforme pane
  ativo.

**4. Bilingue desde a criação (`/new`).** Após o primeiro commit, o
toggle só aparecia em posts existentes pareados via i18n. User pediu
pra `/new` também ter o toggle desde o primeiro click. Solução: nova
rota `POST /api/sanity/translation-pair` cria um doc
`translation.metadata` (formato do plugin `@sanity/document-
internationalization`) linkando dois drafts ainda não-existentes via
weak refs. Página `app/(auth)/workspace/blog/new/page.tsx` gera dois
nanoids no mount, chama a rota uma vez (gated por `useRef`), e só
renderiza `EditorShell` com `sibling` quando o pareamento está
pronto. Re-mount cria órfão (aceitável MVP — Sanity drops orphan
metadata quando nenhum ref resolve).

Confirmação per-idioma: cada `useEditorPane` mantém `meta` próprio
(title, metadata SEO, slug, tags, mainImage), `useAutosave` recebe o
`meta` daquele pane, e `EditorTitleBar` lê via context que aponta
sempre pro pane ativo. Metadata nunca cruza entre idiomas.
