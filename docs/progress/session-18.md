# Session 18 — Editor image insertion: upload + WebP + responsive layout

Tema: destravar o fluxo de inserir imagens no editor de blog. Toda a infra
existia (uploader, route handler, serializers, preview, slash command,
extension Tiptap) mas nada estava plugado — `useTiptapEditor` ignorava
`useSlashCommands`, então paste/drop/`/image`/mention não funcionavam.

Junto: pipeline de WebP no upload, captura de dimensões naturais, layout
responsivo no preview com breakout para imagens estourarem a coluna do
prose em viewports grandes, e CSS espelhado no `poetrade-dev` (renderer
público) para manter parity.

## Wire-up das extensions (estavam dead code)

`components/editor/hooks/use-tiptap-editor.ts` — `buildEditorExtensions`
agora espalha `buildSlashExtension()`, `buildMentionExtension()` e
`buildImageUploadExtension()`. Antes, o editor só tinha StarterKit + base
Image; o slash `/`, o `@`-mention e o paste/drop de imagem só existiam no
arquivo, sem nunca rodarem.

## Pipeline de upload (image-upload.ts reescrita)

`components/editor/extensions/image-upload.ts` agora roda:

1. `validateOriginalFile` — checa MIME (jpeg/png/gif/webp; SVG e AVIF
   removidos do whitelist por XSS / inconsistência com backend) + 8MB cap.
2. `decodeImage` — `new Image()` em memória para ler `naturalWidth`/
   `naturalHeight`.
3. `clampDimensions` — escala lado mais longo até MAX_DIMENSION (1920px).
4. `encodeAsWebp` — `<canvas>.toBlob('image/webp', 0.85)`. Skipped para
   GIF (animação) e WebP (já ótimo). Fallback no original se falhar.
5. `uploadBlob` — multipart POST para `/api/sanity/upload`.
6. `insertImageNode` — node Tiptap com `src`, `alt`, `data-sanity-ref`,
   `width`, `height`.

Drop handler reescrito sem o `@ts-expect-error` / `void tr` que estava
no código original — agora usa `TextSelection.create` direto.

## Schema Tiptap + serializers

`use-tiptap-editor.ts` extende `Image` via `addAttributes` para declarar
`data-sanity-ref`, `width`, `height` no schema do ProseMirror. Sem isso,
attrs não-declarados eram silenciosamente descartados por
`imageNode.create({...})` — o que fez o serializer cair no fallback
`_ref: src` e quebrar o `@sanity/image-url` com "Malformed asset _ref".

`tiptap-to-portable.ts` e `portable-to-tiptap.ts` propagam `width`/
`height` em ambos os sentidos. `portable-to-tiptap.convertImageBlock`
agora monta uma URL renderável via `imageUrlFor(...).auto('format').url()`
(antes punha o ref bruto no `src`, gerando `<img src="image-Tb9...-2000x3000-jpg">`
não-renderável quando reabria um post salvo).

`lib/sanity/types.ts` — `PortableTextImageBlock` ganhou `width?: number`
e `height?: number` opcionais.

## CSS responsivo + breakout

Editor (`use-tiptap-editor.ts:122-133`):
```
editor-image rounded-md block mx-auto w-auto h-auto
max-w-full max-h-[80vh] object-contain
```

`w-auto h-auto` anula os HTML attrs `width`/`height` que o `addAttributes`
injeta no `<img>` (senão imagem retrato 746×1653 renderizava em tamanho
nativo e estourava a viewport).

Preview (`portable-text-components.tsx:198-247`):
```
my-10 flex justify-center overflow-hidden rounded-[15px]
lg:-mx-40 xl:-mx-72
```

Imagem com `width:100% + height:auto + max-height:80vh + object-contain`.
Margens negativas escapam do `max-w-3xl` (768px) do prose. Larguras
efetivas: lg ≈1088px, xl ≈1344px (ultrawide).

## Listener do picker + botão no toolbar

`editor-shell.tsx:142-152` — `useEffect` que registra
`window.addEventListener('editor:open-image-picker', openImageFilePicker(view))`.
Ouvido por dois disparadores:

- Slash `/image` (`extensions/slash-commands.ts:188-198`) já existente.
- Botão "Inserir imagem" novo no toolbar (`editor-toolbar.tsx`).

## next.config.ts

`next.config.ts` ganhou `images.remotePatterns` com
`https://cdn.sanity.io/images/**`. Sem isso, `next/image` rejeitava as
URLs do Sanity com "hostname not configured".

## poetrade-dev — replicação no renderer público

`poetrade-dev/components/portable-text/blockContentComponents.tsx:24-65`
recebeu o mesmo CSS responsivo + breakout, ajustado para o `max-w-5xl`
(1024px) da página de blog:

```
xl:-mx-24 2xl:-mx-48 min-[1920px]:-mx-72
```

Larguras efetivas: xl 1216px, 2xl 1408px, ≥1920 1600px.

Schema do Sanity (`sanity/schemas/blockContent.ts`) inalterado — o
`getImageDimensions` do `@sanity/asset-utils` parseia dimensões do
`asset._ref` (formato `image-{hash}-{w}x{h}-{ext}`), então metadata
hidratado via GROQ não é necessário.

## Testes

`components/editor/extensions/__tests__/image-upload.test.ts`:
- Removida a asserção de aceitar AVIF (agora rejeitado).
- Adicionado teste do whitelist completo (jpeg/png/gif/webp).
- Adicionado teste rejeitando AVIF + SVG sem chamar fetch.
- 5 testes novos para `clampDimensions` (boundary, 4K landscape,
  retrato, arredondamento).

Suite do editor: **200 testes passando** (era 195). Typecheck mantém os
mesmos 29 erros pré-existentes — nenhum novo introduzido.

Validação: `npx vitest run components/editor` + `npx tsc --noEmit |
grep error`.

## Arquivos tocados

poe-hub:
- `components/editor/hooks/use-tiptap-editor.ts`
- `components/editor/extensions/image-upload.ts`
- `components/editor/extensions/__tests__/image-upload.test.ts`
- `components/editor/serializer/tiptap-to-portable.ts`
- `components/editor/serializer/portable-to-tiptap.ts`
- `components/editor/preview/portable-text-components.tsx`
- `components/editor/editor-shell.tsx`
- `components/editor/editor-toolbar.tsx`
- `lib/sanity/types.ts`
- `next.config.ts`

poetrade-dev:
- `components/portable-text/blockContentComponents.tsx`
