# Session 26 — Simulador comercial de venda de bots

## Tema

Nova tela para modelar venda de bots com cobrança por uso, progressão de clientes e custos
do negócio ao longo de uma liga.

## O que foi implementado

- Rota `/farm/bot-sales`, adicionada à navegação de Farm como **Venda de Bots**.
- Dois modelos comparáveis de cobrança:
  - `Dia ativo`: uma instância usada no dia consome uma diária inteira.
  - `24h acumuladas`: runtime vira fração de bot-day.
- Progressão configurável de clientes com início/fim da aquisição, novos clientes por dia,
  horizonte, utilização e mudança de jornada.
- Custos comerciais: gateway, reembolsos, suporte por cliente-dia, custo fixo e investimento
  de lançamento.
- KPIs de receita, lucro, margem, cap, break-even e receita por cliente.
- “Trilho da liga” com clientes e lucro acumulado por dia, mais comparação imediata entre
  as duas unidades de cobrança.
- Calculadora pura em `lib/bot-sales-simulator.ts`, coberta por testes de progressão,
  faturamento por runtime, custos e validação.

## Arquivos

- `app/(auth)/farm/bot-sales/page.tsx`
- `components/modules/bot-sales/bot-sales-simulator.tsx`
- `lib/bot-sales-simulator.ts`
- `lib/bot-sales-simulator.test.ts`
- `components/layout/sidebar.tsx`

## Validação

- `npm run build`: build de produção verde; rota `/farm/bot-sales` registrada.
- `npx vitest run lib/bot-sales-simulator.test.ts`: 4 testes.
- Smoke visual ficou bloqueado pelo login do ambiente local; nenhuma credencial foi lida ou
  reutilizada para contornar autenticação.
