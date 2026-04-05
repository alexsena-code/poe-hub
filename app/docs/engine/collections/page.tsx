import { PageTitle, H2, P, Table, Callout, CodeBlock } from '../../components';

export default function CollectionsPage() {
  return (
    <>
      <PageTitle description="8 collections no Qdrant com 70K+ chunks. Cada collection tem vetores de 1024 dimensoes (mxbai-embed-large-v1).">
        Qdrant Collections
      </PageTitle>

      <H2>Collections (Camada 2 — Chunks)</H2>
      <Table
        headers={['Collection', 'Conteudo', 'Fonte', 'Points']}
        rows={[
          ['poe_wiki', 'Wiki articles: mecanicas, items, skills, passives', 'PoE Wiki Cargo API + Crawl4AI', '~65K'],
          ['poe_reddit', 'Posts e comentarios de comunidade', 'Reddit JSON (3 subs, diario)', '~1.7K'],
          ['poe_builds', 'Build guides, PoB data, Reddit build posts', 'Reddit + poe.ninja', '~1.7K'],
          ['poe_transcripts', 'Transcripts de videos YouTube', 'youtube-transcript-api', '~800'],
          ['poe_patch_notes', 'Patch notes, balance changes', 'GGG Official', '~200'],
          ['poe_ggg_news', 'Dev manifestos, league announcements', 'GGG Official', '~40'],
          ['poe_youtube_trends', 'Metadata de videos trending', 'YouTube Data API', '~400'],
        ]}
      />

      <H2>Collection (Camada 3 — Summaries)</H2>
      <Table
        headers={['Collection', 'Conteudo', 'Gerado por']}
        rows={[
          ['poe_meta', 'Resumos ~150 tokens por pagina/topico', 'Claude Haiku on-demand (cached)'],
        ]}
      />

      <H2>Regras de Chunking</H2>
      <Callout type="warning" title="Critico">
        Chunks contem APENAS texto narrativo. Nunca tabelas de stats ou dados numericos (esses vao para PostgreSQL).
      </Callout>
      <Table
        headers={['Regra', 'Detalhe']}
        rows={[
          ['Tamanho', '200-400 tokens por chunk'],
          ['Split primario', 'Wiki section headings (##, ###)'],
          ['Split secundario', 'Por paragrafo se secao > 400 tokens, com 50-token overlap'],
          ['Nunca split', 'No meio de uma frase'],
          ['Token counter', 'tiktoken (cl100k_base), nao character count'],
          ['Strip antes', 'HTML tags, wiki templates, nav links, references, whitespace'],
        ]}
      />

      <H2>Metadata Payload</H2>
      <P>Cada chunk no Qdrant tem metadata rica para filtragem e contexto:</P>
      <CodeBlock title="Payload de exemplo">{`{
  "source": "poewiki",
  "source_url": "https://poewiki.net/wiki/Righteous_Fire",
  "page_title": "Righteous Fire",
  "section": "Mechanics",
  "category": "mechanic_explanation",
  "tags": ["righteous fire", "fire damage", "burning"],
  "entity_names": ["Righteous Fire", "Pious Path"],
  "patch_version": "3.28",
  "last_updated": "2026-03-15T00:00:00Z",
  "token_count": 287,
  "pg_entity_ids": ["skill_123", "item_456"]
}`}</CodeBlock>

      <H2>Collection Weights</H2>
      <P>
        Pesos multiplicadores aplicados ao score de RAG. Wiki = 1.0 (baseline), Reddit = 0.5 (menor confianca).
        Configuravel em Dashboard &rarr; Config &rarr; Collection Weights.
      </P>
      <Table
        headers={['Collection', 'Peso Default']}
        rows={[
          ['poe_wiki', '1.0'],
          ['poe_transcripts', '0.8'],
          ['poe_patch_notes', '0.9'],
          ['poe_ggg_news', '0.9'],
          ['poe_reddit', '0.5'],
          ['poe_builds', '0.6'],
          ['poe_youtube_trends', '0.4'],
          ['poe_meta', '0.7'],
        ]}
      />

      <H2>Embedding</H2>
      <Table
        headers={['Aspecto', 'Valor']}
        rows={[
          ['Modelo', 'mxbai-embed-large-v1 (Mixedbread)'],
          ['Dimensoes', '1024'],
          ['Servico', 'HuggingFace TEI (Docker)'],
          ['Batch size', 'Ate 32 textos por request'],
          ['Fallback', 'Mixedbread API (.com) se TEI offline'],
        ]}
      />
    </>
  );
}
