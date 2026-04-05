import { PageTitle, H2, P, Steps, Step, Callout, Diagram, Table } from '../../components';

export default function GuideSeoPage() {
  return (
    <>
      <PageTitle description="Como usar o pipeline SEO para descobrir keywords, analisar competidores, e priorizar conteudo.">
        Pipeline SEO
      </PageTitle>

      <H2>Visao Geral</H2>
      <Diagram title="Fluxo SEO">{`
  Crawl Sources (Reddit, YouTube, poe.ninja)
      |
      v
  Extract Keywords (LLM + noun-phrase + KeyBERT)
      |
      v
  Validate & Score (VICE formula)
      |
      v
  Prioritize & Deduplicate
      |
      v
  Content Ideation (LLM gera briefs)
      |
      v
  Create Content (co-writer ou auto)
      `}</Diagram>

      <H2>Passo a Passo</H2>
      <Steps>
        <Step number={1} title="Verificar keywords existentes">
          Dashboard &rarr; /dashboard/seo. Veja todas as keywords com VICE score.
          Ordene por VICE (desc) para ver as melhores oportunidades.
        </Step>
        <Step number={2} title="Rodar pipeline (se necessario)">
          Dashboard &rarr; /dashboard/config &rarr; Pipelines &rarr; &quot;Full Pipeline&quot;.
          Isso roda as 12 etapas automaticas. Ou espere o cron diario (06:00 UTC).
        </Step>
        <Step number={3} title="Analisar keyword">
          Clique em qualquer keyword para ver o detalhe: breakdown V/I/C/E,
          fontes (Reddit, YouTube, GSC), evidencia semantica do Qdrant.
        </Step>
        <Step number={4} title="Gerar ideias de conteudo">
          Dashboard &rarr; /dashboard/ideas &rarr; &quot;Gerar Ideias&quot;.
          O LLM analisa top keywords + Reddit + YouTube e sugere 10-15 briefs.
        </Step>
        <Step number={5} title="Aceitar e criar">
          Revise os briefs gerados. Aceite os bons, rejeite os ruins.
          Para cada brief aceito, crie um novo post usando o co-writer.
        </Step>
      </Steps>

      <H2>Paginas do Dashboard SEO</H2>
      <Table
        headers={['Pagina', 'URL', 'O que mostra']}
        rows={[
          ['Keywords', '/dashboard/seo', 'Todas as keywords com VICE, filtros, detalhe'],
          ['Reddit', '/dashboard/reddit', 'Posts crawleados, periodo, score, comentarios'],
          ['YouTube', '/dashboard/youtube', 'Scans, videos, canais monitorados'],
          ['Content Ideas', '/dashboard/ideas', 'Briefs gerados por LLM, aceitar/rejeitar'],
          ['Config', '/dashboard/config', '15 pipeline cards para executar etapas'],
        ]}
      />

      <H2>GSC (Google Search Console)</H2>
      <P>
        Se conectado (OAuth), o sistema importa impressoes, clicks, e posicao media do GSC.
        Esses dados alimentam o V (volume) do VICE score e o bonus de posicao no C (competition).
      </P>
      <Steps>
        <Step number={1} title="Conectar GSC">
          Dashboard &rarr; Config &rarr; GSC tab &rarr; &quot;Conectar&quot;. Faca login com Google.
        </Step>
        <Step number={2} title="Sync dados">
          POST /seo/gsc/sync ou botao no dashboard. Importa ultimos 28 dias.
        </Step>
      </Steps>

      <Callout type="tip" title="Competitors">
        Dashboard &rarr; Config &rarr; Competitors tab permite configurar sites concorrentes.
        O gap analysis (POST /seo/competitors/gap-analysis) usa AI para encontrar oportunidades
        que competidores cobrem e voce nao.
      </Callout>
    </>
  );
}
