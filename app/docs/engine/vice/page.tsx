import { PageTitle, H2, H3, P, Table, CodeBlock, Callout, Diagram } from '../../components';

export default function VicePage() {
  return (
    <>
      <PageTitle description="Formula composta que prioriza keywords para producao de conteudo. Score de 0 a 100.">
        VICE Scoring
      </PageTitle>

      <Diagram title="Formula">{`
  VICE = (V * 0.40) + (I * 0.10) + (C * 0.30) + (E * 0.20)

  V = Volume/Demand     (40%)  — quanto as pessoas buscam
  I = Intent             (10%)  — tipo de intencao de busca
  C = Competition        (30%)  — quao facil e ranquear
  E = Effort             (20%)  — complexidade de producao
      `}</Diagram>

      <H2>V — Volume/Demand (40%)</H2>
      <P>
        Usa curvas logaritmicas para normalizar valores de diferentes escalas.
        Formula base: <code className="px-1 py-0.5 rounded bg-surface text-[13px] font-mono border border-border">min(100, K * ln(value + 1))</code>
      </P>
      <Table
        headers={['Sinal', 'Formula', 'Prioridade']}
        rows={[
          ['searchVolume', '13 * ln(value + 1), cap 100', '1 (mais confiavel)'],
          ['impressions (GSC)', '10 * ln(value + 1), cap 100', '2'],
          ['youtubeViews', '8 * ln(value + 1), cap 100', '3'],
          ['trendingScore', '+3 a +10 pontos', '4'],
          ['ninjaPopularity', '+10% do popularity', '5'],
        ]}
      />

      <Callout type="tip" title="YouTube Views Momentum">
        Keywords com 50K+ views no YouTube recebem boost adicional.
        Entity validation (match com Item/Skill no DB) tambem aumenta o V.
      </Callout>

      <H2>I — Intent (10%)</H2>
      <Table
        headers={['Intent', 'Score', 'Exemplo']}
        rows={[
          ['informational', '90', '"how does righteous fire work"'],
          ['commercial', '75', '"best rf build poe"'],
          ['unknown', '50', '"righteous fire"'],
          ['transactional', '35', '"buy divine orb"'],
          ['navigational', '15', '"poe wiki righteous fire"'],
        ]}
      />

      <H2>C — Competition (30%)</H2>
      <P>Baseado no numero de palavras da keyword (long-tail = menos competicao = score mais alto).</P>
      <Table
        headers={['Palavras', 'Score']}
        rows={[
          ['6+ palavras', '95'],
          ['5 palavras', '85'],
          ['4 palavras', '70'],
          ['3 palavras', '50'],
          ['2 palavras', '25'],
          ['1 palavra', '10'],
        ]}
      />
      <P>Bonus: posicao no GSC &lt; 10 = +15 pontos, &lt; 20 = +8 pontos.</P>

      <H2>E — Effort (20%)</H2>
      <P>Baseado no tipo de template necessario para a keyword.</P>
      <Table
        headers={['Template Type', 'Score']}
        rows={[
          ['mechanic_guide / crafting / atlas_guide / currency_guide', '90'],
          ['build_guide / league_start', '55'],
          ['general / other', '30'],
        ]}
      />

      <H2>Modificadores Extras</H2>
      <Table
        headers={['Modificador', 'Efeito']}
        rows={[
          ['Entity validation (poe.ninja)', '+popularity*10 confirmacao, -10 dead build'],
          ['Suggest penalty', '-15 V para keywords nao validadas'],
          ['PoePerson collision', 'Filtro de nomes de streamers/pessoas'],
          ['Competitor saturation', 'Penalidade se concorrentes ja cobrem'],
          ['Qdrant pre-validation', 'Resgate de keywords borderline com evidencia'],
        ]}
      />

      <H2>Visualizacao</H2>
      <P>
        Dashboard &rarr; /dashboard/seo mostra todas as keywords com VICE score, breakdown V/I/C/E,
        e evidencia semantica. Click em qualquer keyword para ver o detalhe completo.
      </P>
    </>
  );
}
