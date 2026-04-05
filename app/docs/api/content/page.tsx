import { PageTitle, H2, P, EndpointGroup, Endpoint, Callout, CodeBlock } from '../../components';

export default function ContentApiPage() {
  return (
    <>
      <PageTitle description="Endpoints para geracao de conteudo, templates, posts, e co-writer.">
        Content API
      </PageTitle>

      <P>Base URL: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">api.pathoftrade.net/api</code> (producao) ou <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">localhost:3000/api</code> (dev)</P>

      <EndpointGroup title="Geracao">
        <Endpoint method="POST" path="/content/generate" description="Gerar conteudo completo a partir de briefing. Body: {template, variables, brief}" />
        <Endpoint method="POST" path="/content/outline" description="Gerar outline (estrutura de secoes) para um briefing" />
        <Endpoint method="POST" path="/content/write-section" description="Gerar uma secao individual. Body: {sectionId, template, variables, humanInput?}" />
        <Endpoint method="POST" path="/content/rewrite-selection" description="Regerar trecho selecionado. Body: {text, instruction?, sectionId}" />
        <Endpoint method="POST" path="/content/optimize-seo" description="Otimizar conteudo para SEO. Body: {content, keyword}" />
      </EndpointGroup>

      <EndpointGroup title="Posts">
        <Endpoint method="GET" path="/content/posts" description="Lista todos os posts. Query: ?status=draft|published" />
        <Endpoint method="GET" path="/content/posts/:slug" description="Detalhes do post por slug (JSON com secoes + meta)" />
        <Endpoint method="GET" path="/content/posts/:slug/md" description="Post em Markdown (PT-BR ou EN). Query: ?lang=pt-br|en" />
        <Endpoint method="POST" path="/content/posts" description="Salvar novo post (draft)" />
        <Endpoint method="PUT" path="/content/posts/:slug" description="Atualizar post existente" />
        <Endpoint method="DELETE" path="/content/posts/:slug" description="Deletar post" />
        <Endpoint method="PATCH" path="/content/posts/:slug/publish" description="Publicar post (muda status para published)" />
      </EndpointGroup>

      <EndpointGroup title="Templates">
        <Endpoint method="GET" path="/content/templates" description="Lista templates disponiveis (YAML files)" />
      </EndpointGroup>

      <H2>Exemplo: Gerar Secao</H2>
      <CodeBlock title="POST /content/write-section">{`{
  "template": "build_guide",
  "sectionId": "gear",
  "variables": {
    "skill": "Righteous Fire",
    "ascendancy": "Chieftain",
    "league": "Settlers of Kalguur"
  },
  "humanInput": "Focar em gear budget-friendly, mencionar Searing Touch"
}`}</CodeBlock>

      <H2>Exemplo: Response de Post</H2>
      <CodeBlock title="GET /content/posts/righteous-fire-chieftain">{`{
  "slug": "righteous-fire-chieftain-build-guide",
  "title": {
    "pt-br": "Guia de Build RF Chieftain",
    "en": "RF Chieftain Build Guide"
  },
  "template": "build_guide",
  "status": "draft",
  "generatedAt": "2026-04-01T10:00:00Z",
  "sections": [...],
  "meta": {
    "primaryKeyword": "righteous fire chieftain build guide",
    "metaDescription": { "pt-br": "...", "en": "..." }
  }
}`}</CodeBlock>

      <Callout type="info" title="Co-writer UI">
        O frontend em /new usa esses endpoints para o fluxo de co-writing secao por secao.
        Auto-save a cada 5 segundos via POST/PUT /content/posts.
      </Callout>
    </>
  );
}
