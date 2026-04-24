import { PageTitle, H2, P, Steps, Step, Callout, Diagram, Table } from '../../components';

export default function GuidePublishingPage() {
  return (
    <>
      <PageTitle description="Como publicar guides gerados pela engine e exibi-los no site publico (pathoftrade.net).">
        Publicando Guides
      </PageTitle>

      <Diagram title="Fluxo de publicacao">{`
  Content Engine (engine.pathoftrade.net)
      |  1. Criar post no co-writer (/new)
      |  2. Gerar secoes (AI + human input)
      |  3. Publicar (status -> published)
      v
  API (api.pathoftrade.net)
      |  GET /content/posts
      |  GET /content/posts/:slug
      v
  poe-hub (pathoftrade.net)
      |  /guides        -> lista de guides
      |  /guides/[slug] -> guide individual
      v
  Google / Usuarios
      `}</Diagram>

      <H2>Passo a Passo</H2>
      <Steps>
        <Step number={1} title="Criar e gerar conteudo">
          Use o co-writer em /new. Gere todas as secoes, revise, edite.
        </Step>
        <Step number={2} title="Publicar">
          No painel de publicacao, clique &quot;Publicar&quot;. O post muda de &quot;draft&quot; para &quot;published&quot;
          e fica disponivel via API.
        </Step>
        <Step number={3} title="Verificar no site">
          Acesse pathoftrade.net/guides para ver o guide listado.
          Clique para abrir pathoftrade.net/guides/[slug].
        </Step>
        <Step number={4} title="Download alternativo">
          Se preferir importar manualmente, use os botoes de download:
          JSON completo, Markdown PT-BR, ou Markdown EN.
        </Step>
      </Steps>

      <H2>Formato do Post</H2>
      <Table
        headers={['Campo', 'Descricao']}
        rows={[
          ['slug', 'URL-friendly identifier (auto-gerado do titulo)'],
          ['title', 'Bilingual: { "pt-br": "...", "en": "..." }'],
          ['template', 'build_guide, mechanic_guide, faq, etc.'],
          ['status', 'draft ou published'],
          ['sections[]', 'Array de secoes com id, title, content bilingual'],
          ['meta', 'SEO metadata: keyword, description, schema_type'],
          ['generatedAt', 'Timestamp de geracao'],
        ]}
      />

      <H2>Guides no poe-hub</H2>
      <P>
        O poe-hub renderiza guides usando o componente em /guides/[slug]/page.tsx.
        Suporta toggle PT-BR / EN, mostra metadata SEO, e renderiza Markdown.
      </P>

      <Callout type="info" title="SSG futuro">
        Atualmente os guides sao server-rendered. O plano e migrar para SSG com ISR
        (revalidate on content update) para performance maxima e SEO.
      </Callout>

      <H2>Gerenciando Posts</H2>
      <Table
        headers={['Acao', 'Como']}
        rows={[
          ['Ver todos', '/workspace/guides no dashboard (filtro all/draft/published)'],
          ['Editar', 'Clique em qualquer post para reabrir no co-writer'],
          ['Despublicar', 'PUT /content/posts/:slug com status: "draft"'],
          ['Deletar', 'DELETE /content/posts/:slug'],
        ]}
      />
    </>
  );
}
