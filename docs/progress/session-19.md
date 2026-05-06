# Session 19 — Simulations: progressão automática de bots + build cost BRL canônico

Tema: dois ajustes no módulo de simulações pedidos pelo operador — (1)
um botão pra preencher `activeBots` em todos os dias seguindo uma rampa
linear até o teto, e (2) refatoração do cálculo de build cost pra travar
o valor em BRL no dia em que cada bot entra em operação, em vez de usar
o preço da divine da semana.

## Progressão automática de bots

Novo endpoint `POST /api/simulations/[id]/bot-progression` recebe
`{ maxBots, incrementPerDay, startBots?, startDay? }`, itera todo dia
em ordem cronológica e grava `activeBots = min(startBots + i ×
incrementPerDay, maxBots)` como override em cada `SimulationDay`. Tudo
em uma única `prisma.$transaction()` pra evitar estado parcial.

`startDay` default = `simulation.startDayOffset + 1` (pula os dias
travados pelo offset). `startBots` default = 1.

UI nova em `components/modules/simulations/bot-progression-dialog.tsx`
— botão "Progressão Auto" no `SimulationHeader` (ao lado do Importar
Preços e do CostConfigSelector), formulário com 4 campos numéricos e
preview em tempo real ("dias afetados", "atinge máximo no dia X", "Y
dias de rampa"). Após submeter, dispara `fetchSimulation()` pra
recarregar.

Schema zod novo: `botProgressionSchema` em
`lib/validations/simulation.ts`, com `.refine()` exigindo `startBots ≤
maxBots`.

## Build cost: BRL canônico, travado no dia do bot

Antes: `buildCostDivines` por semana × `defaultDivinePriceUsd(semana)`,
com fallback BRL/exchange. Acumulava em USD na hora do agregado.

Agora: itera dia-a-dia. Pra cada dia D, `newBots = max(0,
resolvedBots(D) - resolvedBots(D-1))`, custo `= newBots ×
week.buildCostDivines × dayPriceBrl(D)`. Fallback `priceUsd ×
exchangeRate` quando só USD está setado. O total fica em BRL canônico
(divine é dolar-pegado in-game; travar em BRL no dia do build espelha o
gasto real do operador).

Aplicado em 4 lugares:

- `lib/simulation-calculator.ts` — `calculateBuildCostUsd` →
  `calculateBuildCostBrl`. `SimulationCalculation` ganha campo
  `buildCostBrl`.
- `app/api/simulations/[id]/route.ts` — resposta expõe
  `calculated.buildCostBrl`.
- `components/modules/simulations/simulation-editor/utils.ts` — nova
  `calcBuildCostBrl` + `SimulationTotals.buildCostBrl`. Antes o editor
  nem somava build cost no `totalCost`; agora soma (convertido pra USD
  via exchangeRate, pra manter o agregado USD consistente).
- `components/modules/simulations/simulation-editor/simulation-cost-breakdown.tsx`
  — linha "Build (divines)" usa `formatMoney(totals.buildCostBrl,
  "brl")` em vez de `"usd"`, então respeita o toggle BRL/USD do
  `currency-provider` automaticamente.
- `components/modules/simulations/simulation-comparison/{types,helpers}.ts`
  — `SimTotals.buildCostBrl` + `calcBuildCostBrl`.
- `lib/annual-plan-calculator.ts` — loop de build per-day, calcula em
  BRL, converte pro agregado USD da liga.

## Validação

- `npx tsc --noEmit` — sem erros novos nos arquivos tocados (apenas
  pre-existentes em annual page, benchmark forms, editor tests).
- `npx vitest run lib/simulation-calculator` — 45/45 passando.

## Cenários e cohorts (chunk 2)

Dois painéis novos no editor da simulação, expansíveis via Accordion.

**A — Testador de cenários** (`scenarios.ts` + `scenario-tester.tsx`):
forka a `Simulation` em memória sobrescrevendo `activeBots` por dia
segundo a fórmula de progressão e roda `calcTotals` no fork — sem
persistir nada. Tabela com baseline + N variantes editáveis (max bots,
incr/dia, bots iniciais, dia início), recálculo instantâneo via
`useMemo`, coluna Δ Lucro vs baseline, botão Aplicar por linha que
chama o endpoint `bot-progression` existente. Default 2 cenários
("Rampa lenta" e "Rampa rápida"), até 6 simultâneos.

**B — Cohort breakdown** (`cohorts.ts` + `cohort-breakdown.tsx`):
detecta dias onde `bots(D) > bots(D-1)` e cria um cohort por evento.
Pra cada cohort, calcula lifetime isolado (só os bots dele, de D até
o fim): divines produzidos, receita, custo operacional, build cost
BRL travado, leveling, lucro, ROI, break-even em dias e lucro por
bot. Tabela ordenada cronologicamente com header agregado (total de
bots, cohorts, break-even médio).

Integrados via `Accordion type="multiple"` entre chart e weeks
accordion, ambos colapsados por default pra não poluir.

Tamanhos: scenarios.ts 98L, cohorts.ts 226L, cohort-breakdown.tsx
172L, scenario-tester.tsx 377L — todos < 500L.

## Price overlay nos cenários (chunk 3)

`Scenario` ganhou eixo ortogonal: além da progressão de bots, agora
aceita um overlay de preços históricos. Cada cenário tem
`price: { league, source, startDay }` onde `league=null` significa
"usar preços atuais da sim".

Helper novo `applyPriceOverlay` em `scenarios.ts`: forka a sim
sobrescrevendo `divinePriceBrl/Usd` por dia mapeando cada dia do sim
a uma data real (`leagueStartDate + (priceStartDay-1) +
globalDayIdx`). Limpa week defaults pra forçar o cálculo a usar só os
dias com match no priceMap. `calcScenario` agora aplica overlay
primeiro (reseta preços) e depois progression (que só toca
activeBots).

Cache de preços com lazy-fetch: quando o usuário escolhe uma liga em
algum cenário, o tester chama `GET /api/prices/daily?league=X&item=
divine` e armazena no `priceCache`. Linhas mostram "…" enquanto
carrega.

UI da row extraída pra `scenario-row.tsx` (246L) — antes ia explodir
o tester acima de 500L. Coluna nova "Preços" com select compacto que
encoda `(liga, fonte)` num único valor (`Mirage::median` etc.) e um
input "Dia liga" condicional quando overlay ativo.

Apply continua chamando só o endpoint `bot-progression` — preços
ficam apenas no preview. Toast informa quando o cenário tem overlay
de preços que a Apply não vai persistir.

Tamanhos finais: scenarios.ts 185L, scenario-tester.tsx 353L,
scenario-row.tsx 246L.

## O que ficou pra depois

- Testes de unidade pra `calcBuildCostBrl` cobrindo: rampa diária com
  preços diferentes por dia, fallback USD→BRL, dia sem preço, semana
  sem `buildCostDivines`.
- Teste de integração pro endpoint `bot-progression` (precisa do
  `potc_test` DB rodando).
- O scraper Discord segue manual — infra do `docker compose up -d
  scraper` existe mas o serviço nunca foi iniciado nesta máquina.
