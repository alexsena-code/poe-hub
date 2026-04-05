import { PageTitle, H2, P, Steps, Step, Callout, Diagram, Table, CodeBlock } from '../../components';

export default function GuideContentPage() {
  return (
    <>
      <PageTitle description="Como criar conteudo usando o co-writer: do briefing a publicacao, secao por secao.">
        Criando Conteudo
      </PageTitle>

      <Callout type="info" title="Dois modos de geracao">
        <strong>Co-writer</strong> (interativo): voce escreve o briefing e opinioes por secao, AI gera cada parte.
        <strong>Auto mode</strong>: AI gera tudo de uma vez a partir de um briefing curto.
      </Callout>

      <H2>Fluxo Co-Writer</H2>
      <Diagram title="Fluxo Co-Writer">{`
  1. Escolher template (build_guide, mechanic_guide, faq)
      |
  2. Preencher variaveis (skill, ascendancy, league)
      |
  3. Revisar outline gerado
      |
  4. Para cada secao:
      |   a. Escrever opiniao/briefing (PT-BR)
      |   b. Clicar "Gerar" -> AI monta contexto + gera
      |   c. Revisar, editar, ou regerar trechos
      |   d. Travar secao quando satisfeito
      |
  5. Revisar post completo
      |
  6. Publicar (JSON output bilingual)
      `}</Diagram>

      <H2>Passo a Passo</H2>
      <Steps>
        <Step number={1} title="Acessar /new">
          No dashboard, clique em &quot;New Post&quot; na sidebar. Voce vera o editor split-view.
        </Step>
        <Step number={2} title="Escolher template">
          Selecione um template no dropdown. Cada template define as secoes e queries RAG.
          Preencha as variaveis (nome da skill, ascendancy, etc).
        </Step>
        <Step number={3} title="Escrever briefing geral">
          No campo de briefing, escreva em PT-BR o que voce quer enfatizar.
          Ex: &quot;Focar em budget gear, mencionar que RF nao precisa de 6-link&quot;
        </Step>
        <Step number={4} title="Gerar secao por secao">
          Clique na secao esquerda. Se o template pede human input, escreva sua opiniao.
          Clique &quot;Gerar&quot; — o sistema monta contexto (PG + Qdrant) e gera via LLM.
        </Step>
        <Step number={5} title="Editar e refinar">
          <strong>Selecionar texto</strong>: aparece tooltip com 3 opcoes:
          <br />— <strong>Regerar</strong>: AI reescreve o trecho selecionado (com instrucao opcional)
          <br />— <strong>Editar</strong>: abre modal de edicao inline
          <br />— <strong>Travar</strong>: impede regeneracao acidental
        </Step>
        <Step number={6} title="Revisar e publicar">
          Quando todas as secoes estiverem prontas, va ao painel de publicacao.
          Veja o resumo de custo (tokens + estimativa). Clique &quot;Publicar&quot;.
          O post fica disponivel via API e aparece em /guides.
        </Step>
      </Steps>

      <H2>Auto-Save</H2>
      <P>
        Drafts sao salvos automaticamente a cada 5 segundos. Voce pode fechar o navegador
        e retomar de onde parou. Todos os drafts aparecem em /guides com filtro &quot;draft&quot;.
      </P>

      <H2>Download</H2>
      <P>
        No painel de publicacao, voce pode baixar o conteudo como:
      </P>
      <Table
        headers={['Formato', 'Descricao']}
        rows={[
          ['JSON', 'Completo: secoes + meta SEO + bilingual'],
          ['Markdown (PT-BR)', 'Conteudo em portugues formatado'],
          ['Markdown (EN)', 'Conteudo em ingles formatado'],
        ]}
      />

      <H2>Custo Tracking</H2>
      <P>
        A barra inferior do editor mostra tokens usados e custo estimado em tempo real.
        O painel de publicacao mostra o custo total do post (todas as secoes + regeneracoes).
      </P>
    </>
  );
}
