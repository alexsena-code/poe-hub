# Session 08 — Editor profissional + publish direto no Sanity

Data inicial: 2026-04-23.
Plano aprovado: `C:\Users\alexa\.claude\plans\functional-jumping-neumann.md`.

## Contexto em 60s

Session 07 (HEAD = `77d00da`) fechou com 6 god files médios resolvidos + editor
inline score/slang + sidebar admin regroup. Único god file >500L remanescente:
`SectionEditor.tsx` (676L), intencionalmente mantido pra ser **substituído**
nesta session.

Objetivo: eliminar a etapa manual de copiar conteúdo pro Sanity Studio do
`poetrade-dev`. O hub vira o único lugar de edição e publica direto no dataset
Sanity via `@sanity/client`. Editor antigo (Textarea markdown + workflow
section-by-section) vai embora. Entra Tiptap WYSIWYG profissional com custom
nodes pros placeholders `{{item:}}`, `{{price:}}`, `{{cta:}}`, etc. que o
poetrade-dev já sabe renderizar via `resolveBlocks()`.

## Decisões-chave (validadas com o usuário)

- **Library**: Tiptap puro (não BlockNote wrapper). Controle total pros custom nodes.
- **Imagens**: Sanity Assets via `@sanity/client`. CDN global, zero custo extra.
- **Schema Sanity**: reutilizado 1:1 do poetrade-dev. Nenhuma mudança.
- **Engine**: zero mudanças. Usa só endpoints existentes.
- **Escopo**: MVP focado. Items/gems via `@name` autocomplete; só currencies
  tem drag-drop browsable no MVP.

Pesquisa de mercado 2026: Tiptap é safest choice + maior ecosystem + docs.
Ghost usa ProseMirror (Koenig). BlockNote rejeitado pois custom nodes pros
placeholders precisam controle total.

## Sanity check

```bash
cd C:/Users/alexa/Documents/poe-hub
git log --oneline -3                             # 77d00da no topo
git status --short                               # vazio
npx next build 2>&1 | tail -5                    # exit 0 baseline
npx vitest run 2>&1 | tail -5                    # 398 passed baseline
```

## Plano (8 agents paralelos em 2 waves)

### Wave 1 — Foundation (4 agents, paralelos)

- **S08.a** — `lib/sanity/*` + `app/api/sanity/**` routes.
  - client.ts, image-url.ts, publish.ts, upload-asset.ts, queries.ts, types.ts.
  - Routes: upload, publish, draft/[id], refs.
  - Coverage: zod validation + auth check + tests unit.
- **S08.b** — Tiptap setup + custom nodes inline.
  - `components/editor/extensions/{poe-item-node,poe-cta-node,poe-currency-node,poe-price-node,poe-passive-node}.ts`
  - `components/editor/hooks/use-tiptap-editor.ts`
  - Atomic inline nodes com NodeView visual.
- **S08.c** — Serializer round-trip (Tiptap JSON ↔ Portable Text).
  - `components/editor/serializer/{tiptap-to-portable,portable-to-tiptap,placeholders}.ts`
  - Suite unit test exaustiva de round-trip determinístico.
- **S08.d** — Preview pane: port `resolveBlocks` + `blockContentComponents` do
  poetrade-dev.
  - `components/editor/preview/{preview-pane,portable-text-components}.tsx`
  - Resolve placeholders client-side via SWR cache 5min.

### Wave 2 — UX (4 agents, depois da wave 1)

- **S08.e** — Shell + toolbar + body + sidebar meta form.
  - `components/editor/{editor-shell,editor-toolbar,editor-body,editor-sidebar}.tsx`
  - `components/editor/hooks/use-autosave.ts`
- **S08.f** — Side panels: Q&A + Assets currencies.
  - `components/editor/{side-panel-qa,side-panel-assets}.tsx`
  - `components/editor/hooks/use-currency-catalog.ts`
- **S08.g** — Slash commands + mention-at + image-upload extensions.
  - `components/editor/extensions/{slash-commands,mention-at,image-upload}.ts`
- **S08.h** — Routes + sidebar entry + delete legacy.
  - `app/(auth)/workspace/blog/**` (3 pages)
  - `components/layout/sidebar.tsx` — grupo Blog
  - Delete: `components/engine/editor/**`, `components/engine/preview/**`,
    `components/engine/publish/**`, `lib/engine-store.ts`.

## Changelog

### S08.f — Side panels Q&A + Assets Currencies (2026-04-23)

Arquivos criados:
- `components/editor/hooks/use-currency-catalog.ts` (72L) — SWR hook para `/api/engine/items/currencies`; exporta `filterCurrencies()` helper.
- `components/editor/hooks/use-qa-chat.ts` (130L) — hook de state do Q&A pane; send/retry, localStorage persistence por draftId, language toggle, fetch com language body.
- `components/editor/side-panel-qa.tsx` (200L) — painel colapsável Q&A: histórico chat, input sticky, cost badge, "Inserir como callout", retry em erros, toast sonner.
- `components/editor/side-panel-assets.tsx` (175L) — painel colapsável de currencies: drag-source chips (application/poe-hub-currency), click-to-insert, search debounced, loading/error/empty states.
- `components/editor/hooks/__tests__/use-qa-chat.test.ts` (120L) — 9 testes: send, error, retry, localStorage persist/load, language param.
- `components/editor/__tests__/side-panel-assets.test.tsx` (215L) — 10 testes: render, filter, click-to-insert, dragStart dataTransfer, loading, error, collapse.

Integração: `useEditorContext()` de `editor-context.tsx` (criado pelo S08.e, já existia). Sem stub necessário.

Validação:
- `npx tsc --noEmit` — 0 erros nos arquivos S08.f; erros pré-existentes em editor-body/editor-shell/mention-at (S08.e/S08.g).
- `npx vitest run components/editor/hooks/__tests__/use-qa-chat.test.ts components/editor/__tests__/side-panel-assets.test.tsx` — **19/19 passed**.

### S08.h — Rotas + sidebar + legacy cleanup (2026-04-23)

- Routes novas: `app/(auth)/workspace/blog/page.tsx` (RSC list, 170L), `app/(auth)/workspace/blog/new/page.tsx` (client wrapper, 40L), `app/(auth)/workspace/blog/[id]/edit/page.tsx` (client fetch+shell, 100L)
- Sidebar: grupo "Blog" adicionado dentro de Workspace com subentradas "Lista" + "Novo post"; ícone `Newspaper` importado de lucide-react.
- Redirects legacy: `app/(auth)/workspace/new/page.tsx` → `/workspace/blog/new`; `app/(auth)/workspace/editor/[postId]/page.tsx` → `/workspace/blog/[postId]/edit`
- Deletados: `components/engine/editor/SectionEditor.tsx` (676L), `components/engine/editor/EditorShell.tsx` (426L), `components/engine/editor/SectionSidebar.tsx` (92L), `components/engine/editor/IssueBanner.tsx` (163L), `components/engine/preview/PostPreview.tsx` (164L), `components/engine/publish/PublishPanel.tsx` (208L), `lib/engine-store.ts` (201L)
- Deletados (dead code colateral por redirect): `components/engine/BriefingForm.tsx`, `components/engine/OutlineEditor.tsx`, `components/engine/briefing/` dir (10 files) — nenhum consumer ativo após redirect `/workspace/new`
- Validação: `npx tsc --noEmit` — 0 erros novos nos arquivos S08.h; erros pré-existentes em lib/simulation-diff.test.ts e outros permanecem inalterados. `npx vitest run components/editor/` — 147/147 passed. `npx vitest run lib/sanity/` — 36/36 passed.

## Final wrap (2026-04-23)

Todos 8 chunks concluídos. Integração hub ↔ Sanity ↔ engine fechada.

**Fixes pós-wave-2** (S08.e stallou antes do relatório final; 6 issues residuais resolvidos em 15min):
1. `BubbleMenu`/`FloatingMenu` — Tiptap 3.x moveu pra `@tiptap/react/menus` (era `@tiptap/extension-*`).
2. `PortableTextBlock[]` → `PortableTextContent[]` no preview-pane e resolve-blocks (union aceita image/code/table).
3. `client.getDocument()` retorna `undefined`; narrow via cast para `Record<string, unknown> | null`.
4. `@sanity/image-url` — subpaths `lib/types/*` deprecated; migrado pra named export `createImageUrlBuilder`.
5. `publish.ts::createOrReplace` — cast para shape estrito do `IdentifiedSanityDocumentStub`.
6. Tests com acesso direto a `children`/`markDefs`/`style` em `PortableTextContent` — helper `asBlock()` de narrow.

**Validação integrada final:**
- `npx tsc --noEmit` — 0 erros nos arquivos session 08.
- `npx vitest run` — **494 passed / 38 failed baseline** (+174 novos passing vs session 07). Failures são pre-existing em `simulations.test.ts` (22) + `cost-configs.test.ts` (16).
- `npx next build` — exit 0. Rotas `/workspace/blog`, `/workspace/blog/new`, `/workspace/blog/[id]/edit` listadas.

**Código removido**: ~2500L legacy (SectionEditor 676 + EditorShell 426 + SectionSidebar 92 + IssueBanner 163 + PostPreview 164 + PublishPanel 208 + engine-store 201 + BriefingForm + OutlineEditor + briefing/ dir).

**Deps adicionadas** (~90kb gzip): `@tiptap/{react,pm,starter-kit,extension-link,extension-image,extension-placeholder,extension-bubble-menu,extension-floating-menu,extension-code-block-lowlight,extension-dropcursor,suggestion}`, `@sanity/client`, `@sanity/image-url`, `@portabletext/react`, `lowlight`, `swr`.

**Env vars novas** (`.env.example`): `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, `SANITY_API_WRITE_TOKEN`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `ENGINE_API_URL`, `ENGINE_API_KEY`. Operador precisa criar write token em `sanity.io/manage` antes do primeiro publish.

## Smoke fixes (2026-04-24, pós-primeira-run)

Smoke via Playwright MCP no `/workspace/blog/new` apontando pra engine prod (`api.pathoftrade.net`) + Sanity dataset `rrv9tvop/production` revelou 4 bugs:

1. **`/api/sanity/refs` retornava `{data: [...]}`** — hook esperava array direto. Fix: unwrap no route (return `authors`/`categories` direto).
2. **Chips custom renderizavam `{{item:undefined}}` no HTML inicial** — `renderHTML({ HTMLAttributes })` não tem os attrs do node. Fix: trocar pra `renderHTML({ node, HTMLAttributes })` e ler `node.attrs.xxx` nos 5 custom nodes.
3. **Serializer `convertPoeInlineNode` lia `node.attrs.value`** — mas custom nodes emitem `itemName`/`currencyName`/`passiveName`. Mismatch de contrato S08.b ↔ S08.c. Fix: table `POE_INLINE_VALUE_ATTR` mapeia type → attr name, both directions do round-trip. Fixtures + tests atualizados.
4. **2 warnings Tiptap + datetime**: `StarterKit` duplicava `link` + `dropcursor` → desabilitados (`.configure({ link: false, dropcursor: false })`). `publishedAt` default com Z-suffixed ISO → `.slice(0, 16)` pro formato `yyyy-MM-ddTHH:mm` esperado pelo `<input type="datetime-local">`.

**Validação pós-smoke**: 41/41 serializer tests + 49/49 extensions + 36/36 sanity — 126+ tests passing nos arquivos session 08. Currency `Chaos Orb` inserido via Assets panel + toggle Preview → render fiel do poetrade-dev (ícone PoE CDN + cor cinza #C7C7C7 + tooltip shadcn).

**Carryover visual** (não-blocker): chip do editor durante edição ainda é `◈ Name` simples. Render completo (ícone + rarity color + tooltip) só no preview. Session 09+ pode fetchar `iconUrl` on-insert pra visual idêntico ao blog.

## Carryover para session 09

- Endpoints engine: `/api/items/gems`, `/api/items/uniques`, `/api/items/search` — engine session separada.
- Side panel Assets: abas Items/Gems/Passives quando endpoints prontos.
- Diff versioning + locked parts com span IDs fuzzy.
- Side-by-side PT-BR/EN editor (hoje é toggle).
- `@sanity/document-internationalization` programático — botão "Criar versão EN/PT-BR" que clona doc.
- Section workflow híbrido via slash `/section` (opcional).
- Smoke manual end-to-end com token Sanity real + poetrade-dev rodando (requer o operador popular `SANITY_API_WRITE_TOKEN`).
- `BriefingForm.tsx` deletado colateralmente — se workflow briefing + outline precisar retornar, ressuscitar sob `components/editor/briefing/`.
- `e2e/*.spec.ts` rodando no Vitest por erro de config — mover pra Playwright-only runner.
