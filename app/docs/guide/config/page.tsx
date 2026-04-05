import { PageTitle, H2, H3, P, Steps, Step, Table, CodeBlock, Callout } from '../../components';

export default function GuideConfigPage() {
  return (
    <>
      <PageTitle description="Como configurar o sistema: servicos Docker, YAML configs, e dashboard de configuracao.">
        Configuracao
      </PageTitle>

      <H2>Setup Inicial (Dev)</H2>
      <Steps>
        <Step number={1} title="Clonar repositorios">
          <CodeBlock>{`git clone <content-engine-repo>
git clone <poe-hub-repo>`}</CodeBlock>
        </Step>
        <Step number={2} title="Copiar .env">
          <CodeBlock>{`# Content Engine
cp .env.example .env
# Preencher: DATABASE_URL, API keys

# poe-hub
cp .env.example .env
# Preencher: DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY`}</CodeBlock>
        </Step>
        <Step number={3} title="Subir Docker">
          <CodeBlock>{`# Content Engine
docker-compose up -d
# Sobe: PostgreSQL, Qdrant, TEI, Redis

# poe-hub
docker-compose up -d
# Sobe: PostgreSQL`}</CodeBlock>
        </Step>
        <Step number={4} title="Prisma migrate + seed">
          <CodeBlock>{`# Content Engine
cd packages/api && npx prisma migrate dev && npx prisma generate

# poe-hub
npx prisma migrate dev && npx prisma db seed`}</CodeBlock>
        </Step>
        <Step number={5} title="Iniciar apps">
          <CodeBlock>{`# Content Engine
cd packages/api && npm run start:dev    # API em :3000
cd packages/web && npm run dev          # Web em :3001

# poe-hub
npm run dev                             # App em :3000`}</CodeBlock>
        </Step>
      </Steps>

      <H2>Config Dashboard (Content Engine)</H2>
      <P>Dashboard &rarr; /dashboard/config oferece 7 tabs de configuracao:</P>
      <Table
        headers={['Tab', 'O que configura', 'Arquivo YAML']}
        rows={[
          ['Prompt Templates', 'System prompts, context template', 'config/prompt_templates.yaml'],
          ['Collection Weights', 'Peso de cada collection Qdrant no RAG', 'config/prompt_templates.yaml'],
          ['Query Routing', 'Tipo de query → collections + layers', 'config/prompt_templates.yaml'],
          ['LLM Nodes', 'Provider/modelo por etapa do pipeline', 'config/prompt_templates.yaml'],
          ['Token Budget', 'Limites de tokens por camada', 'config/prompt_templates.yaml'],
          ['Style Guide', 'Voz, regras, frases banidas', 'config/style_guide.yaml'],
          ['Competitors', 'Sites concorrentes para gap analysis', 'config/prompt_templates.yaml'],
        ]}
      />

      <H2>Config de Game (PoE1 / PoE2)</H2>
      <P>
        PUT /config/game permite trocar o foco entre PoE1 e PoE2,
        atualizar league e patch. Afeta queries, crawls, e geracao de conteudo.
      </P>
      <CodeBlock title="Exemplo: trocar para PoE2">{`PUT /config/game
{
  "focus": "poe2",
  "poe2": {
    "current_league": "Early Access",
    "patch": "0.2.1"
  }
}`}</CodeBlock>

      <H2>Pipeline Cards</H2>
      <P>
        15 cards no dashboard Config permitem executar etapas individuais do pipeline:
      </P>
      <Table
        headers={['Card', 'Descricao']}
        rows={[
          ['YouTube Smart Scan', 'Scan 26+ canais com transcript + Gemini'],
          ['Reddit Crawl', 'Crawl 3 subs (Python httpx)'],
          ['Full Pipeline', 'Rodar 12 etapas sequenciais'],
          ['VICE Recalculate', 'Recalcular todos os scores'],
          ['Keyword Dedup', 'Deduplicar por similarity'],
          ['Semantic Cross-Ref', 'Cross-source matching via TEI'],
          ['Reddit Qdrant Ingest', 'Ingerir Reddit no Qdrant'],
          ['YouTube Qdrant Ingest', 'Ingerir YouTube no Qdrant'],
          ['poe.ninja Snapshot', 'Capturar snapshot de builds'],
          ['GSC Sync', 'Importar dados do Search Console'],
          ['KeyBERT Run', 'Disparar no worker GPU remoto'],
          ['LLM Validate', 'Validar keywords via LLM'],
          ['Competitor Crawl', 'Crawl sitemaps de competidores'],
          ['Gap Analysis', 'AI gap analysis vs competidores'],
          ['Daily Cron', 'Trigger manual do cron completo'],
        ]}
      />

      <Callout type="tip" title="Producao">
        Em producao, o pipeline roda automaticamente via cron (06:00 UTC).
        Use os cards apenas para debug ou execucao manual.
      </Callout>
    </>
  );
}
