import { PageTitle, H2, P, Table, Callout, CodeBlock } from '../../components';

export default function LlmPage() {
  return (
    <>
      <PageTitle description="Multi-provider LLM: Gemini para custo, Claude para qualidade, Grok para ideacao. Configuravel por node do pipeline.">
        LLM Providers
      </PageTitle>

      <H2>Providers Disponiveis</H2>
      <Table
        headers={['Provider', 'Modelo', 'Input/1M', 'Output/1M', 'Uso Principal']}
        rows={[
          ['Gemini (Google)', 'gemini-3-flash-preview', '$0.50', '$3.00', 'Q&A, geracao, validacao'],
          ['Grok (xAI)', 'grok-4.1-fast', '$0.20', '$0.50', 'Ideacao de conteudo'],
          ['Claude (Anthropic)', 'claude-sonnet-4', '$3.00', '$15.00', 'Conteudo high-quality'],
        ]}
      />

      <H2>Nodes do Pipeline</H2>
      <P>
        Cada etapa do pipeline pode usar um provider/modelo diferente.
        Configuravel em Dashboard &rarr; Config &rarr; LLM Nodes.
      </P>
      <Table
        headers={['Node', 'Provider Default', 'Modelo', 'Descricao']}
        rows={[
          ['default', 'gemini', 'gemini-3-flash-preview', 'Fallback para tudo'],
          ['qa', 'gemini', 'gemini-3-flash-preview', 'Respostas Q&A'],
          ['write', 'gemini', 'gemini-3-flash-preview', 'Geracao de secoes'],
          ['optimize', 'gemini', 'gemini-3-flash-preview', 'SEO optimization'],
          ['ideation', 'xai', 'grok-4.1-fast', 'Geracao de ideias'],
          ['validation', 'gemini', 'gemini-3-flash-preview', 'Validacao de keywords'],
          ['summary', 'gemini', 'gemini-3-flash-preview', 'Summaries poe_meta'],
        ]}
      />

      <H2>Configuracao</H2>
      <CodeBlock title="config/prompt_templates.yaml (excerto)">{`llm:
  default:
    provider: gemini
    model: gemini-3-flash-preview
  nodes:
    ideation:
      provider: xai
      model: grok-4.1-fast
    write:
      provider: gemini
      model: gemini-3-flash-preview`}</CodeBlock>

      <H2>Cost Tracking</H2>
      <P>
        Todas as chamadas LLM sao logadas na tabela <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">llm_usage_logs</code>:
        input tokens, output tokens, latencia, custo estimado, provider, modelo, node.
      </P>
      <Callout type="info" title="Dashboard de custos">
        Dashboard &rarr; /dashboard/llm mostra custos por modelo, por node, por dia.
        Tambem acessivel via GET /seo/pipeline/costs?days=30.
      </Callout>

      <H2>poe-hub LLM</H2>
      <P>
        O poe-hub usa Gemini apenas para o price parser — parsing de mensagens de preco do Discord
        em dados estruturados (preco, moeda, quantidade). Configurado via GEMINI_API_KEY no .env.
      </P>

      <H2>Retry & Rate Limits</H2>
      <Table
        headers={['Aspecto', 'Comportamento']}
        rows={[
          ['Retry', 'Exponential backoff (3 tentativas)'],
          ['Rate limit 429', 'Espera header Retry-After, depois retry'],
          ['Timeout', '30s por chamada (configuravel)'],
          ['Fallback', 'Nenhum — se provider falha, erro retornado'],
        ]}
      />
    </>
  );
}
