import { PageTitle, H2, P, Table, CodeBlock, Callout } from '../../components';

export default function TemplatesPage() {
  return (
    <>
      <PageTitle description="Templates YAML definem a estrutura do conteudo gerado. Cada template tem secoes, queries RAG, e config SEO.">
        Templates & Style Guide
      </PageTitle>

      <H2>Templates Disponiveis</H2>
      <Table
        headers={['Template', 'Arquivo', 'Uso']}
        rows={[
          ['Build Guide', 'config/templates/build_guide.yaml', 'Guias completos de build (requer PoB)'],
          ['Mechanic Guide', 'config/templates/mechanic_guide.yaml', 'Explicacao de mecanicas do jogo'],
          ['FAQ', 'config/templates/faq.yaml', 'Perguntas frequentes (long-tail SEO)'],
          ['Tier List', 'config/templates/tier_list.yaml', 'Rankings sazonais'],
          ['Patch Analysis', 'config/templates/patch_analysis.yaml', 'Analise de patch notes'],
        ]}
      />

      <H2>Estrutura de um Template</H2>
      <CodeBlock title="Exemplo: build_guide.yaml">{`template:
  name: "Build Guide"
  slug_pattern: "{skill}-{ascendancy}-build-guide-{league}"
  target_length_words: 2000-3000
  output_languages: ["pt-br", "en"]
  max_tokens_per_section: 3000

sections:
  - id: tldr
    title: "TL;DR"
    instruction: "3-sentence summary of the build..."
    query_type: build_guide
    rag_queries: ["{skill} {ascendancy} overview"]
    requires_human_input: false
    max_tokens: 500

  - id: pros_cons
    title: "Pros & Cons"
    instruction: "List 4-5 pros and 3-4 cons..."
    query_type: build_guide
    rag_queries: ["{skill} strengths weaknesses"]
    requires_human_input: true
    max_tokens: 600

  - id: gear
    title: "Gear Guide"
    instruction: "Recommend gear for each slot..."
    query_type: stat_lookup
    rag_queries: ["{skill} best items", "{ascendancy} gear"]
    requires_human_input: true
    max_tokens: 1500

seo:
  primary_keyword: "{skill} {ascendancy} build guide"
  secondary_keywords: ["{skill} poe", "{ascendancy} build"]
  schema_type: HowTo
  meta_description_template: "Complete {skill} {ascendancy} build guide for {league}..."`}</CodeBlock>

      <H2>Campos do Template</H2>
      <Table
        headers={['Campo', 'Tipo', 'Descricao']}
        rows={[
          ['id', 'string', 'Identificador unico da secao'],
          ['title', 'string', 'Titulo exibido no post'],
          ['instruction', 'string', 'Prompt para o LLM'],
          ['query_type', 'string', 'Tipo de query para context assembly'],
          ['rag_queries', 'string[]', 'Queries de busca no Qdrant'],
          ['requires_human_input', 'boolean', 'Se precisa de opiniao do usuario (co-writer)'],
          ['max_tokens', 'number', 'Limite de tokens da resposta LLM'],
        ]}
      />

      <H2>Style Guide</H2>
      <P>
        O style guide e um YAML que define voz, tom, regras de escrita, e frases banidas.
        Injetado como system prompt em todas as chamadas LLM de geracao de conteudo.
      </P>
      <CodeBlock title="config/style_guide.yaml (exemplo)">{`voice:
  tone: "authoritative but approachable"
  perspective: "experienced player helping a friend"
  formality: "semi-formal, technical terms ok"

rules:
  - "Always include exact numbers from PostgreSQL data"
  - "Never say 'in my opinion' — state facts from data"
  - "Use PoE community terminology naturally"
  - "PT-BR: use 'voce' not 'tu', keep PoE terms in English"

banned_phrases:
  - "neste artigo vamos explorar"
  - "sem mais delongas"
  - "mergulhe neste guia"
  - "no vasto mundo de"
  - "whether you're a seasoned veteran"

formatting:
  - "Use H2 for main sections, H3 for subsections"
  - "Tables for stat comparisons"
  - "Bold for item/skill names on first mention"
  - "Code blocks for PoB import strings"`}</CodeBlock>

      <Callout type="tip" title="Editavel pelo dashboard">
        Style guide e templates sao editaveis em Dashboard &rarr; Config &rarr; tabs &quot;Style Guide&quot; e &quot;Templates&quot;.
        Alteracoes aplicam imediatamente em novas geracoes.
      </Callout>
    </>
  );
}
