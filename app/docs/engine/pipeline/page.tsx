import { PageTitle, H2, P, Table, Callout, CodeBlock, Steps, Step } from '../../components';

export default function PipelinePage() {
  return (
    <>
      <PageTitle description="12 etapas automaticas que rodam diariamente as 06:00 UTC via cron, ou manualmente pelo dashboard.">
        Pipeline Diario
      </PageTitle>

      <Callout type="info" title="Execucao">
        Cron automatico: <code>@Cron(&apos;0 6 * * *&apos;)</code> em DailyCronService.
        Manual: POST /seo/cron/daily ou Dashboard &rarr; Config &rarr; Pipelines &rarr; Full Pipeline.
      </Callout>

      <H2>Etapas</H2>
      <Table
        headers={['#', 'Etapa', 'Descricao', 'Tempo']}
        rows={[
          ['1', 'Reddit Crawl', '3 subs, hot/day, top 100 posts com comments (top 30 por score)', '~100s'],
          ['2', 'YouTube Smart Scan', '26+ canais, Gemini classifica, top 10 transcripts', '~20s'],
          ['3', 'Reddit Keyword Extraction', 'Extracao de noun-phrases dos top posts', '~0.5s'],
          ['4', 'YouTube Keyword Import', 'Import da tabela YouTubeKeyword', '~0.5s'],
          ['5', 'Keyword Dedup', 'Cosine similarity 0.92 + filtro versao/PoE2', '~35s'],
          ['6', 'poe.ninja Validation', 'Match skills/classes, popularity scoring', '~1s'],
          ['7', 'TEI Health Check + Qdrant Ingest', 'Espera TEI, depois ingere Reddit + YouTube no Qdrant', '~5s'],
          ['8', 'LLM Validation', 'Gemini + evidencia Qdrant (limit 1500)', '~1s'],
          ['9', 'VICE Recalculate', 'Recalcula scores de todas as keywords', '~1s'],
          ['10', 'Semantic Cross-Ref', '500 keywords via TEI, matching cross-source', '~35s'],
          ['11', 'Daily Snapshot', 'Captura VICE scores finais para historico', '~1s'],
          ['12', 'KeyBERT Dispatch', 'Envia para GPU worker remoto (skip se offline)', 'instant'],
        ]}
      />
      <P>Tempo total: ~215 segundos (~3.5 minutos).</P>

      <H2>Crawl Sources</H2>
      <Table
        headers={['Fonte', 'Metodo', 'Frequencia']}
        rows={[
          ['Reddit', 'Python httpx + browser headers + proxies', 'Diario (3 subs)'],
          ['YouTube', 'RSS + youtube-transcript-api + Gemini classify', 'Diario (26 canais)'],
          ['poe.ninja', 'bbpb protobuf decode', 'Diario (builds snapshot)'],
          ['PoE Wiki', 'Cargo API + Crawl4AI', 'Sob demanda'],
          ['GGG Official', 'RSS + Crawl4AI', 'Sob demanda'],
        ]}
      />

      <H2>KeyBERT Worker (GPU Remoto)</H2>
      <P>
        5 modulos de extracao de keywords que rodam no PC local com GPU (RTX 4060)
        via WebSocket. O servidor envia tasks apos o snapshot diario.
      </P>
      <Table
        headers={['Modulo', 'O que faz']}
        rows={[
          ['keyword_extractor', 'Extrai keywords de posts Reddit + transcripts YouTube'],
          ['competitor_keywords', 'Extrai keywords de paginas concorrentes'],
          ['patch_keywords', 'Extrai keywords de patch notes (Qdrant)'],
          ['content_coverage', 'Valida se posts cobrem keywords alvo'],
          ['internal_links', 'Sugere links internos semanticos entre posts'],
        ]}
      />

      <H2>Como Executar Manualmente</H2>
      <Steps>
        <Step number={1} title="Iniciar servicos">
          <CodeBlock>{`docker-compose up -d
cd packages/api && npm run start:dev`}</CodeBlock>
        </Step>
        <Step number={2} title="Rodar crawls (opcional)">
          Dashboard &rarr; /dashboard/config &rarr; Pipelines &rarr; YouTube Smart Scan / Reddit Crawl
        </Step>
        <Step number={3} title="Rodar pipeline completo">
          Dashboard &rarr; /dashboard/config &rarr; Pipelines &rarr; Full Pipeline &rarr; Executar
        </Step>
        <Step number={4} title="LLM Validation (separado)">
          <CodeBlock>{`cd packages/crawlers && python -m pipeline.keyword_validator --limit 500`}</CodeBlock>
        </Step>
      </Steps>
    </>
  );
}
