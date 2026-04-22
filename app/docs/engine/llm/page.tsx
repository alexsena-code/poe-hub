import { PageTitle, H2, P, Table, Callout, CodeBlock } from '../../components';

export default function LlmPage() {
  return (
    <>
      <PageTitle description="OpenRouter: todos os modelos via API unica. Configuravel por node do pipeline, com filas BullMQ para geracao assincrona.">
        LLM Providers
      </PageTitle>

      <H2>OpenRouter</H2>
      <P>
        Todas as chamadas LLM do Content Engine passam pelo OpenRouter — uma API unica que da acesso
        a modelos de Google, Anthropic, OpenAI, xAI, DeepSeek e outros. Basta uma chave: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">OPENROUTER_API_KEY</code>.
      </P>
      <P>
        Os modelos sao referenciados no formato <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">provider/model</code> (ex: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">google/gemini-2.5-flash-lite</code>).
      </P>

      <H2>Modelos Disponiveis (exemplos)</H2>
      <Table
        headers={['Provider', 'OpenRouter ID', 'Input/1M', 'Output/1M', 'Uso Principal']}
        rows={[
          ['Google', 'google/gemini-2.5-flash-lite', '$0.50', '$3.00', 'Q&A, geracao, validacao'],
          ['xAI', 'x-ai/grok-4.1-fast', '$0.20', '$0.50', 'Ideacao de conteudo'],
          ['Anthropic', 'anthropic/claude-sonnet-4', '$3.00', '$15.00', 'Conteudo high-quality'],
          ['OpenAI', 'openai/gpt-4.1-mini', '$0.40', '$1.60', 'Alternativa balanceada'],
          ['DeepSeek', 'deepseek/deepseek-chat-v3', '$0.27', '$1.10', 'Custo ultra-baixo'],
        ]}
      />

      <H2>Nodes do Pipeline</H2>
      <P>
        Cada etapa do pipeline pode usar um modelo diferente.
        Configuravel em Dashboard &rarr; Config &rarr; LLM Nodes.
      </P>
      <Table
        headers={['Node', 'Modelo', 'Descricao']}
        rows={[
          ['classify', 'google/gemini-2.5-flash-lite', 'Escolha de template'],
          ['plan', 'openai/gpt-4.1-mini', 'Step-back + queries RAG'],
          ['brief_expand', 'openai/gpt-4.1-mini', 'Expansao de brief PT-BR'],
          ['research (summarizer)', 'google/gemini-2.5-flash-lite', 'Sumarizacao de chunks'],
          ['gap_check', 'google/gemini-2.5-flash-lite', 'Detector de gaps'],
          ['write', 'google/gemini-2.5-flash (ou claude-sonnet-4)', 'Geracao de secoes (configuravel)'],
          ['critique (2-pass)', 'google/gemini-2.5-flash-lite', 'Validacao + re-check'],
          ['fix', 'anthropic/claude-sonnet-4', 'Autofix de issues HIGH'],
          ['translate', 'openai/gpt-4.1-mini', 'EN -> PT-BR'],
          ['qa', 'google/gemini-2.5-flash', 'Respostas Q&A chat'],
          ['optimize', 'google/gemini-2.5-flash-lite', 'SEO metadata'],
          ['ideation', 'google/gemini-2.5-flash-lite', 'Geracao de ideias'],
        ]}
      />

      <H2>Configuracao</H2>
      <CodeBlock title="config/prompt_templates.yaml (excerto)">{`llm:
  default:
    model: google/gemini-2.5-flash-lite
  nodes:
    ideation:
      model: x-ai/grok-4.1-fast
    write:
      model: google/gemini-2.5-flash-lite`}</CodeBlock>

      <H2>Concorrencia & Retry</H2>
      <P>
        Um Semaphore(5) limita chamadas LLM concorrentes para evitar rate limits.
        Em caso de erro 429 ou 5xx, o sistema faz retry com backoff exponencial:
        1s &rarr; 2s &rarr; 4s (maximo 3 tentativas).
      </P>
      <Table
        headers={['Aspecto', 'Comportamento']}
        rows={[
          ['Concorrencia max', 'Semaphore(5) — maximo 5 chamadas simultaneas'],
          ['Retry', 'Exponential backoff: 1s, 2s, 4s (3 tentativas)'],
          ['Rate limit 429', 'Retry automatico com backoff'],
          ['Erros 5xx', 'Retry automatico com backoff'],
          ['Timeout', '30s por chamada (configuravel)'],
          ['Fallback', 'Nenhum — se todas tentativas falham, erro retornado'],
        ]}
      />

      <H2>Filas BullMQ</H2>
      <P>
        Chamadas LLM pesadas (ideacao, geracao de conteudo) rodam em filas BullMQ com Redis,
        desacoplando o HTTP request do processamento.
      </P>
      <Table
        headers={['Fila', 'Concorrencia', 'Uso']}
        rows={[
          ['ideation', '1', 'Geracao de ideias de conteudo'],
          ['content', '2', 'Geracao e otimizacao de posts'],
        ]}
      />

      <H2>Padrao Assincrono (Request/Poll)</H2>
      <P>
        Endpoints de geracao retornam 202 + jobId. O cliente faz polling para acompanhar o progresso.
      </P>
      <CodeBlock title="Fluxo request/poll">{`# 1. Iniciar geracao (retorna imediatamente)
POST /content/generate
-> 202 { "jobId": "abc-123", "status": "queued" }

# 2. Consultar progresso
GET /jobs/abc-123
-> 200 { "jobId": "abc-123", "status": "active", "progress": 45 }

# 3. Resultado final
GET /jobs/abc-123
-> 200 { "jobId": "abc-123", "status": "completed", "result": { ... } }`}</CodeBlock>

      <H2>Cost Tracking</H2>
      <P>
        Todas as chamadas LLM sao logadas na tabela <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">llm_usage_logs</code>:
        input tokens, output tokens, latencia, custo estimado, modelo, node.
      </P>
      <Callout type="info" title="Dashboard de custos">
        Dashboard &rarr; /dashboard/llm mostra custos por modelo, por node, por dia.
        Tambem acessivel via GET /seo/pipeline/costs?days=30.
      </Callout>

      <H2>Tool Calling — estado atual</H2>
      <P>
        <strong>O engine NAO usa tool calling / function calling.</strong> Todas as chamadas LLM sao
        single-shot prompt+completion. A interface <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">LlmRequest</code> aceita
        apenas <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">systemPrompt</code>, <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">userMessage</code>, <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">maxTokens</code> e <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">jsonMode</code> —
        sem <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">tools[]</code>, sem dispatch loop, sem multi-turn.
      </P>
      <P>
        Como os dados chegam ao modelo hoje:
      </P>
      <Table
        headers={['Mecanica', 'Como funciona']}
        rows={[
          ['Pre-resolved RAG', 'research + gap_check assemblam todo o contexto server-side (PG + Qdrant + summaries) ANTES do write. O LLM ve o prompt fully-stuffed.'],
          ['Pipeline como state machine', 'Cada node = 1 LLM call. Output alimenta o proximo node. Ordem fixa: research -> analyze -> gap_check -> write -> critique -> fix -> translate -> optimize.'],
          ['Context size', 'Target ~1200 tokens por secao. Cabe facil num single shot — por isso tool calling nao e bloqueante hoje.'],
        ]}
      />

      <H2>Oportunidades de otimizacao</H2>
      <P>
        Em ordem de ROI — recomendo comecar pelo #1 (menor esforco, maior economia):
      </P>
      <Table
        headers={['#', 'Oportunidade', 'Ganho estimado', 'Esforco']}
        rows={[
          ['1', 'Prompt caching (cache_control Anthropic via OpenRouter)', '30-50% reducao no custo total de post — system prompt ~3-5k tokens repetido em 8-10 calls por post', '~30 linhas em LlmService.callOpenRouter()'],
          ['2', 'Tool calling (agentic Q&A, dynamic fetch)', 'Habilita capabilities novas (PoB chatbot, citacao de precos live, verificacao dinamica)', 'Refactor medio — novo callWithTools() + registry'],
          ['3', 'Streaming', 'UX no editor — write node leva 30-90s, streaming mostra prose aparecendo', '~50 linhas EventSource'],
          ['4', 'Batch API (50% off)', 'Economia em ideation e research nao-urgente', 'Nova lane assincrona separada'],
          ['5', 'Fallback chain de modelos', 'Resiliencia a 429/5xx — gemini-flash -> gemini-pro -> claude-haiku', '~40 linhas'],
          ['6', 'Streaming tool use (Anthropic)', 'Combina (2) e (3)', 'So faz sentido depois de (2)'],
        ]}
      />
      <Callout type="info" title="Recomendacao">
        Prompt caching primeiro. Nosso system prompt (style_guide.yaml + template instructions)
        tem ~3-5k tokens e e reenviado em todo node. Cache bate e paga 80-90% menos no input
        cost. Se rodar Sonnet no write (padrao opcional), economia chega a 30-50% no custo
        total por post. Mudanca pequena, sem risco arquitetural.
      </Callout>

      <H2>poe-hub LLM</H2>
      <P>
        O poe-hub usa Gemini apenas para o price parser — parsing de mensagens de preco do Discord
        em dados estruturados (preco, moeda, quantidade). Configurado via GEMINI_API_KEY no .env.
        Este e o unico caso que ainda usa SDK direto (nao passa pelo OpenRouter).
      </P>
    </>
  );
}
