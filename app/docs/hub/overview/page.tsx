import { PageTitle, H2, P, Table, Diagram, CardGrid, Card, Callout } from '../../components';

export default function HubOverviewPage() {
  return (
    <>
      <PageTitle description="Dashboard operacional para gestao de bots de farming, precos, vendas e simulacoes de receita no Path of Exile.">
        poe-hub — Visao Geral
      </PageTitle>

      <Callout type="info" title="Repo separado">
        O poe-hub e um repositorio separado (Next.js 16 fullstack). Roda em pathoftrade.net e se conecta
        ao Content Engine para exibir guides gerados por AI.
      </Callout>

      <H2>Stack</H2>
      <Table
        headers={['Camada', 'Tecnologia']}
        rows={[
          ['Framework', 'Next.js 16 (App Router, Turbopack)'],
          ['UI', 'React 19 + Tailwind 4 + shadcn/ui (17 components)'],
          ['Validacao', 'Zod 4 + react-hook-form'],
          ['ORM', 'Prisma 7 (PostgreSQL 16)'],
          ['Auth', 'NextAuth.js (credentials provider, bcrypt)'],
          ['Criptografia', 'AES-256-GCM (senhas de bot, proxy)'],
          ['Charts', 'Recharts'],
          ['LLM', 'Gemini (price parser)'],
          ['Deploy', 'Docker + PM2 + Nginx'],
        ]}
      />

      <H2>Paginas do Dashboard</H2>
      <CardGrid>
        <Card title="Bots" description="CRUD completo, status tracking, proxy config, senhas criptografadas" href="/docs/hub/bots" />
        <Card title="Precos & Discord" description="Scraping automatico de Discord, historico de precos, graficos" href="/docs/hub/prices" />
        <Card title="Vendas" description="Registro de transacoes, buyers, totais por periodo" href="/docs/hub/sales" />
        <Card title="Simulacoes" description="Projecoes de receita com override por semana/dia" href="/docs/hub/sales" />
        <Card title="Tasks" description="Kanban board com drag-and-drop, prioridades, modulos" href="/docs/hub/monitor" />
        <Card title="Monitor" description="Alertas em tempo real, instancias de bot, status" href="/docs/hub/monitor" />
      </CardGrid>

      <H2>Rotas</H2>
      <Diagram title="App Router structure">{`
  /login                    Login (NextAuth credentials)
  /dashboard                Dashboard com summary cards

  (auth) — rotas protegidas:
  /bots                     Lista de bots + busca + filtro
  /bots/new                 Criar novo bot
  /bots/[id]                Editar bot
  /prices                   Historico de precos + graficos
  /prices/sources           Config de canais Discord
  /sales                    Registro de vendas
  /sales/new                Nova venda
  /simulations              Lista de simulacoes
  /simulations/[id]         Editar simulacao
  /simulations/compare      Comparar simulacoes
  /tasks                    Kanban board
  /settings/costs           Config de custos
  /settings/leagues         Gerenciar leagues
  /settings/users           CRUD de usuarios
  /settings/proxy           Config de proxy
  /monitor                  Alertas e logs

  (publico):
  /guides                   Guides do Content Engine
  /guides/[slug]            Guide individual
      `}</Diagram>

      <H2>Integracao com Content Engine</H2>
      <P>
        O arquivo lib/content-api.ts faz fetch da API do Content Engine para listar e renderizar guides
        gerados por AI. As rotas /guides e /guides/[slug] sao publicas.
      </P>
    </>
  );
}
