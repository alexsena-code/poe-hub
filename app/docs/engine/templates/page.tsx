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

      <H2>Placeholders (renderizados pelo site em runtime)</H2>
      <P>
        O LLM cita entidades atraves de placeholders que o site resolve server-side ao renderizar
        o post. Evita numeros hardcoded que envelhecem mal e garante tooltips/icones consistentes
        com o resto da UI.
      </P>
      <P>
        Gramatica: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">{'{{kind:value}}'}</code> ou <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">{'{{kind:value|modifier}}'}</code>.
        Valores sao greedy ate <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">|</code> ou <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">{'}}'}</code>,
        entao nomes multi-palavra (ex: &quot;Mirror of Kalandra&quot;) funcionam sem escape.
      </P>
      <Table
        headers={['Kind', 'Uso', 'Exemplo']}
        rows={[
          ['price', 'Preco live de poe.ninja formatado pela liga atual', '{{price:Headhunter|divine}}'],
          ['link', 'Link interno pra guia/produto/build no pathoftrade.net', '{{link:Mageblood}}'],
          ['item', 'Card inline com icone + tooltip (unique / currency / scarab / gem)', '{{item:Divine Orb}}'],
          ['passive', 'Tooltip in-game de node da arvore passiva (notable/keystone/ascendancy/mastery)', '{{passive:Lethality}}'],
          ['pobitem', 'Item de um snapshot PoB (rolls reais, nao o base template)', '{{pobitem:<cuid>}}'],
          ['cta', 'Banner de marketplace block-level (currency / single product)', '{{cta:currency}}'],
        ]}
      />

      <H2>Placeholder CTA — uso e sintaxe</H2>
      <P>
        Banner de marketplace reutilizavel. Block-level (deve ocupar um paragrafo sozinho — uso
        embutido em prosa e silenciosamente descartado). Copy cita automaticamente a liga temp
        ativa (&quot;Buy orbs in Mirage with fast delivery...&quot;).
      </P>
      <CodeBlock title="Sintaxe {{cta:...}}">{`{{cta:currency}}                       # 3 orbs default pro gameVersion do post
{{cta:product|divine-orb}}             # single-product card com icone + preco
{{cta:currency|poe2}}                  # force PoE 2 currency banner
{{cta:product|mirror-of-kalandra|poe2}}  # PoE 2 single-product (modifier multipart)`}</CodeBlock>
      <P>
        Tokens aceitos pra gameVersion override: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">poe1</code> / <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">poe-1</code> / <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">path-of-exile-1</code> e as variantes com <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">2</code>. Case-insensitive, ordem dos modifiers livre.
      </P>

      <H2>Resolucao de gameVersion (hibrida)</H2>
      <Table
        headers={['Origem', 'Quando vence']}
        rows={[
          ['Modifier do placeholder', 'Sempre que presente ({{cta:currency|poe2}}) — override explicito'],
          ['ResolveContext.gameVersion', 'Herda do post (Sanity post.gameVersion propagado no /blog/[slug])'],
          ['Default', 'path-of-exile-1 quando nao ha modifier nem contexto'],
        ]}
      />
      <Callout type="info" title="LLM nao precisa marcar gameVersion">
        Em 95% dos casos o LLM apenas escreve <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">{'{{cta:currency}}'}</code> e o banner herda automaticamente
        o jogo do post. Override com <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">|poe2</code> so e necessario em posts que misturam jogos
        (pecas de comparacao — raras).
      </Callout>

      <H2>Regras de uso (do style_guide.yaml)</H2>
      <Table
        headers={['Regra', 'Motivo']}
        rows={[
          ['No maximo 1 CTA por secao principal', 'Mais que isso parece SEO spam e distrai do conteudo'],
          ['Nunca dois CTAs seguidos', 'Quebra o ritmo de leitura'],
          ['Bom contexto: fim de "Cost & League Pacing"', 'Reader natural point of decision'],
          ['Bom contexto: entre budget tier e endgame tier', 'Transicao que encaixa oferta de currency'],
          ['Ruim: cada secao', 'Overexposure'],
          ['Ruim: no meio de prosa', 'Block-level — nao funciona embutido'],
        ]}
      />

      <Callout type="tip" title="Testar localmente">
        A pagina <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">/preview/cta</code> no site renderiza um post mock com todas as variantes (standalone,
        inline-dropado, product, override poe2) pra validar mudancas no layout sem publicar.
      </Callout>
    </>
  );
}
