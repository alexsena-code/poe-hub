import { PageTitle, H2, P, Table, Diagram, Callout, CodeBlock } from '../../components';

export default function RagPage() {
  return (
    <>
      <PageTitle description="Como o sistema monta contexto para o LLM usando 3 camadas de dados: PostgreSQL, Qdrant chunks, e summaries.">
        RAG & Context Assembly
      </PageTitle>

      <Diagram title="Context Assembly por query">{`
  Query: "how does RF scale?"
      |
      v
  Query Router (auto-detect: mechanic_question)
      |
      v
  Context Assembly
      |
      +---> Camada 1: PostgreSQL (~30 tokens)
      +---> Camada 2: Qdrant top-5 reranked (~1500 tokens)
      +---> Camada 3: poe_meta summary (~150 tokens)
      |
      v
  LLM Prompt (< 1,200 tokens contexto)
      |
      v
  Resposta Gerada
      `}</Diagram>

      <H2>Query Routing</H2>
      <P>
        O sistema detecta automaticamente o tipo de query e roteia para as collections e camadas corretas.
        Configuravel em config/prompt_templates.yaml.
      </P>
      <Table
        headers={['Tipo', 'Trigger', 'Collections', 'Camadas']}
        rows={[
          ['stat_lookup', 'DPS, mana cost, level req', 'poe_wiki', 'exact_data'],
          ['mechanic_question', 'How X works, scaling', 'poe_wiki, poe_transcripts', 'exact_data, chunks, summary'],
          ['build_guide', 'Class names, "build"', 'poe_wiki, builds, transcripts, reddit', 'todas'],
          ['patch_analysis', 'Patch, nerf, buff', 'poe_wiki, patch_notes, ggg_news', 'exact_data, chunks, summary'],
          ['community', 'Streamer, TFT, ban, RMT', 'poe_reddit, transcripts, youtube_trends', 'chunks + PoE People DB'],
          ['qa (default)', 'Todo o resto', 'poe_wiki, poe_transcripts', 'todas'],
        ]}
      />

      <H2>Prompt Structure</H2>
      <CodeBlock title="Template do prompt LLM">{`[System prompt: style guide + template instructions]

## DADOS EXATOS
{compact JSON from PostgreSQL}

## CONTEXTO
[top-K reranked chunks from Qdrant]

## OVERVIEW (optional, for broad queries)
[summary from poe_meta]

## BRIEFING
{user's brief + per-section opinions if co-writing}

## INSTRUCAO
{what to generate for this section}`}</CodeBlock>

      <Callout type="warning" title="Budget de tokens">
        Target: &lt; 1,200 tokens de contexto por chamada LLM (excluindo system prompt).
        Para build guides com multiplas secoes, cada secao recebe seu proprio context assembly.
      </Callout>

      <H2>Token Budget</H2>
      <Table
        headers={['Camada', 'Max Tokens']}
        rows={[
          ['exact_data (PostgreSQL)', '200'],
          ['chunks (Qdrant)', '800'],
          ['summary (poe_meta)', '200'],
          ['Total contexto', '1,200'],
        ]}
      />

      <H2>Cross-Language</H2>
      <P>
        Queries em PT-BR sao enriquecidas com keywords em EN para melhor matching no Qdrant
        (o conteudo indexado e majoritariamente em ingles). A resposta e gerada no idioma solicitado.
      </P>

      <H2>Response Hints</H2>
      <P>
        Quando o sistema detecta o tipo de pagina (unique item, skill gem, etc.), injeta instrucoes
        especificas no prompt para guiar a qualidade da resposta.
      </P>
      <Table
        headers={['Tipo', 'Instrucao']}
        rows={[
          ['unique_item', 'Incluir: drop location, build synergies, price trend'],
          ['skill_gem', 'Incluir: gem links, scaling, ascendancy synergies'],
          ['currency', 'Incluir: farming methods, ratios, vendor recipes'],
          ['mechanic', 'Incluir: how it works, interactions, breakpoints'],
        ]}
      />
    </>
  );
}
