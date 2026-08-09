# Session 25 — O custo por dia do /farm/profit mentia: correção, tooltip e payback

**Tema:** tornar o custo da calculadora de profit auditável na tela, e responder
"quanto tempo uma conta leva pra se pagar".

## 0. O bug que puxou o fio (dado, não código)

O operador perguntou se o custo por dia era multiplicado pelo número de bots:
com 6 bots o card mostrava **US$ 8,40** e o ExPlugins real é 1,80/bot/dia.

A multiplicação sempre esteve certa. `8,40 = 6 × (1,00 + 0,30 + 0,10)` — o
`explugins_key_cost_daily` da config `Custos Padrão 2026` em prod ainda estava
em **1,0000**, o valor do seed (`prisma/seed.ts:44`), nunca atualizado desde a
criação da config.

Corrigido direto no Postgres de prod (`docker exec poe-postgres psql -U poe -d
poth`, `UPDATE 1`, `updated_at` renovado). Com 6 bots o custo passou de 8,40
para **13,20/dia** (+US$ 144/mês).

Checagens antes do UPDATE:
- As 24 simulações salvas têm snapshot próprio em `sim_explugins_key_cost_daily`
  (0 nulls) → nenhuma foi afetada retroativamente.
- Config `Poe 2` (não-padrão) tem ExPlugins 2,0000 / DPB 0,7900 — **não tocada**,
  o operador não confirmou o valor dela.

**Pendente**: `prisma/seed.ts` continua semeando 1.0 (+ proxy 5,00, DPB 0), então
um banco de dev novo nasce desalinhado com prod. É fixture de dev; deixei como
está de propósito, mas vale decidir.

## 1. Breakdown do custo na tela

O card só mostrava o total, com hint fixo "Operacional recorrente" — foi
exatamente essa opacidade que escondeu o valor velho por semanas.

| Arquivo | Mudança |
|---|---|
| `lib/daily-cost.ts` | + `breakdownDailyCost(parts, activeBots)` → parcelas com `key` estável, `perBotDaily` e `totalDaily`; componentes zerados omitidos |
| `lib/daily-cost.ts` | + `perBotDailyCost(parts)` — soma só o que escala com bot; `dailyCostFor` passou a chamá-la em vez de repetir a soma |
| `components/modules/profit/profit-summary-cards.tsx` | hint virou `6 bots × US$ 2,20/bot`; tooltip abre linha a linha |

Invariante testado: a soma dos `totalDaily` é igual a `dailyCostFor(parts, bots)`.
O tooltip **não** reimplementa a conta — foi o critério para pôr a decomposição
em `lib/` e não no componente.

## 2. Payback do bot (card novo)

`lib/bot-payback.ts` + `computeBotPayback()`: `setup ÷ lucro por bot por dia`,
ao preço de hoje. Card "Payback do bot" com tooltip mostrando receita, custo e
lucro por bot. Abaixo de um dia exibe em horas; sem lucro exibe "Nunca".

Duas decisões que mudam o número:

- **Custos globais não entram.** Se entrassem, o payback de uma conta pioraria
  ao ligar outra conta — o inverso da realidade. `perBotDailyCost` existe para
  isso.
- **Preço de hoje, sem a curva de queda.** Foi o que o operador pediu; o tooltip
  avisa. A versão curva-aware ficaria presa ao horizonte da projeção.

`oneTimeCostPerBot()` (leveling + stash pack + customs `one_time` por bot) é
novo em `lib/daily-cost.ts` e agora sai na API — o `decomposeDailyCost` continua
ignorando essas parcelas, como sempre.

## 3. Editor de custos só da tela

`components/modules/profit/profit-cost-editor.tsx` + `hooks/use-profit-cost-override.ts`.

Os 5 componentes recorrentes + setup por bot viram campos editáveis, semeados da
config selecionada. Editou → badge `editado — não salvo` e botão Restaurar.
**Nada persiste**: é bancada de simulação, o cadastro continua em
`/admin/config/costs`. Trocar de config descarta o override de propósito —
misturar override de uma config com números de outra daria um total que não
corresponde a config nenhuma.

## 4. Preço do comprador (CNL)

A tabela `sales` está vazia (0 linhas), então não há como puxar o preço do CNL
do banco. Virou terceira opção em "Preço base": `Preço do comprador (manual)`,
com o delta vs G2G em destaque (`−34,6% vs mediana da G2G (US$ 0,0642)`).

O ajuste percentual desaparece quando ela está ativa: o preço manual **já é** o
que o comprador paga, aplicar o ajuste em cima contaria o desconto duas vezes.

## Arquivos

Novos: `lib/bot-payback.ts` (+ test), `hooks/use-profit-cost-override.ts`,
`components/modules/profit/{profit-cost-editor,number-field}.tsx`,
`components/modules/profit/profit-summary-cards.test.tsx`.

Tocados: `lib/daily-cost.ts` (+ test), `app/api/prices/profit-forecast/route.ts`
(devolve `oneTimePerBot`), `hooks/use-profit-forecast-data.ts`,
`components/modules/profit/{profit-inputs,profit-summary-cards}.tsx`,
`app/(auth)/farm/profit/page.tsx`.

`NumberField` saiu de dentro do `profit-inputs.tsx` para `number-field.tsx`
porque o editor de custos precisava do mesmo campo — não vale duplicar.

## O que os números reais dizem

Setup por bot na config padrão: **US$ 23,82** (leveling 12,01 + stash 11,81).

| Cenário | Receita/bot/dia | Custo/bot/dia | Payback |
|---|---|---|---|
| 2 div/h × 8h @ 0,042 (CNL) | US$ 0,67 | US$ 2,20 | Nunca |
| 2 div/h × 8h @ 0,0642 (G2G) | US$ 1,03 | US$ 2,20 | Nunca |
| 10 div/h × 8h @ 0,042 | US$ 3,36 | US$ 2,20 | 20,5 dias |

**Um bot precisa de ~52 divines/dia só para cobrir o próprio custo recorrente ao
preço do CNL** (2,20 ÷ 0,042) — 6,5 div/h em 8h de operação. Nos parâmetros
default da tela (2 div/h) nenhum preço plausível fecha a conta.

## Validação

`npx vitest run` — suíte completa. `npx tsc --noEmit` limpo nos arquivos tocados
(os erros restantes são pré-existentes: `annual/[id]/page.tsx`, mock do Prisma em
`create-projected.test.ts`, formatter do recharts, `publish-form.test.tsx`).

**Sem smoke test na UI**: o `.env` aponta pra `localhost:5442`, túnel SSH pro
Postgres da VPS, e a porta está fechada — `npm run dev` não sobe sem ele.

## Known issues (não resolvidos aqui)

- **A fórmula do custo diário está reimplementada em 3 lugares** além do
  `dailyCostFor`: `simulation-comparison/daily-breakdown.tsx:160-166`,
  `simulation-comparison/helpers.ts` e `simulation-editor/cohorts.ts:189-213`.
  A cópia do `daily-breakdown` **ignora o desconto do ExPlugins** que o
  `simulation-calculator` aplica (`effectiveExpluginsRate`), então a tabela
  dia-a-dia e o card de total da mesma simulação divergem com desconto ligado.
- **Labels ambíguos em `/admin/config/costs`**: "Explugins Key (diario)" e "DPB
  Key (diario)" não dizem "por bot", ao contrário de "Proxy/Bot", "Leveling/Bot"
  e "Stash Pack/Bot" — e são justamente os dois que o cálculo multiplica por bot.
  Se a chave do ExPlugins for uma só para a operação inteira, o modelo está
  errado e a correção é estrutural (flag `perBot` nos campos de chave), não de
  valor.
- **Prettier não é dependência do repo** apesar de o CLAUDE.md mandar usá-lo;
  `npx prettier` instala a última versão e formata com `printWidth` 80 contra os
  100 documentados. Formatei com `--print-width 100` explícito.
