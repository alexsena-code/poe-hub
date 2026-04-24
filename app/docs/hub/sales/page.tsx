import { PageTitle, H2, P, Diagram, Table, CodeBlock } from '../../components';

export default function SalesPage() {
  return (
    <>
      <PageTitle description="Registro de vendas e simulacoes de receita com projecoes por semana/dia.">
        Vendas & Simulacoes
      </PageTitle>

      <H2>Vendas</H2>
      <Table
        headers={['Campo', 'Tipo', 'Descricao']}
        rows={[
          ['id', 'UUID', 'PK'],
          ['date', 'DateTime', 'Data da venda'],
          ['quantity', 'Decimal', 'Quantidade vendida'],
          ['unit', 'Enum', 'divine | mirror | exalted | other'],
          ['unit_price', 'Decimal(18,8)', 'Preco unitario'],
          ['total_brl', 'Decimal(18,2)', 'Total em BRL'],
          ['buyer_id', 'UUID', 'FK para Buyer'],
          ['bot_id', 'UUID?', 'FK para Bot (opcional)'],
          ['notes', 'String?', 'Observacoes'],
        ]}
      />

      <P>
        Buyers sao entidades separadas com nome e flag is_cnl (comprador confiavel).
        Cada venda pode estar associada a um bot especifico ou ser registrada avulsa.
      </P>

      <H2>Simulacoes</H2>
      <P>
        Simulacoes projetam receita futura baseado em numero de bots, precos por dia, e custos operacionais.
        Cada simulacao tem 4 semanas com 7 dias, e cada dia pode ter overrides.
      </P>
      <Diagram title="Estrutura de dados">{`
  Simulation
      |
      +---> SimulationWeek (1-4)
      |       default_bots, default_hours, default_price
      |       +---> SimulationDay (1-7)
      |               override_bots?, override_price?
      |
      +---> League (FK)
      +---> GlobalCostConfig
      `}</Diagram>

      <H2>Funcionalidades</H2>
      <Table
        headers={['Feature', 'Descricao']}
        rows={[
          ['Criar simulacao', 'Define league, numero de bots, precos base'],
          ['Override por dia', 'Ajustar bots ou preco para dias especificos'],
          ['Import de precos', 'Importar precos reais de um periodo para preencher simulacao'],
          ['Duplicar', 'Clonar simulacao existente para experimentar'],
          ['Comparar', '/farm/simulations/compare mostra side-by-side entre simulacoes'],
          ['AI projections', 'POST /simulations/create-projected gera projecoes automaticas'],
        ]}
      />

      <H2>Custos</H2>
      <P>
        GlobalCostConfig define custos fixos e variaveis que sao subtraidos da receita bruta:
        custo por bot, taxas de cambio, fees de plataforma, etc.
      </P>

      <H2>API Endpoints</H2>
      <Table
        headers={['Metodo', 'Path', 'Descricao']}
        rows={[
          ['GET', '/api/sales', 'Lista paginada'],
          ['POST', '/api/sales', 'Criar venda'],
          ['GET', '/api/simulations', 'Lista simulacoes'],
          ['POST', '/api/simulations', 'Criar simulacao'],
          ['POST', '/api/simulations/[id]/duplicate', 'Clonar simulacao'],
          ['POST', '/api/simulations/[id]/import-prices', 'Importar precos de periodo'],
          ['POST', '/api/simulations/create-projected', 'AI projections'],
        ]}
      />
    </>
  );
}
