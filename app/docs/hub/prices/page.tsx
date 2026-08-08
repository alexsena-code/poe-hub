import { PageTitle, H2, H3, P, Table, Diagram, CodeBlock, Callout } from '../../components';

export default function HubPricesPage() {
  return (
    <>
      <PageTitle description="Coleta do preco do Divine Orb no marketplace G2G — inteligencia de preco da concorrencia, em USD.">
        poe-hub — Precos (G2G)
      </PageTitle>

      <Callout type="warning" title="A G2G nao guarda historico de preco">
        Verificado em 08/08/2026: os endpoints de history/trend/chart devolvem 404,
        e os 403 sao o API Gateway da AWS respondendo rota inexistente (um path
        inventado da o mesmo 403). A pagina publica tambem nao tem grafico.
        Consequencia pratica: cada coleta perdida e um buraco permanente na serie —
        o historico so existe porque o cron roda.
      </Callout>

      <H2>Fluxo</H2>
      <Diagram title="Pipeline de coleta">{`
  cron (*/30) ou POST /api/prices/g2g
        |
        v
  lib/g2g-client.ts      GET sls.g2g.com/offer/search (2 paginas)
        |                filtra por plataforma / liga / item pelo title
        v
  lib/g2g-stats.ts       filtro MAD (k=4) + mediana, quartis, min, max
        |
        v
  lib/g2g-collector.ts   grava G2gPriceSnapshot
`}</Diagram>

      <H2>Modelo</H2>
      <Table
        headers={['Campo', 'Proposito']}
        rows={[
          ['collectedAt', 'Quando a coleta rodou — a serie e indexada por isso'],
          ['item / league / g2gLeague', 'Divine Orb / Allflame / "Allflame Standard"'],
          ['median', 'Preco tipico apos o filtro de outlier — o numero principal'],
          ['p25 / p75', 'Faixa competitiva; p25 e o piso honesto, sem a isca'],
          ['min / max', 'Extremos do que sobrou apos o filtro'],
          ['offerCount / rawOfferCount', 'A razao entre os dois indica coleta suja'],
          ['cheapestSample', 'As 10 mais baratas, para auditar mediana suspeita'],
        ]}
      />

      <H2>A API do G2G</H2>
      <P>
        Publica e sem autenticacao. Nada disso e documentado — foi descoberto por
        tentativa.
      </P>
      <CodeBlock title="GET">{`https://sls.g2g.com/offer/search
  ?seo_term=poe-currency
  &country=US          # obrigatorio — sem ele: 4001 Missing mandatory parameter
  &currency=USD
  &group=0             # abre os grupos; no default cada linha e so a mais barata
  &q=Divine%20Orb      # sem isso o Divine e inalcancavel por sort=lowest_price
  &page_size=100&sort=lowest_price&page=1`}</CodeBlock>

      <Callout type="info" title="Liga e item so existem no title">
        <code>offer_attributes</code> usa IDs opacos (<code>lgc_19398_tier_47227</code>).
        A unica fonte legivel e o <code>title</code>, no formato
        <code> [PC] Allflame Standard &gt; Divine Orb</code>. O sufixo e
        <strong> dificuldade</strong>: "Allflame Standard" e a liga temporaria
        softcore, nao a Standard permanente. Uma consulta devolve PC, PS4 e Xbox e
        todas as ligas misturadas — o filtro e feito no cliente.
      </Callout>

      <H2>Por que MAD e nao IQR</H2>
      <P>
        A distribuicao do G2G e muito assimetrica a direita. Numa amostra real de
        80 ofertas de Divine (08/08/2026) havia listagens de US$ 1, US$ 2,20,
        US$ 10,05, US$ 22 e US$ 999,99 contra uma mediana de US$ 0,06 — a media
        bruta da US$ 13. A cerca classica q3 + 1.5*IQR caiu em US$ 0,394, quase 7x
        a mediana, e ainda deixava lixo passar. O MAD com k=4 corta em US$ 0,165 e
        mantem 58 das 80. A mediana ficou estavel entre k=3 e k=6, o que indica que
        a estimativa nao depende da escolha do parametro.
      </P>

      <H3>Cuidado com o piso</H3>
      <P>
        As ofertas mais baratas costumam ter min_qty igual ao available_qty: so
        vendem o lote inteiro. Por isso o snapshot guarda p25 alem do min.
      </P>

      <H2>Operacao</H2>
      <CodeBlock title="CLI">{`npx tsx scripts/g2g-price-collector/index.ts --dry-run
npx tsx scripts/g2g-price-collector/index.ts --league Allflame
npx tsx scripts/g2g-price-collector/index.ts --item "Chaos Orb"`}</CodeBlock>
      <P>
        Em producao o agendamento e uma <strong>Scheduled Task do Coolify</strong>
        (g2g-price-collect, */30 * * * *, timeout 120s) rodando dentro do container
        do app. Como ela nao tem cookie de sessao, chama a rota com
        Authorization: Bearer CRON_SECRET. Nao ha container proprio pro coletor.
      </P>
      <Callout type="warning" title="Env var nova exige redeploy">
        O CRON_SECRET e variavel de ambiente da aplicacao no Coolify. Ele so entra
        no container num redeploy — sem ele no ambiente, o caminho do cron fica
        desligado (secret vazio nunca autentica) e a task devolve 401.
      </Callout>

      <H2>Arquivo: o historico do Discord</H2>
      <P>
        Ate ago/2026 o preco vinha de scraping de canais do Discord. Esse pipeline
        foi removido (tabelas price_entries e discord_sources dropadas). A tabela
        daily_prices foi PRESERVADA como arquivo read-only: as simulacoes
        (import-prices, create-projected e o overlay do comparador de cenarios) se
        apoiam nos ~926 dias de historico de ligas passadas. Ela nao recebe dados
        novos.
      </P>
      <Callout type="danger" title="Nao misture as duas series">
        daily_prices e preco de venda propria em BRL; g2g_price_snapshots e preco
        de concorrencia em USD. Sao grandezas diferentes — cruzar as duas eras num
        mesmo grafico produz leitura errada.
      </Callout>
    </>
  );
}
