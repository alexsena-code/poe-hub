# Session 10 — Editor wizard + Right Rail de Tools + fix publish

Data inicial: 2026-04-24.
Plano aprovado: `C:\Users\alexa\.claude\plans\vamos-ler-a-session-partitioned-cocke.md`.

## Contexto em 60s

Session 09 (HEAD = `3f33ed4`) zerou carryover de cleanup da session 08 (chip
paridade + vitest e2e exclude + migration retroativa + tracker hygiene).
Editor Tiptap funciona pra digitar, mas operador apontou 3 problemas:

1. **UX horrível**: meta form (487L em `editor-sidebar.tsx`) sempre à direita
   força preencher tudo antes de publicar; side panels Q&A/Assets empilhados
   à esquerda do shell; toolbar com gaps (sem Undo/Redo, alignment, table, HR).
2. **Publish QUEBRADO** (descoberta do audit): `EditorMetaForm` envia
   `categoryId`/`authorId`/`mainImageAssetId` mas `sanityPostSchema` espera
   `category._ref`, `author._ref`, `mainImage.asset._ref`. Nenhuma transformação
   existe. Publish nunca passou validação. Autosave funciona por acaso (rota
   draft não valida schema completo).
3. **Q&A language desincronizado**: `use-qa-chat.ts:46` tem state isolado de
   `meta.language`, pode divergir.

Outcome: editor leve com right rail de tools, wizard 2 passos (`/edit` →
`/publish`), publish funcionando para PT-BR e EN como documentos Sanity
separados (sem o plugin completo de i18n — esse é a session 11 dedicada).

## Decisões (validadas)

- **Layout meta**: rota separada `/workspace/blog/[id]/publish` (wizard 2
  passos). Toolbar do editor ganha "Prosseguir →" no lugar do "Publicar".
- **Defer metadata**: salva como `drafts.<id>` real no Sanity, sem validação
  estrita. `Publicar` só completa na publish page com meta válida.
- **i18n nesta session**: SÓ o fix do publish (transform IDs → references) +
  slug collision check + sync Q&A language com meta.language. SEM clone
  PT-BR↔EN, SEM `@sanity/document-internationalization` plugin.
- **Right rail**: 5 widgets (Score / Slang / Q&A / Assets / Slang Lookup),
  accordion vertical collapsible, w-80 shrink-0.

## Sanity check

```bash
git log --oneline -3                    # 3f33ed4 no topo
git status --short                      # vazio
npx vitest run 2>&1 | tail -3           # 539 passed / 0 failed baseline
```

## Plano (5 chunks, 3 waves)

- **Wave 1** (paralelo): S10.a (Right Rail) + S10.c (Fix publish + Q&A sync)
- **Wave 2** (paralelo): S10.b (Wizard Edit → Publish) + S10.e (Importar guide LLM)
- **Wave 3**: S10.d (UI/UX polish + integration tests)

**S10.e (adicionado pós-aprovação)**: engine já gera guides PT-BR + EN no
mesmo doc (`output/posts/<slug>.json`, sections com markdown bilingue).
Botão "Editar no Blog" em `/workspace/guides/[slug]` cria 2 drafts Sanity
separados (um por idioma) via novo `markdown-to-portable.ts` converter +
endpoint `/api/sanity/draft-from-guide`. Operador edita e publica cada um
no editor blog normal.

## Changelog

### S10.a — Right Rail de Tools (2026-04-24)

Substitui os 2 side-panels esquerdos por right rail unificado com 5 widgets
em accordion vertical persistido no localStorage por draftId.

Arquivos novos (8):
- `components/editor/right-rail.tsx` (106L) — wrapper accordion w-80
  shrink-0 border-l, multi-select + persist por draftId.
- `components/editor/widgets/widget-shell.tsx` (71L) — primitive interno
  (icon + title + optional badge + body) sobre AccordionItem.
- `components/editor/widgets/content-score-widget.tsx` (132L) — port de
  `components/modules/workspace/guides/content-score-card.tsx` + empty
  state ("score gerado pelo engine após salvar").
- `components/editor/widgets/slang-report-widget.tsx` (128L) — port de
  `slang-report-card.tsx` + barra de densidade.
- `components/editor/widgets/qa-chat-widget.tsx` (205L) — migra `side-panel-qa.tsx`;
  language toggle removido (`use-qa-chat` agora consome via context, S10.c).
- `components/editor/widgets/assets-widget.tsx` (160L) — migra `side-panel-assets.tsx`;
  cores yellow hardcoded substituídas por `bg-accent/40 border-accent/30`.
- `components/editor/widgets/slang-lookup-widget.tsx` (156L) — NOVO.
  Search debounced + lista + click insere via `editor.chain().focus().insertContent()`.
- `components/editor/hooks/use-slang-catalog.ts` (93L) — SWR hook pra
  `/api/engine/slang?status=approved&limit=1000` (mesmo endpoint da page
  `/workspace/slang`, sem rota nova).

Tests novos (3):
- `components/editor/__tests__/right-rail.test.tsx` — 5 cases (renders 5
  widgets, localStorage roundtrip, corrupt JSON fallback).
- `components/editor/widgets/__tests__/slang-lookup-widget.test.tsx` —
  8 cases.
- `components/editor/widgets/__tests__/assets-widget.test.tsx` — 10 cases
  (migrado do `side-panel-assets.test.tsx` deletado).

Arquivos editados (4):
- `components/editor/editor-context.tsx` — adiciona campos opcionais
  `contentScore?: ContentScoreReport` + `slangReport?: SlangReport`.
- `components/editor/editor-shell.tsx` — remove `slotSidePanels` prop +
  uso; monta `<RightRail draftId={draftId} />` após `<EditorSidebar>`;
  passa contentScore/slangReport via context.
- `app/(auth)/workspace/blog/new/page.tsx` — remove imports e montagem
  dos 2 side-panels.
- `app/(auth)/workspace/blog/[id]/edit/page.tsx` — mesma remoção.

Arquivos deletados (3):
- `components/editor/side-panel-qa.tsx` (296L) — substituído por widget.
- `components/editor/side-panel-assets.tsx` (224L) — substituído por widget.
- `components/editor/__tests__/side-panel-assets.test.tsx` — substituído
  por `widgets/__tests__/assets-widget.test.tsx`.

Edge case: `ContentScoreReport`/`SlangReport` não estão no `SanityPost` —
EditorShell expõe como props opcionais. Hoje os 2 callers (`new` e `edit`)
não passam; widgets caem no empty state. Quando S10.e (importar guide)
estiver pronto, página guide-detail vai passar os reports do engine.

Validação: `npx vitest run components/editor/` — 15 files / 167 tests verdes.

### S10.c — Fix publish + Q&A language sync (2026-04-24)

Corrige BLOCKER do publish (ID → reference transform) + adiciona collision
check de slug + sincroniza Q&A language com `meta.language` via context.

Arquivos novos (2):
- `lib/sanity/transform.ts` (162L) — `editorMetaToSanityPost` (forward:
  IDs → references, slug string → `{_type: 'slug', current}`, `_id` opcional
  com prefix `drafts.<id>`) + `sanityPostToEditorMeta` (reverse pra GET draft
  retornar shape EditorMetaForm-friendly). Helpers privados:
  `assertNonEmpty` (throws com offending value), `buildMainImageRef` (omite
  chave quando ausente em vez de incluir `undefined`), coercões typed
  (`asString`/`asLanguage`/`asGameVersion`).
- `lib/sanity/__tests__/transform.test.ts` (211L) — 14 casos.

Tests novos (3):
- `app/api/sanity/__tests__/publish.test.ts` (217L) — 9 casos: 401 sem
  sessão, 400 body inválido, 400 missing draftId/empty title/empty body,
  409 slug collision (mesma lang), 200 mesmo slug em outro idioma,
  200 happy + assertiva que `createOrReplace` recebe references.
- `app/api/sanity/__tests__/draft.test.ts` (227L) — 11 casos PUT/GET/DELETE
  cobrindo `_id: drafts.<id>`, partial meta, response shape.
- `components/editor/hooks/__tests__/use-qa-chat.test.ts` (277L) — 11
  casos (2 novos vs 9 antigos): language sai do context, setLanguage é
  no-op, fetch body carrega context language.

Arquivos editados (5):
- `app/api/sanity/publish/route.ts` 48L → 169L. Body novo
  `{ meta: EditorMetaForm, body, draftId }`. Slug collision via GROQ
  `*[_type=='post' && slug.current==$slug && language==$lang && _id != $draftId]`
  (exclui `drafts.**` pra não bloquear self-update). Calls
  `editorMetaToSanityPost` + defesa `sanityPostSchema.parse` antes de
  `publishPost`.
- `app/api/sanity/draft/[id]/route.ts` 103L → 193L. PUT aceita partial
  meta com `language` obrigatório. Server-side reference conversion.
  Inclui só keys presentes. GET retorna `{ meta, body, draftId }` via
  `sanityPostToEditorMeta`.
- `components/editor/hooks/use-qa-chat.ts` 194L → 216L. Remove
  `useState<QaLanguage>`, lê `meta.language` do context.
  `setLanguage` mantido como no-op com JSDoc deprecation pra não quebrar
  consumers que o S10.a possa estar tocando em paralelo.
- `components/editor/hooks/use-publish.ts` — adiciona `draftId` no POST body.
- `components/editor/hooks/use-autosave.ts` — `buildDraftPayload` retorna
  `{ meta, body }` matching novo `draftPutSchema`.

Validação: 94/94 tests do scope S10.c verdes; full suite **586/586** após
Wave 1 inteira (era 539 baseline session 09, +47 novos).

### Wave 1 wrap (2026-04-24)

`npx vitest run` — 41 files, **586 tests**, 0 falhas (29.7s).
`npx tsc --noEmit` — 0 erros novos. Erros pré-existentes em
`lib/simulation-diff.test.ts` e `tests/factories/monitor.factory.ts`
continuam (já flagged no carryover session 09).

### S10.b — Wizard Edit → Publish (2026-04-24)

Substitui o `editor-sidebar.tsx` (487L meta form sempre à direita) por
wizard 2 passos: `/edit` (só editor + right rail + toolbar com "Prosseguir →")
e `/publish` (rota nova com meta form + checklist visual + botão Publicar).

Arquivos novos (9):
- `app/(auth)/workspace/blog/[id]/publish/page.tsx` (149L) — client
  wrapper que carrega draft via GET `/api/sanity/draft/[id]`, monta
  `<PublishForm />`. Header `<PageHeader>` + botão "← Voltar ao editor".
- `components/editor/publish/publish-form.tsx` (234L) — orchestrator
  da meta form. Estado controlado, autosave PATCH no blur (debounce 1s).
  Layout 2 colunas: 4 sections à esquerda + checklist sticky-top +
  actions à direita.
- `components/editor/publish/publish-section-basic.tsx` (104L) — Title,
  Slug (auto-slugify on title change), Game Version.
- `components/editor/publish/publish-section-taxonomy.tsx` (181L) —
  Category, Author (via `useSanityRefs(language)`), TagInput migrado.
- `components/editor/publish/publish-section-seo.tsx` (153L) — Metadata
  description com counter color-coded, Cover image via ImageUploadField
  migrado.
- `components/editor/publish/publish-section-publication.tsx` (95L) —
  Published at (datetime-local), Language radio.
- `components/editor/publish/publish-validation-checklist.tsx` (129L) —
  checklist visual com `editorMetaSchema.safeParse` por campo.
- `components/editor/publish/publish-actions.tsx` (78L) — botões Voltar +
  Publicar (disabled if !isValid; `useTransition` loading; toast em 409).
- 2 test files cobrindo PublishForm + ValidationChecklist (7 cases).

Arquivos editados (5):
- `components/editor/editor-toolbar.tsx` 340L → 261L. Remove fila 1
  inteira (title input, slug, language pill, preview toggle, publish
  button). Mantém fila 2 (formatting). Adiciona "Prosseguir →" no canto
  direito (`router.push('/workspace/blog/[id]/publish')`).
- `components/editor/editor-shell.tsx` 299L → 177L. Remove
  `<EditorSidebar>`, `<PublishDialog>`, `usePublish` hook. Layout vira
  `[EditorBody flex-1][RightRail w-80]`. Aceita `initialMeta`/`initialBody`
  (pós-fix: PortableTextContent[]) em vez de `initialPost: SanityPost`.
- `app/(auth)/workspace/blog/[id]/edit/page.tsx` — DraftResponse tipado
  com novo shape `{ meta, body, draftId }`; passa `initialMeta`/`initialBody`.
- `components/editor/editor-context.tsx` — comentário atualizado.
- `components/editor/editor-meta-schema.ts`, `hooks/use-sanity-refs.ts` —
  comentários atualizados.

Arquivos deletados (1):
- `components/editor/editor-sidebar.tsx` (487L) — conteúdo migrado pra
  `publish/publish-form.tsx` + 4 sub-sections.

Validação: `npx vitest run components/editor` — 174/174 verdes.

### S10.e — Importar guide LLM para editor blog (2026-04-24)

Engine gera guides PT-BR + EN no mesmo doc (markdown puro nas sections,
acessível via `GET /api/engine/content/posts/<slug>`). Operador agora
clica "Editar no Blog" no `/workspace/guides/[slug]` e o sistema cria
2 drafts Sanity separados (1 PT-BR + 1 EN) que abrem direto no editor.

Arquivos novos (5):
- `lib/converters/markdown-to-portable.ts` (235L) — `markdownToPortableText(md)`
  via `unified` + `remark-parse` + `remark-gfm` (já estavam como transitive
  deps de `react-markdown`, sem npm install). Walk MDAST cobrindo headings
  (h5/h6 clamped a h4), parágrafos, listas, code, blockquote, link, image
  (skip — sem Sanity asset ref). Placeholders dos 5 tipos (`{{currency:}}`,
  `{{item:}}`, `{{cta:}}`, `{{passive:}}`, `{{price:}}`): standalone vira
  block-level (`poeCurrency`/`poeItem`/`poePassive`/`poeCta`/`poePrice`),
  inline em parágrafo ou lista mantém span text (consumido pelo
  `splitByPlaceholders` na deserialização). Attr names mirror
  `POE_INLINE_VALUE_ATTR` do `tiptap-to-portable.ts`.
- `lib/converters/__tests__/markdown-to-portable.test.ts` (211L, 26 cases).
- `app/api/sanity/draft-from-guide/route.ts` (142L) — POST. Body
  `{ guideSlug, languages?: ['pt-br'|'en'][] }` (default ambos). Fetch via
  `/api/engine/content/posts/<slug>` (forwarda cookie). Para cada lang:
  concatena sections, prepends h1 title se não presente, converte pra
  Portable Text, cria draft via `client.createOrReplace` com
  `_id: drafts.<nanoid(21)>`. Retorna 201 `{ drafts: [{id, language, slug, title}] }`.
- `app/api/sanity/draft-from-guide/__tests__/route.test.ts` (154L, 8 cases:
  401, 400 missing slug, 400 wrong shape, 404 engine, 200 happy 2 drafts,
  200 single lang, 502 engine error, _id prefix assertion).
- `components/modules/workspace/guides/import-to-blog-button.tsx` (131L) —
  client component. Dialog com checkboxes PT-BR + EN. POST + toast +
  `router.push` pro PT-BR draft.
- `components/modules/workspace/guides/__tests__/import-to-blog-button.test.tsx`
  (156L, 5 cases jsdom).

Arquivos editados (1):
- `app/(auth)/workspace/guides/[slug]/guide-content.tsx` — adiciona
  `<ImportToBlogButton guide={post} />` no header (+3L).

Validação: 39/39 tests novos verdes.

### Body type fix (S10.b regressão, 2026-04-24)

S10.b assumiu erradamente que `EditorShell.initialBody` era Tiptap JSON,
mas o body no Sanity sempre foi Portable Text (`use-autosave` converte
Tiptap → Portable Text antes do PUT desde session 08; S10.e também salva
em Portable Text). Sem conversão no mount, drafts criados pelo importador
e drafts existentes re-abertos quebravam o `setContent`.

Fix:
- `components/editor/editor-shell.tsx` — `initialBody?: PortableTextContent[]`,
  chama `portableToTiptap(initialBody)` no mount antes do `setContent`.
- `app/(auth)/workspace/blog/[id]/edit/page.tsx` — `DraftResponse.body:
  PortableTextContent[]`, troca import de `JSONContent` por
  `PortableTextContent`.

Validação: 174/174 editor tests verdes; full suite **632 passed** (era
586 pós Wave 1, +46 da Wave 2).

### Wave 2 wrap (2026-04-24)

`npx vitest run` — 46 files, **632 tests**, 0 falhas (32.8s).
`npx tsc --noEmit` — 0 erros novos nos arquivos da Wave 2 (pre-existing
unchanged).
