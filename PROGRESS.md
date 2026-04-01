# PROGRESS.md — PoE HUB

Registro de progresso, decisões técnicas e notas para documentação futura.

---

## Fase 1 — Infra + Auth ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Next.js 16 + TypeScript | ✅ | App Router, Turbopack, ESLint |
| Tailwind CSS v4 + shadcn/ui | ✅ | 17 componentes (Button, Card, Table, Dialog, Form, Select, Badge, Tabs, Accordion, etc.) |
| Prisma 6 + schema completo | ✅ | 12 models, 8 enums, indexes, relações |
| NextAuth.js (credentials) | ✅ | JWT strategy, middleware, login page |
| Docker Compose | ✅ | PostgreSQL 16 Alpine + Next.js (multi-stage Dockerfile) |
| lib/crypto.ts (AES-256-GCM) | ✅ | Encrypt/decrypt com IV aleatório |
| Layout autenticado + sidebar | ✅ | 7 links de navegação, ícones Lucide, logout |
| Seed script | ✅ | Admin user + GlobalCostConfig padrão + Buyer CNL |
| .env.example + .env.test | ✅ | Todas as variáveis documentadas |
| Vitest + 14 testes | ✅ | crypto (8 testes) + auth (6 testes) |
| 6 custom agents | ✅ | db-architect, frontend-dev, api-dev, scraper-dev, qa-reviewer, test-engineer |

### Decisões Técnicas

#### Prisma 6 em vez de 7
- **Motivo:** Prisma 7 mudou a forma de configurar datasource (`url` no schema.prisma foi deprecado, exige `prisma.config.ts`). Como é uma mudança recente e a documentação/ecossistema ainda está se adaptando, optamos pelo Prisma 6 por estabilidade.
- **Impacto:** Nenhum funcional. Quando Prisma 7 estabilizar, basta migrar o config.

#### Next.js 16 (não 14)
- **Motivo:** `create-next-app` instalou Next.js 16 como latest. Funciona com App Router normalmente.
- **Mudanças notáveis:** Middleware agora usa `export async function middleware()` em vez de re-export do next-auth. A keyword `middleware` foi deprecada em favor de `proxy`, mas ainda funciona.

#### Middleware customizado (não next-auth/middleware)
- **Motivo:** Next.js 16 exige export explícito de uma função `middleware`. O re-export `export { default } from "next-auth/middleware"` não é mais suportado.
- **Solução:** Middleware manual usando `getToken()` do next-auth/jwt.

#### Dark mode via classe `dark` no `<html>`
- **Motivo:** PRD define operação noturna como comum. Dark mode é o tema padrão e único por enquanto.
- **Implementação:** Classe `dark` fixa no `<html>`, CSS variables do shadcn/ui para o tema zinc dark.

#### Tailwind CSS v4 com @tailwindcss/postcss
- **Motivo:** Versão instalada pelo npm é v4. Usa `@import "tailwindcss"` no CSS em vez de `@tailwind base/components/utilities`. Não usa `tailwind.config.ts` — config via CSS `@theme`.

#### Campos sensíveis: formato iv:tag:ciphertext (hex)
- **Motivo:** AES-256-GCM requer IV + auth tag. Armazenar tudo em uma string simplifica o schema (campo String no Prisma). Hex encoding é mais legível que base64 para debug.

#### Decimal(18,8) para valores financeiros
- **Motivo:** Precisão suficiente para preços de divine (que podem ter muitas casas decimais em conversões). Totais de venda usam Decimal(18,2) pois são valores monetários finais.

#### UUID para todas as PKs
- **Motivo:** Convenção do PRD. Evita exposição de sequência/contagem. Compatível com distributed systems se necessário no futuro.

### Estrutura de Diretórios

```
poe-hub/
├── .claude/agents/         # 6 custom agents para Claude Code
├── app/
│   ├── (auth)/             # Layout autenticado (sidebar + auth check)
│   │   ├── dashboard/      # ✅ Placeholder com cards
│   │   ├── bots/           # ✅ Placeholder
│   │   ├── tasks/          # ✅ Placeholder
│   │   ├── sales/          # ✅ Placeholder
│   │   ├── prices/         # ✅ Placeholder
│   │   ├── simulations/    # ✅ Placeholder
│   │   └── settings/       # ✅ Placeholder
│   ├── login/              # ✅ Página de login
│   └── api/auth/           # ✅ NextAuth route handler
├── components/
│   ├── ui/                 # ✅ 17 componentes shadcn/ui
│   └── layout/sidebar.tsx  # ✅ Sidebar de navegação
├── lib/
│   ├── auth.ts             # ✅ NextAuth config
│   ├── crypto.ts           # ✅ AES-256-GCM encrypt/decrypt
│   ├── prisma.ts           # ✅ Prisma client singleton
│   └── utils.ts            # ✅ cn() helper
├── prisma/
│   ├── schema.prisma       # ✅ Schema completo (12 models, 8 enums)
│   └── seed.ts             # ✅ Admin + CostConfig + Buyer CNL
├── tests/
│   └── vitest.setup.ts     # ✅ Setup global
├── lib/crypto.test.ts      # ✅ 8 testes
├── lib/auth.test.ts        # ✅ 6 testes
├── docker-compose.yml      # ✅ PostgreSQL 16 + App
├── Dockerfile              # ✅ Multi-stage build
└── middleware.ts            # ✅ Auth middleware
```

### Pendências / Notas para próximas fases

- [x] Rodar `docker compose up -d db` + `npx prisma migrate dev` para criar o banco e primeira migration
- [ ] O seed script cria admin com senha `admin123` por padrão — trocar em produção
- [ ] `.env` de dev foi criado com chaves de teste — gerar novas para produção
- [ ] Next.js 16 deprecou middleware em favor de `proxy` — avaliar migração quando estabilizar

---

## Fase 2 — Gestão de Bots ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Zod validation schemas | ✅ | `lib/validations/bot.ts` — create, update, status toggle |
| POST /api/bots | ✅ | Cria bot com campos sensíveis criptografados |
| GET /api/bots | ✅ | Listagem paginada com filtro por status e busca por nick/email |
| GET /api/bots/[id] | ✅ | Detalhes com opção `?reveal=true` para mostrar senhas |
| PUT /api/bots/[id] | ✅ | Update parcial, re-encrypta campos sensíveis |
| DELETE /api/bots/[id] | ✅ | Deleção com verificação de existência |
| PATCH /api/bots/[id]/status | ✅ | Toggle rápido de status |
| Integration tests (17 testes) | ✅ | CRUD, validation, encrypt/decrypt, status toggle, 404s |
| Tabela de bots (BotsTable) | ✅ | Busca, filtro por status, paginação, mask de senhas |
| SecretField component | ✅ | Toggle visibilidade, copy-to-clipboard, reveal via API |
| BotStatusBadge | ✅ | Badges coloridos por status |
| BotForm (create/edit) | ✅ | react-hook-form + zod, campos de proxy, status select |
| Páginas: /bots, /bots/new, /bots/[id] | ✅ | Listagem, criação, edição |
| Component tests (11 testes) | ✅ | StatusBadge (6), SecretField (5) |
| Proxy EOL indicator | ✅ | Ícone de warning + texto vermelho quando expirado |

### Decisões Técnicas

#### Campos sensíveis mascarados por padrão
- **Motivo:** Senhas de bot e proxy são mostradas como `••••••••` em listagens e detalhes. Para revelar, o frontend faz `GET /api/bots/[id]?reveal=true`.
- **Segurança:** O endpoint de reveal exige auth. O proxy username é decriptado por padrão (não é secreto), mas password é mascarado.

#### Zod v4 com import `zod/v4`
- **Motivo:** A versão instalada do zod (4.x) usa imports diferenciados. O schema de validação da API e do formulário são separados (API aceita tipos mais ricos como `number` para port, form usa `string` para todos os inputs).

#### Testes de API via NextRequest direto
- **Motivo:** Testamos os route handlers diretamente, instanciando `NextRequest` (que tem `.nextUrl`). Não usamos HTTP real — é mais rápido e isolado. O mock de `getServerSession` simula um admin autenticado.

### Totais de Testes

| Arquivo | Testes | Tipo |
|---------|--------|------|
| lib/crypto.test.ts | 8 | Unit |
| lib/auth.test.ts | 6 | Unit |
| app/api/bots/bots.test.ts | 17 | Integration |
| components/modules/bots/bot-status-badge.test.tsx | 6 | Component |
| components/modules/bots/secret-field.test.tsx | 5 | Component |
| **Total** | **42** | |

---

## Fase 3 — Tarefas ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Zod validation schemas | ✅ | `lib/validations/task.ts` — create, update, status, reorder |
| POST /api/tasks | ✅ | Cria tarefa, auto-calcula position, createdBy da sessão |
| GET /api/tasks | ✅ | Listagem paginada com filtros: status, priority, assignee, module, search |
| GET /api/tasks/[id] | ✅ | Detalhes com relações (assignee, creator) |
| PUT /api/tasks/[id] | ✅ | Update parcial |
| DELETE /api/tasks/[id] | ✅ | Deleção com verificação |
| PATCH /api/tasks/[id]/status | ✅ | Mudança de status + auto-position |
| PATCH /api/tasks/reorder | ✅ | Batch reorder via $transaction |
| Kanban Board | ✅ | 4 colunas, HTML5 drag-and-drop, quick create inline, drop highlighting |
| Task Card | ✅ | Priority badge, module badge, due date pt-BR, assignee avatar, overdue indicator |
| Task Detail Dialog | ✅ | Edit/delete com confirmação, todos os campos |
| Task List View | ✅ | Tabela alternativa com filtros e paginação |
| Toggle Kanban/Lista | ✅ | Botões na página principal |
| Integration tests (19) | ✅ | CRUD, filters, status change, batch reorder |
| Component tests (17) | ✅ | Priority badge (9), Task card (8) |

### Decisões Técnicas

#### HTML5 Drag-and-Drop nativo (sem biblioteca externa)
- **Motivo:** Para manter dependências mínimas. O Kanban usa `draggable`, `onDragStart`, `onDrop`, `onDragOver` nativos do HTML5.
- **Trade-off:** Menos animações que @hello-pangea/dnd, mas funcional. Se o UX precisar melhorar, podemos adicionar a biblioteca depois.

#### Batch reorder via transaction
- **Motivo:** Ao mover uma task entre colunas ou reordenar, o frontend envia todas as posições afetadas em uma única chamada PATCH /api/tasks/reorder. O backend aplica via `$transaction` para atomicidade.

#### Agents paralelos
- **Motivo:** Fase 3 foi a primeira usando agents em paralelo (api-dev + frontend-dev simultâneos, depois test-engineer). Reduziu tempo de implementação significativamente.

#### Responsável via select (não input livre)
- **Motivo:** O campo `assignedTo` é FK para User. Input livre causaria erro 400 no Prisma. Criado GET /api/users + hook `useUsers()` para popular um select com os users cadastrados.

#### Módulos centralizados em lib/constants.ts
- **Motivo:** User pediu para poder alterar módulos facilmente. A lista `TASK_MODULES` é usada em todos os selects de módulo. Para alterar, basta editar esse arquivo + o enum no Prisma schema.

#### Campo Liga removido das Tasks
- **Motivo:** User confirmou que Liga não é necessário nas tarefas.

### Refatorações pós-feedback

| Item | Detalhes |
|------|---------|
| Kanban grid | `flex w-72` → `grid grid-cols-4` para margens simétricas |
| Liga removida | Campo removido dos forms de criação e edição |
| Responsável | Input texto → Select com users cadastrados (UUID por trás) |
| Módulos | Hardcoded → `lib/constants.ts` TASK_MODULES centralizado |
| GET /api/users | Novo endpoint para listar users (id, username, role) |
| hooks/use-users.ts | Hook reutilizável para fetch de users |

### Totais de Testes (acumulado)

| Arquivo | Testes | Tipo |
|---------|--------|------|
| lib/crypto.test.ts | 8 | Unit |
| lib/auth.test.ts | 6 | Unit |
| app/api/bots/bots.test.ts | 17 | Integration |
| components/modules/bots/bot-status-badge.test.tsx | 6 | Component |
| components/modules/bots/secret-field.test.tsx | 5 | Component |
| app/api/tasks/tasks.test.ts | 19 | Integration |
| components/modules/tasks/task-priority-badge.test.tsx | 9 | Component |
| components/modules/tasks/task-card.test.tsx | 8 | Component |
| **Total** | **77** | |

---

## Fase 4 — Registro de Vendas ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Zod schemas (sale + buyer) | ✅ | `lib/validations/sale.ts` |
| POST/GET/PUT/DELETE /api/sales | ✅ | Filtros: dateFrom/dateTo, buyerId, league, search. Auto-calc totals. |
| POST/GET/PUT/DELETE /api/buyers | ✅ | Delete retorna 409 se buyer tem sales |
| Sales table + filters | ✅ | Paginação, filtro por período/comprador/liga, resumo totais |
| Sale form (create/edit) | ✅ | Auto-cálculo totais em tempo real, buyer select com badge CNL |
| Buyer inline dialog | ✅ | Criar comprador direto do form de venda |
| Páginas: /sales, /sales/new, /sales/[id] | ✅ | Listagem, criação, edição |
| Integration tests (31) | ✅ | Sales (20) + Buyers (11) |

### Decisões Técnicas

#### Auto-cálculo de totais
- Total USD = quantity × divinePriceUsd (se não informado manualmente)
- Total BRL = quantity × divinePriceBrl (se não informado manualmente)
- Frontend calcula em tempo real; backend recalcula se não enviado

#### Buyer com sales não pode ser deletado
- Retorna 409 Conflict para proteger integridade referencial

---

## Fase 5 — Histórico de Preços ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Zod schemas (price + discord source) | ✅ | `lib/validations/price.ts` |
| POST /api/prices (bulk insert) | ✅ | skipDuplicates em discordMessageId |
| GET /api/prices | ✅ | Filtros: currency, isCnl, league, dateFrom/dateTo, channelId |
| GET /api/prices/stats | ✅ | CNL atual, médias 7d/30d, spread CNL vs mercado |
| DELETE /api/prices/[id] | ✅ | |
| CRUD /api/discord-sources | ✅ | Unique [serverId, channelId], 409 em duplicata |
| Price stats cards | ✅ | 5 cards: CNL atual, médias 7d/30d, spread |
| Price history table | ✅ | Paginação, filtros, toggle CNL-only, datetime pt-BR |
| Discord source manager | ✅ | CRUD com dialog, toggle active, CNL author IDs |
| Páginas: /prices, /prices/sources | ✅ | Dashboard + config sources |
| Discord scraper CLI | ✅ | Parser com 14 regex patterns, batch insert, idempotente |
| Scraper README | ✅ | Documentação de uso + cron |
| Integration tests (22) | ✅ | Prices + Discord Sources |

### Decisões Técnicas

#### Bulk insert com skipDuplicates
- Scraper e API usam `createMany({ skipDuplicates: true })` no discordMessageId
- Garante idempotência — safe to re-run

#### Stats via Prisma aggregate
- Médias calculadas com `_avg` do Prisma, filtradas por período (7d, 30d)
- Spread = ((avgMarket - avgCnl) / avgCnl) × 100

#### Scraper CLI standalone
- Roda via `npx tsx scripts/discord-price-scraper/index.ts`
- Args: `--exports-dir`, `--league`
- Processa JSONs do DiscordChatExporter, batch de 500

### Totais de Testes (acumulado Fases 1-5)

| Arquivo | Testes | Tipo |
|---------|--------|------|
| lib/crypto.test.ts | 8 | Unit |
| lib/auth.test.ts | 6 | Unit |
| app/api/bots/bots.test.ts | 17 | Integration |
| components/modules/bots/bot-status-badge.test.tsx | 6 | Component |
| components/modules/bots/secret-field.test.tsx | 5 | Component |
| app/api/tasks/tasks.test.ts | 19 | Integration |
| components/modules/tasks/task-priority-badge.test.tsx | 9 | Component |
| components/modules/tasks/task-card.test.tsx | 8 | Component |
| app/api/sales/sales.test.ts | 20 | Integration |
| app/api/buyers/buyers.test.ts | 11 | Integration |
| app/api/prices/prices.test.ts | 22 | Integration |
| **Total** | **130** | |

---

## Fase 6 — Simulações de Faturamento ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Calculation engine | ✅ | resolveDay, calculateDay/Week/Simulation, ROI, break-even |
| Unit tests (42) | ✅ | 100% coverage nos cálculos |
| CRUD Simulations API | ✅ | Create (auto-gera weeks+days), GET nested, PUT, DELETE |
| Duplicate simulation | ✅ | Deep clone com weeks + days + cost links |
| Week/Day APIs | ✅ | Update defaults, overrides, reset day (DELETE) |
| Cost config CRUD | ✅ | GET/POST/PUT/DELETE, delete blocked se em uso |
| Simulation editor UI | ✅ | Accordion semanas, tabela inline editável |
| Herança visual | ✅ | Cinza/itálico (herdado) vs bold (override), botão reset ↩ |
| Summary cards | ✅ | Receita, custo, lucro, ROI |
| Cost config selector | ✅ | Dropdown + link para /settings/costs |

### Decisões Técnicas

#### Engine de cálculo puro (sem side effects)
- Funções puras: `resolveDay`, `calculateDay`, `calculateWeek`, `calculateSimulation`
- Aceita tanto `number` quanto Prisma `Decimal` via tipo `NumericValue`
- Custo semanal: `(fixedMonthly / 4) + (maxBots × variablePerBot × 7/30)`

#### Agents paralelos (api-dev + frontend-dev)
- API e UI construídos simultaneamente, testes depois

---

## Fase 5.5 — Parser LLM + Pipeline Automatizado ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| LLM parser (Gemini 2.5 Flash-Lite) | ✅ | Substitui regex, batch de 20 msgs |
| Pipeline automatizado | ✅ | DCE integrado, incremental, multi-canal |
| League resolver por data | ✅ | Resolve liga pelo timestamp + tabela de ligas |
| CNL auto-detect | ✅ | Por author ID + fallback por conteúdo (cnlgaming+BRL) |
| DailyPrice aggregation | ✅ | Mediana, média, min, max, CNL, volume por dia |
| 23 ligas históricas | ✅ | PoE 1 (3.10-3.28) + PoE 2 (0.1-0.4) com datas |
| Discord sources seeded | ✅ | PoE 1 + PoE 2 channels com CNL IDs |

### Decisões Técnicas

#### LLM > Regex para parsing
- Regex tinha 30+ ligas fragmentadas ("Dawn", "Abyss", "Valor") e outliers R$800 (contas)
- LLM: zero outliers, classificação perfeita, CNL como "buy" (correto)
- Custo: ~$1 para todo o histórico (~40k msgs), centavos para incremental

#### League por data (não por texto)
- Mensagens mencionam "Abyss" mas a liga é "Rise of the Abyssal"
- Resolver pela data + tabela de ligas é 100% confiável

#### Primeiro dia de liga ignorado na agregação
- Preços muito voláteis no launch day

---

## Fase 7 — Dashboard Geral ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| GET /api/dashboard | ✅ | 9 queries paralelas com Promise.all |
| KPI Cards (4) | ✅ | Bots ativos, vendas 30d, divine atual (% change), tarefas abertas |
| Price chart (SVG) | ✅ | Gráfico de linhas 30d (mediana + CNL), sem lib externa |
| Task summary | ✅ | Barra + badges por status |
| Recent sales | ✅ | Últimas 5 vendas com buyer, qty, total |
| Dashboard page | ✅ | Layout responsivo: KPIs, chart+tasks, sales |

### Decisões Técnicas

#### SVG chart sem biblioteca externa
- Gráfico de linhas renderizado como SVG puro — zero dependências
- Duas linhas: mediana (azul) e CNL (dourado)

---

## Fase 8 — Polish + Settings ✅

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Settings main page | ✅ | Cards com links para sub-settings |
| Proxy settings | ✅ | Form com encrypt/decrypt, toggle visibilidade |
| League management | ✅ | CRUD completo com DatePicker, toggle ativo |
| User management | ✅ | CRUD com bcrypt, admin-only, prevent self-delete |
| Sidebar polish | ✅ | User info (nome + role badge) no rodapé |
| API users CRUD | ✅ | POST (create), PUT (update), DELETE (guard self) |

### Totais de Testes (acumulado final)

| Arquivo | Testes | Tipo |
|---------|--------|------|
| lib/crypto.test.ts | 8 | Unit |
| lib/auth.test.ts | 6 | Unit |
| lib/simulation-calculator.test.ts | 42 | Unit |
| app/api/bots/bots.test.ts | 17 | Integration |
| app/api/tasks/tasks.test.ts | 19 | Integration |
| app/api/sales/sales.test.ts | 20 | Integration |
| app/api/buyers/buyers.test.ts | 11 | Integration |
| app/api/prices/prices.test.ts | 22 | Integration |
| components/modules/bots/*.test.tsx | 11 | Component |
| components/modules/tasks/*.test.tsx | 17 | Component |
| **Total** | **172** | |

---

## Fase 9 — Polish, Custos, Moeda, Charts, Mobile, E2E

**Data:** 2026-03-31

### O que foi feito

| Item | Status | Detalhes |
|------|--------|---------|
| Separacao item vs moeda | Done | Divine/chaos como item, BRL/USD como moeda real |
| Stats cards fix | Done | Filtra por item em vez de currency, exclui outliers |
| Custos refatorados | Done | Tudo diario, per-bot, Explugins Key, DPB Key, Stash Pack, Leveling |
| Custos snapshot | Done | Valores de custo copiados pra simulacao ao selecionar config |
| Conversao USD/BRL | Done | API de cambio (open.er-api.com), toggle global na sidebar, formatMoney |
| Toggle moeda por campo | Done | Config de custos permite input em $ ou R$ por campo |
| Datas reais simulacao | Done | Dias mapeiam pra datas da liga, startDayOffset, dias bloqueados |
| Liga editavel | Done | Click para trocar liga na simulacao |
| Import precos fix | Done | Reset antes de reimportar, offset correto, refresh automatico |
| Grafico dashboard | Done | 2 charts (PoE1 + PoE2), select de range 7d/14d/30d |
| Grafico pagina precos | Done | Recharts com Mediana + CNL, ranges 7d/30d/90d |
| Filtro semana da liga | Done | Selects "Semana de/ate" auto-calculam datas |
| Ordenacao precos | Done | Select asc/desc na tabela de historico |
| Responsividade mobile | Done | Sidebar colapsavel com Sheet, hamburger, overflow-x-auto nas tabelas |
| Playwright E2E | Done | 32 testes: auth, navegacao, simulacoes, precos |
| Cron scraper | Done | cron-runner.ts, Dockerfile.scraper, docker-compose service |
| Receita unificada | Done | 1 coluna "Receita" em vez de USD+BRL separados |
| Vendas conversao | Done | Total USD/BRL auto-calculado com cambio |

### Decisoes Tecnicas

#### Custos per-bot (nao fixo)
- Explugins Key, DPB Key e Proxy sao todos multiplicados pelo numero de bots ativos
- Leveling e Stash Pack sao one-time baseados no max bots da simulacao

#### Cost snapshot na simulacao
- Ao selecionar config de custos, valores sao copiados para a simulacao
- Mudancas no config global nao afetam simulacoes existentes

#### Conversao BRL→USD
- Usa `/ exchangeRate` direto (nao a funcao convert que depende do displayCurrency)
- API de cambio com cache de 1h, fallback R$5.00

#### Datas reais nas simulacoes
- Cada dia mapeia para league_start + globalDayIndex
- Dias antes do startDayOffset ficam bloqueados (opacity-30, sem calculo)

### Migrations criadas

| Migration | Descricao |
|-----------|-----------|
| 20260331190000 | Refactor cost config: monthly → daily |
| 20260331191000 | Proxy back to monthly |
| 20260331192000 | Rename other_fixed to dpb_key |
| 20260331193000 | Add start_day_offset to simulation |
| 20260331194000 | Add stash_pack_cost_per_bot |
| 20260331195000 | Add cost snapshot fields to simulation |

---

## Pendencias / Melhorias Futuras

- [x] Grafico de evolucao de preco na pagina de Precos (usar DailyPrice)
- [ ] Export vendas para CSV
- [x] Playwright E2E para fluxos criticos
- [x] Cron setup automatizado para scraper
- [x] Responsividade mobile refinada
- [ ] Modulos editaveis nas configuracoes globais (atualmente em lib/constants.ts)
- [ ] Integracao DPB Monitor (logs em tempo real, alertas, status de bots)
