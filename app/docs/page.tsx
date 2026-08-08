'use client';

import { PageTitle, CardGrid, Card, Callout } from './components';
import { Diagram } from './components';
import { useDocsBase } from './use-docs-path';

export default function DocsWelcome() {
  const base = useDocsBase();
  const h = (slug: string) => `${base}/${slug}`;

  return (
    <>
      <PageTitle description="Documentacao tecnica unificada das plataformas Path of Trade — Content Engine + poe-hub.">
        Bem-vindo
      </PageTitle>

      <Callout type="tip" title="Dois repos, uma plataforma">
        O Path of Trade e composto por dois sistemas que trabalham juntos: o <strong>Content Engine</strong> (geracao de conteudo AI) e o <strong>poe-hub</strong> (gestao operacional). Esta documentacao cobre ambos.
      </Callout>

      <Diagram title="Visao geral do sistema">{`
  Content Engine          poe-hub              pathoftrade.net
  (NestJS + Next)         (Next.js 16)         (site publico)
  +-----------------+     +----------------+   +----------------+
  | Crawlers Python |     | Bots mgmt      |   | Guides (SSG)   |
  | RAG + Qdrant    | --> | Prices Discord  |   | Blog (Sanity)  |
  | LLM Pipeline    |     | Sales tracking  |   | Products       |
  | SEO Keywords    |     | Simulations     |   | Tools          |
  | Co-writer UI    |     | Monitoring      |   |                |
  +-----------------+     +----------------+   +----------------+
         |                       |                     ^
         |    API (JSON output)  |   Fetch guides      |
         +-----------------------+---------------------+
      `}</Diagram>

      <h2 className="text-lg font-semibold text-foreground mt-8 mb-4">Content Engine</h2>
      <CardGrid>
        <Card title="Pipeline Diario" description="12 etapas automaticas: crawl, keywords, embeddings, VICE scoring" href={h('engine/pipeline')} />
        <Card title="VICE Scoring" description="Formula de priorizacao: Volume + Intent + Competition + Effort" href={h('engine/vice')} />
        <Card title="RAG & Contexto" description="3 camadas de dados: PostgreSQL + Qdrant chunks + summaries" href={h('engine/rag')} />
        <Card title="Qdrant Collections" description="8 collections com 70K+ chunks embedados" href={h('engine/collections')} />
        <Card title="Templates" description="Templates YAML para build guides, mechanic guides, FAQs" href={h('engine/templates')} />
        <Card title="LLM Providers" description="OpenRouter: todos os modelos via API unica — configuravel por node" href={h('engine/llm')} />
      </CardGrid>

      <h2 className="text-lg font-semibold text-foreground mt-8 mb-4">poe-hub</h2>
      <CardGrid>
        <Card title="Visao Geral" description="Dashboard operacional para gestao de bots, precos, vendas" href={h('hub/overview')} />
        <Card title="Bots" description="CRUD completo, criptografia AES-256-GCM, status tracking" href={h('hub/bots')} />
        <Card title="Precos (G2G)" description="Coleta do preco da concorrencia no G2G, em USD" href={h('hub/prices')} />
        <Card title="Vendas & Simulacoes" description="Registro de vendas e projecoes de receita" href={h('hub/sales')} />
      </CardGrid>

      <h2 className="text-lg font-semibold text-foreground mt-8 mb-4">Referencia & Guias</h2>
      <CardGrid>
        <Card title="API Reference" description="Todos os endpoints de ambos os sistemas documentados" href={h('api/content')} />
        <Card title="Como Usar" description="Guia pratico: criar conteudo, rodar pipeline, publicar" href={h('guide/content')} />
        <Card title="Arquitetura" description="Stack tecnico, banco de dados, deploy, infraestrutura" href={h('architecture')} />
        <Card title="Configuracao" description="Variaveis de ambiente, YAML configs, Docker" href={h('guide/config')} />
      </CardGrid>
    </>
  );
}
