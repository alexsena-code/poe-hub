import { PageTitle, H2, P, Table, Callout } from '../../components';

export default function MonitorPage() {
  return (
    <>
      <PageTitle description="Sistema de alertas em tempo real para bots, kanban de tarefas, e logs operacionais.">
        Monitoramento & Tasks
      </PageTitle>

      <H2>Bot Monitoring</H2>
      <P>
        Sistema de alertas para detectar problemas com bots em tempo real.
        Cada alerta tem tipo, severidade, e pode ser acknowledged.
      </P>
      <Table
        headers={['Tipo de Alerta', 'Descricao']}
        rows={[
          ['error', 'Erro genérico (crash, connection lost)'],
          ['loop', 'Bot preso em loop de acoes'],
          ['stuck', 'Bot parado sem acao por X minutos'],
          ['inactivity', 'Bot sem trades por periodo prolongado'],
          ['hideout', 'Bot preso no hideout'],
          ['keyword', 'Deteccao de keyword suspeita no chat'],
        ]}
      />

      <Table
        headers={['Severidade', 'Cor', 'Acao']}
        rows={[
          ['low', 'Cinza', 'Informativo, nenhuma acao necessaria'],
          ['medium', 'Amarelo', 'Investigar quando possivel'],
          ['high', 'Laranja', 'Acao necessaria em breve'],
          ['critical', 'Vermelho', 'Acao imediata requerida'],
        ]}
      />

      <H2>Tasks (Kanban)</H2>
      <P>
        Board kanban com colunas: Backlog, To Do, In Progress, Done.
        Drag-and-drop para reordenar, filtros por modulo e prioridade.
      </P>
      <Table
        headers={['Campo', 'Valores']}
        rows={[
          ['Status', 'backlog | todo | in_progress | done'],
          ['Prioridade', 'low | medium | high | urgent'],
          ['Modulo', 'bots | prices | sales | simulations | infra | other'],
          ['Assigned to', 'FK para User (opcional)'],
          ['Due date', 'Data limite (opcional)'],
        ]}
      />

      <Callout type="tip" title="Reordenacao">
        PATCH /api/tasks/reorder aceita batch reorder para mover multiplas tasks de uma vez.
        O kanban frontend usa drag-and-drop HTML5 nativo.
      </Callout>

      <H2>API Endpoints</H2>
      <Table
        headers={['Metodo', 'Path', 'Descricao']}
        rows={[
          ['GET', '/api/monitor/alerts', 'Lista alertas'],
          ['POST', '/api/monitor/alerts', 'Criar alerta'],
          ['PATCH', '/api/monitor/alerts/[id]', 'Update alerta'],
          ['PATCH', '/api/monitor/alerts/acknowledge-all', 'Marcar todos como lidos'],
          ['GET', '/api/monitor/instances', 'Instancias de bot'],
          ['GET', '/api/monitor/stats', 'Estatisticas'],
          ['GET', '/api/tasks', 'Lista tasks com filtros'],
          ['POST', '/api/tasks', 'Criar task'],
          ['PATCH', '/api/tasks/[id]/status', 'Mudar status'],
          ['PATCH', '/api/tasks/reorder', 'Batch reorder'],
        ]}
      />
    </>
  );
}
