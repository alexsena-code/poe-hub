import { PageTitle, P, EndpointGroup, Endpoint, Callout } from '../../components';

export default function HubApiPage() {
  return (
    <>
      <PageTitle description="Endpoints REST do poe-hub: bots, vendas, precos, simulacoes, tasks, monitor.">
        poe-hub API
      </PageTitle>

      <P>Base URL: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">pathoftrade.net/api</code> (producao). Todas as rotas requerem autenticacao (NextAuth session).</P>

      <Callout type="warning" title="Auth necessario">
        Todos os endpoints abaixo requerem session de NextAuth. Use /api/auth para autenticar.
      </Callout>

      <EndpointGroup title="Bots">
        <Endpoint method="GET" path="/api/bots" description="Lista com paginacao, busca, filtro por status" />
        <Endpoint method="POST" path="/api/bots" description="Criar bot (password auto-encrypted)" />
        <Endpoint method="GET" path="/api/bots/[id]" description="Detalhes (?reveal=true para senhas)" />
        <Endpoint method="PUT" path="/api/bots/[id]" description="Atualizar bot" />
        <Endpoint method="DELETE" path="/api/bots/[id]" description="Deletar bot" />
        <Endpoint method="PATCH" path="/api/bots/[id]/status" description="Toggle status" />
      </EndpointGroup>

      <EndpointGroup title="Vendas">
        <Endpoint method="GET" path="/api/sales" description="Lista paginada" />
        <Endpoint method="POST" path="/api/sales" description="Criar venda" />
        <Endpoint method="GET" path="/api/sales/[id]" description="Detalhes da venda" />
        <Endpoint method="PUT" path="/api/sales/[id]" description="Atualizar venda" />
        <Endpoint method="DELETE" path="/api/sales/[id]" description="Deletar venda" />
      </EndpointGroup>

      <EndpointGroup title="Precos">
        <Endpoint method="GET" path="/api/prices/g2g" description="Serie de snapshots da concorrencia (G2G)" />
        <Endpoint method="POST" path="/api/prices/g2g" description="Dispara uma coleta agora" />
        <Endpoint method="GET" path="/api/prices/daily" description="Arquivo: agregacao diaria (congelada em ago/2026)" />
        <Endpoint method="GET" path="/api/prices/daily/cross-league" description="Arquivo: precos por league" />
      </EndpointGroup>

      <EndpointGroup title="Simulacoes">
        <Endpoint method="GET" path="/api/simulations" description="Lista simulacoes" />
        <Endpoint method="POST" path="/api/simulations" description="Criar simulacao" />
        <Endpoint method="GET" path="/api/simulations/[id]" description="Detalhes com weeks/days" />
        <Endpoint method="PUT" path="/api/simulations/[id]" description="Atualizar" />
        <Endpoint method="DELETE" path="/api/simulations/[id]" description="Deletar" />
        <Endpoint method="POST" path="/api/simulations/[id]/duplicate" description="Clonar" />
        <Endpoint method="POST" path="/api/simulations/[id]/import-prices" description="Importar precos" />
        <Endpoint method="PATCH" path="/api/simulations/[id]/weeks/[n]" description="Editar defaults da semana" />
        <Endpoint method="PATCH" path="/api/simulations/[id]/weeks/[n]/days/[d]" description="Override de dia" />
      </EndpointGroup>

      <EndpointGroup title="Tasks">
        <Endpoint method="GET" path="/api/tasks" description="Lista com filtros e paginacao" />
        <Endpoint method="POST" path="/api/tasks" description="Criar task" />
        <Endpoint method="PUT" path="/api/tasks/[id]" description="Atualizar task" />
        <Endpoint method="DELETE" path="/api/tasks/[id]" description="Deletar task" />
        <Endpoint method="PATCH" path="/api/tasks/[id]/status" description="Mudar status" />
        <Endpoint method="PATCH" path="/api/tasks/reorder" description="Batch reorder" />
      </EndpointGroup>

      <EndpointGroup title="Sistema">
        <Endpoint method="GET" path="/api/dashboard" description="Stats agregados do dashboard" />
        <Endpoint method="GET" path="/api/exchange-rate" description="Taxa de cambio" />
        <Endpoint method="GET" path="/api/leagues" description="Lista leagues" />
        <Endpoint method="POST" path="/api/leagues" description="Criar league" />
        <Endpoint method="GET" path="/api/cost-configs" description="Configs de custo" />
        <Endpoint method="GET" path="/api/users" description="Lista usuarios" />
        <Endpoint method="POST" path="/api/users" description="Criar usuario" />
        <Endpoint method="GET" path="/api/monitor/alerts" description="Alertas" />
        <Endpoint method="GET" path="/api/monitor/stats" description="Stats de monitoramento" />
      </EndpointGroup>
    </>
  );
}
