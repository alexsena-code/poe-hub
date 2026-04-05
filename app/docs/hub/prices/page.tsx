import { PageTitle, H2, P, Table, Diagram, Callout, CodeBlock } from '../../components';

export default function PricesPage() {
  return (
    <>
      <PageTitle description="Scraping automatico de precos via Discord + parser AI (Gemini). Historico, graficos, e agregacao diaria.">
        Precos & Discord
      </PageTitle>

      <Diagram title="Fluxo de scraping">{`
  Discord Channels (/prices/sources)
      |
      v
  DiscordChatExporter (CLI) -> export JSON
      |
      v
  Parser Script (regex + Gemini)
      |
      v
  PriceEntry (PostgreSQL, discord_message_id unico)
      |
      +---> Dashboard /prices (graficos + agregacao)
      +---> Simulacoes (import por periodo)
      `}</Diagram>

      <H2>Discord Sources</H2>
      <P>Canais de Discord configurados para scraping de precos. Cada source define servidor, canal, e autores de referencia.</P>
      <Table
        headers={['Campo', 'Descricao']}
        rows={[
          ['server_id', 'ID do servidor Discord'],
          ['channel_id', 'ID do canal especifico'],
          ['cnl_author_ids', 'IDs de autores confiáveis (CNL)'],
          ['label', 'Nome amigável para o dashboard'],
        ]}
      />

      <H2>Modelo PriceEntry</H2>
      <Table
        headers={['Campo', 'Tipo', 'Descricao']}
        rows={[
          ['id', 'UUID', 'PK'],
          ['discord_message_id', 'String (unique)', 'Previne duplicatas'],
          ['price', 'Decimal(18,8)', 'Valor do preco'],
          ['currency', 'Enum', 'divine | chaos | usd | brl | other'],
          ['is_cnl', 'Boolean', 'Se autor e de referencia'],
          ['raw_message', 'String', 'Mensagem original do Discord'],
          ['timestamp', 'DateTime', 'Quando a mensagem foi postada'],
          ['source_id', 'UUID', 'FK para DiscordSource'],
        ]}
      />

      <H2>Agregacao</H2>
      <Table
        headers={['Endpoint', 'Descricao']}
        rows={[
          ['GET /api/prices/daily', 'Precos agregados por dia (min, max, avg, count)'],
          ['GET /api/prices/daily/cross-league', 'Precos por league'],
          ['GET /api/prices/stats', 'Estatisticas gerais'],
        ]}
      />

      <H2>Price Parser (Gemini)</H2>
      <P>
        Mensagens do Discord sao parseadas em 2 etapas: primeiro regex para formatos conhecidos,
        depois Gemini para mensagens ambiguas. Output: preco, moeda, quantidade, se e CNL.
      </P>

      <Callout type="info" title="Trigger manual">
        POST /api/prices/scrape dispara o scraping manualmente. Requer DISCORD_TOKEN e DCE_PATH configurados.
      </Callout>
    </>
  );
}
