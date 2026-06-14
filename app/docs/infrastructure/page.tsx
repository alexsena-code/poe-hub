import { PageTitle, H2, H3, P, Table, CodeBlock, Callout, Diagram } from '../components';

export default function InfrastructurePage() {
  return (
    <>
      <PageTitle description="Docker Compose, servidor, deploy, CI/CD, e configuracao de ambiente.">
        Infraestrutura
      </PageTitle>

      <H2>Servidor de Producao</H2>
      <Table
        headers={['Aspecto', 'Valor']}
        rows={[
          ['Provider', 'Hetzner CX22'],
          ['RAM', '4GB + 6GB swap'],
          ['CPU', '2 vCPU (Intel)'],
          ['Disco', '40GB SSD'],
          ['Custo', '~$4.50/mes (~R$25)'],
          ['OS', 'Ubuntu 22.04'],
        ]}
      />

      <H2>Dominios</H2>
      <Table
        headers={['Dominio', 'Destino', 'Porta']}
        rows={[
          ['pathoftrade.net', 'poe-hub (Next.js)', '3002'],
          ['engine.pathoftrade.net', 'Content Web (Next.js)', '3001'],
          ['api.pathoftrade.net', 'NestJS API', '3000'],
        ]}
      />
      <P>Nginx faz reverse proxy com SSL (Let&apos;s Encrypt) + WebSocket proxy para /ws/.</P>

      <H2>Docker Compose</H2>
      <CodeBlock title="docker-compose.yml (servicos)">{`services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: poe_content
      POSTGRES_USER: poe
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333", "6334:6334"]
    volumes: [qdrant_data:/qdrant/storage]

  tei:
    image: ghcr.io/huggingface/text-embeddings-inference:cpu-1.6
    ports: ["8080:80"]
    volumes: [model_data:/data]
    command: --model-id mixedbread-ai/mxbai-embed-large-v1
    mem_limit: 3g
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: >
      redis-server --maxmemory 256mb --maxmemory-policy noeviction
    volumes: [redis_data:/data]`}</CodeBlock>

      <H2>Arquitetura de Embeddings</H2>
      <Diagram title="TEI split: CPU (server) + GPU (local)">{`
  Servidor (Hetzner CX22, 4GB RAM)          PC Local (RTX 4060, 8GB VRAM)
  +------------------------------+          +---------------------------+
  | TEI Docker (CPU, 3GB limit)  |          | TEI Docker (GPU, CUDA)    |
  |   - QA queries               |          |   - KeyBERT (5 modulos)   |
  |   - Qdrant ingest            |          |                           |
  |   - Semantic cross-ref       |          | WebSocket worker          |
  |   - Dedup                    |          |   - auto-reconnect        |
  +------------------------------+          |   - recebe tasks do server|
                                            +---------------------------+
      `}</Diagram>

      <H2>PM2 (Process Manager)</H2>
      <CodeBlock title="Processos em producao">{`pm2 list:
  nestjs-api     | port 3000 | NestJS backend
  content-web    | port 3001 | Content Engine frontend
  poe-hub        | port 3002 | poe-hub dashboard`}</CodeBlock>

      <H2>CI/CD</H2>
      <P>
        GitHub Actions deploy automatico no push para main (ambos repos).
        Workflow: SSH no servidor, git pull, build, pm2 restart.
      </P>
      <CodeBlock title=".github/workflows/deploy.yml (resumo)">{`on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - SSH into server
      - git pull origin main
      - npm install && npm run build
      - pm2 restart all`}</CodeBlock>

      <H2>Variaveis de Ambiente</H2>
      <H3>Content Engine</H3>
      <CodeBlock title=".env">{`DATABASE_URL=postgresql://poe:***@localhost:5432/poe_content
QDRANT_URL=http://localhost:6333
TEI_URL=http://localhost:8080/embed
OPENROUTER_API_KEY=sk-or-...
REDIS_URL=redis://localhost:6379
GSC_CLIENT_ID=...
GSC_CLIENT_SECRET=...
GSC_REFRESH_TOKEN=...
GSC_SITE_URL=sc-domain:pathoftrade.net
YOUTUBE_API_KEY=AIza...`}</CodeBlock>

      <H3>poe-hub</H3>
      <CodeBlock title=".env">{`DATABASE_URL=postgresql://poth:***@localhost:5432/poth
NEXTAUTH_SECRET=<random-base64>
NEXTAUTH_URL=https://pathoftrade.net
ENCRYPTION_KEY=<random-hex-32>
OPENROUTER_API_KEY=sk-or-...
DISCORD_TOKEN=<bot-token>
DCE_PATH=/path/to/DiscordChatExporter
NEXT_PUBLIC_CONTENT_API_URL=https://api.pathoftrade.net/api`}</CodeBlock>

      <Callout type="danger" title="Nunca commitar .env">
        Todas as API keys e senhas ficam em .env local e no servidor. Nunca no repositorio.
      </Callout>

      <H2>Custos Mensais</H2>
      <Table
        headers={['Item', 'Custo']}
        rows={[
          ['Hetzner CX22', '~$4.50/mes'],
          ['OpenRouter', '~$10/mes (varia por modelo)'],
          ['Total', '~$15/mes (~R$85)'],
        ]}
      />
    </>
  );
}
