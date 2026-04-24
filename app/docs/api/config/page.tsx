import { PageTitle, EndpointGroup, Endpoint, H2, P, Callout, CodeBlock } from '../../components';

export default function ConfigApiPage() {
  return (
    <>
      <PageTitle description="Endpoints para ler e editar configuracoes do sistema (YAML-backed).">
        Config API
      </PageTitle>

      <P>Todas as configs sao armazenadas em arquivos YAML e editaveis via API ou Dashboard &rarr; Config.</P>

      <EndpointGroup title="Config CRUD">
        <Endpoint method="GET" path="/config/all" description="Snapshot completo de toda a configuracao" />
        <Endpoint method="GET" path="/config/docs" description="Config formatada para documentacao (usado em /dashboard/docs)" />
        <Endpoint method="GET" path="/config/prompt-templates" description="Ler prompt_templates.yaml completo" />
        <Endpoint method="PUT" path="/config/prompt-templates" description="Atualizar prompt_templates.yaml" />
        <Endpoint method="GET" path="/config/collection-weights" description="Pesos das collections Qdrant" />
        <Endpoint method="PUT" path="/config/collection-weights" description="Atualizar pesos" />
        <Endpoint method="GET" path="/config/query-routing" description="Routing de queries por tipo" />
        <Endpoint method="PUT" path="/config/query-routing" description="Atualizar routing" />
        <Endpoint method="GET" path="/config/llm-nodes" description="Provider/modelo por node" />
        <Endpoint method="PUT" path="/config/llm-nodes" description="Atualizar LLM nodes" />
        <Endpoint method="GET" path="/config/token-budget" description="Limites de tokens por camada" />
        <Endpoint method="PUT" path="/config/token-budget" description="Atualizar token budget" />
        <Endpoint method="GET" path="/config/style-guide" description="Style guide (voz, regras, frases banidas)" />
        <Endpoint method="PUT" path="/config/style-guide" description="Atualizar style guide" />
        <Endpoint method="GET" path="/config/ideation" description="Config de ideacao (prompt + Qdrant research)" />
        <Endpoint method="PUT" path="/config/ideation" description="Atualizar ideacao" />
        <Endpoint method="GET" path="/config/competitors" description="Lista de competidores" />
        <Endpoint method="PUT" path="/config/competitors" description="Atualizar competidores" />
        <Endpoint method="PUT" path="/config/game" description="Trocar foco PoE1/PoE2, atualizar league/patch" />
      </EndpointGroup>

      <H2>Ideacao</H2>
      <EndpointGroup title="Content Ideation">
        <Endpoint method="POST" path="/ideation/generate" description="Gerar 10-15 briefs via LLM. Body: {provider?, model?}" />
        <Endpoint method="GET" path="/ideation/briefs" description="Lista briefs. Query: ?status, urgency, runId, limit, offset" />
        <Endpoint method="PUT" path="/ideation/briefs/:id" description="Update status. Body: {status: pending|accepted|rejected}" />
        <Endpoint method="DELETE" path="/ideation/briefs" description="Limpar briefs. Query: ?status" />
      </EndpointGroup>

      <H2>Slang & People</H2>
      <EndpointGroup title="Community Data">
        <Endpoint method="GET" path="/workspace/slang" description="Lista slang candidates" />
        <Endpoint method="POST" path="/workspace/slang/extract" description="Extrair slangs de fontes" />
        <Endpoint method="PUT" path="/workspace/slang/:id/approve" description="Aprovar slang" />
        <Endpoint method="GET" path="/seo/people" description="Lista PoE People" />
        <Endpoint method="POST" path="/seo/people" description="Adicionar pessoa" />
        <Endpoint method="POST" path="/seo/people/seed" description="Seed de config + YouTube channels" />
      </EndpointGroup>

      <Callout type="tip" title="Dashboard visual">
        Todas essas configs tem editores visuais em Dashboard &rarr; Config (7 tabs).
        Alteracoes via API ou dashboard sao equivalentes.
      </Callout>
    </>
  );
}
