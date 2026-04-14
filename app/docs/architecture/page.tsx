import { PageTitle, H2, H3, P, Table, Diagram, Callout, CodeBlock, Badge } from '../components';

export default function ArchitecturePage() {
  return (
    <>
      <PageTitle description="Stack tecnico, estrategia de dados em 3 camadas, e como os dois sistemas se conectam.">
        Arquitetura
      </PageTitle>

      <H2>Stack Tecnico</H2>
      <Table
        headers={['Camada', 'Content Engine', 'poe-hub']}
        rows={[
          ['Framework', 'NestJS (API) + Next.js (UI)', 'Next.js 16 (fullstack)'],
          ['Linguagem', 'TypeScript + Python', 'TypeScript'],
          ['Banco de dados', 'PostgreSQL 16 (Prisma)', 'PostgreSQL 16 (Prisma)'],
          ['Vector DB', 'Qdrant (1024-dim)', '—'],
          ['Embedding', 'mxbai-embed-large-v1 (TEI)', '—'],
          ['LLM', 'OpenRouter (multi-model)', 'Gemini (price parser)'],
          ['Auth', '— (interno)', 'NextAuth.js'],
          ['Queue', 'BullMQ + Redis', '—'],
          ['Containers', 'Docker Compose', 'Docker Compose'],
          ['UI', 'Tailwind CSS', 'Tailwind + shadcn/ui'],
        ]}
      />

      <H2>Estrategia de 3 Camadas (Content Engine)</H2>
      <P>
        A decisao arquitetural mais importante. Cada pagina crawleada produz tres tipos de output,
        otimizados para diferentes tipos de query LLM.
      </P>

      <Diagram title="Fluxo de dados por camada">{`
  Wiki Page "Righteous Fire"
      |
      v
    Parser (dual output)
      |
      +---> Camada 1: PostgreSQL
      |       Dados exatos: DPS, mana cost, gem levels (~30 tokens)
      |
      +---> Camada 2: Qdrant chunks
      |       Texto narrativo: "RF scales with..." (200-400 tokens/chunk)
      |
      +---> Camada 3: Qdrant poe_meta
              Resumo LLM: "RF is a fire DoT skill..." (~150 tokens)
      `}</Diagram>

      <Callout type="warning" title="Separacao e critica">
        Nunca misture dados numericos com texto narrativo. PostgreSQL armazena stats exatos.
        Qdrant armazena explicacoes. O context assembly combina ambos na hora da query.
      </Callout>

      <H2>Modelos PostgreSQL</H2>
      <H3>Content Engine (~213K rows)</H3>
      <Table
        headers={['Modelo', 'Relacao', 'Proposito']}
        rows={[
          ['Item', 'Hub central', 'Nome, classe, raridade, requirements, tags'],
          ['Weapon', '1:1 com Item', 'Attack speed, damage ranges, DPS'],
          ['Armour', '1:1 com Item', 'Armour, evasion, energy shield'],
          ['SkillGem', '1:1 com Item', 'Gem tags, primary attribute, vaal/awakened'],
          ['Skill', '1:1 com Item', 'Cast time, radius, descricao'],
          ['SkillLevel', '1:N com Item', 'Uma row por nivel: costs, stats, reqs'],
          ['Mod / ModStat / SpawnWeight', '1:N', 'Sistema de modificadores completo'],
          ['PassiveSkill', 'Independente', 'Ascendancy, notables, keystones'],
          ['Area', 'Independente', 'Act, area_level, is_map'],
          ['CraftingBenchOption', 'Independente', 'Bench recipes'],
          ['KeywordOpportunity', 'Independente', 'SEO keywords com VICE score'],
          ['RedditPost / YouTubeVideo', 'Independente', 'Dados de crawl'],
        ]}
      />

      <H3>poe-hub (12 modelos)</H3>
      <Table
        headers={['Modelo', 'Proposito']}
        rows={[
          ['User', 'Contas admin/operador (username, role)'],
          ['Bot', 'Bots gerenciados (nick, email, senha criptografada, proxy, status)'],
          ['Sale', 'Registro de transacoes (data, quantidade, valor, buyer)'],
          ['Buyer', 'Entidades compradoras'],
          ['PriceEntry', 'Historico de precos (discord_message_id unico)'],
          ['DiscordSource', 'Configuracao de canais Discord para scraping'],
          ['League', 'Leagues do PoE (nome, versao, datas)'],
          ['Simulation / SimulationWeek / SimulationDay', 'Projecoes de receita'],
          ['Task', 'Kanban board (titulo, status, prioridade, modulo)'],
          ['GlobalCostConfig', 'Custos globais por bot'],
        ]}
      />

      <H2>Integracao entre Sistemas</H2>
      <Diagram title="Fluxo de dados entre repos">{`
  Content Engine (api.pathoftrade.net)
      |  GET /content/posts
      |  GET /content/posts/:slug
      v
  poe-hub (pathoftrade.net)
      |  /guides        -> lista guides
      |  /guides/[slug] -> guide individual
      v
  Usuario final (Google / direto)
      `}</Diagram>

      <P>
        O poe-hub consome conteudo via HTTP. O arquivo <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">lib/content-api.ts</code> no poe-hub
        faz fetch dos posts publicados pela Content Engine API.
      </P>

      <H2>Seguranca</H2>
      <Table
        headers={['Aspecto', 'Implementacao']}
        rows={[
          ['Senhas de bot', 'AES-256-GCM (encrypt/decrypt na aplicacao)'],
          ['Auth poe-hub', 'NextAuth.js com credentials provider + bcrypt'],
          ['API keys', 'Variaveis de ambiente (.env), nunca hardcoded'],
          ['Proxy credentials', 'Criptografadas no banco (mesmo esquema AES)'],
          ['Discord token', 'Variavel de ambiente'],
        ]}
      />
    </>
  );
}
