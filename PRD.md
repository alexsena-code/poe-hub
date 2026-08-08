# PRD — PoE HUB

## 1. Visão Geral

**Projeto:** PoE HUB — Plataforma de gestão operacional para operação de bots de farming em Path of Exile.

**Objetivo:** Substituir a planilha atual por uma aplicação web completa que centralize: gestão de bots, histórico de preços do mercado (via Discord), registro de vendas, simulações de faturamento por liga/temporada, e organização de tarefas da equipe.

**Usuários:** Equipe interna da Path of Trade (1-5 operadores). Não há necessidade de multi-tenancy ou autenticação pública — apenas login interno.

---

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend/API** | Next.js API Routes (Route Handlers) — monolith fullstack |
| **ORM** | Prisma |
| **Banco de Dados** | PostgreSQL 16 |
| **Scraping de Preços** | Script Node.js/TypeScript standalone (CLI) usando DiscordChatExporter CLI ou parsing de JSON exportado |
| **Autenticação** | NextAuth.js (credentials provider — login/senha simples) |
| **Hosting** | VPS na AWS (EC2 ou Lightsail) com Docker Compose (app + postgres) |
| **CI/CD** | GitHub Actions → deploy via SSH/Docker |

> **Nota para o dev (Claude Code):** Se houver dúvida sobre a escolha de monolith fullstack (Next.js API Routes) vs backend separado (NestJS), pergunte ao usuário. A decisão atual é manter tudo em Next.js por simplicidade, mas o módulo de scraping de preços do Discord será um script CLI separado rodando via cron.

---

## 3. Módulos e Features

### 3.1 — Módulo: Gestão de Bots

**Descrição:** CRUD completo para cadastro e gestão dos bots (contas de PoE usadas para farming).

**Entidade `Bot`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `nick` | string | Nome/apelido do bot (ex: "Luizina", "Sister") |
| `email` | string | Email da conta PoE |
| `password` | string (encrypted) | Senha da conta PoE — **armazenar criptografada** (AES-256 ou similar) |
| `proxy_ip` | string | IP do proxy (ex: "138.99.147.151") |
| `proxy_port` | int? | Porta do proxy (se aplicável, separar do IP) |
| `proxy_username` | string (encrypted) | Username de autenticação do proxy |
| `proxy_password` | string (encrypted) | Senha de autenticação do proxy |
| `proxy_eol` | date? | Data de expiração/fim de vida do proxy |
| `status` | enum | `active`, `inactive`, `banned`, `maintenance` |
| `notes` | text? | Observações livres |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Funcionalidades da UI:**

- Tabela listando todos os bots com busca/filtro por status
- Formulário de criação/edição com validação
- Campos sensíveis (password, proxy_password) com toggle de visibilidade e copy-to-clipboard
- Indicador visual de proxy expirado (proxy_eol < hoje)
- Ação rápida para alternar status (active/inactive)
- **Futuro (não implementar agora):** Integração com DPB para criação automática de perfis. Apenas deixar a estrutura de dados pronta.

> **Pergunta para o dev:** O `proxy_port` deve ser separado do `proxy_ip` ou o usuário sempre informa como `ip:port` junto? Verificar com o usuário o formato preferido.

---

### 3.2 — Módulo: Histórico de Preços (Discord Scraping)

> **SUPERADO em ago/2026 (session 24).** Esta seção fica como registro do
> requisito original; **não descreve o sistema atual**. O scraping do Discord foi
> removido (tabelas `price_entries` e `discord_sources` dropadas) e substituído
> pela coleta do marketplace **G2G** — preço da concorrência em USD, não preço de
> venda própria em BRL. A tabela `daily_prices` foi preservada como arquivo
> read-only porque as simulações dependem dela. Ver `docs/progress/session-24.md`
> e `scripts/g2g-price-collector/README.md`.

**Descrição:** Coletar preços de Divine Orbs e outros itens publicados em canais específicos do Discord, armazenar em PostgreSQL, e exibir histórico/gráficos na plataforma.

#### 3.2.1 — Script de Coleta (CLI separado)

**Abordagem com DiscordChatExporter:**

1. **Opção A (preferida):** Usar [DiscordChatExporter.CLI](https://github.com/Tyrrrz/DiscordChatExporter) para exportar mensagens em formato JSON de canais específicos via linha de comando.
   - Requer token de usuário ou bot do Discord
   - Comando: `DiscordChatExporter.Cli export -t <token> -c <channel_id> -f Json -o <output_path>`
   - Rodar via cron (ex: a cada 1h ou a cada 6h)

2. **Opção B (fallback):** Exportação manual dos JSONs pelo usuário, e o script apenas faz o parsing dos arquivos JSON colocados em um diretório monitorado.

**Pipeline de processamento:**

```
Discord Channel → DiscordChatExporter (JSON) → Parser Script → PostgreSQL
```

**O parser deve:**

- Ler o JSON exportado
- Identificar mensagens que contêm anúncios de preço (regex/heurística)
- Extrair: `autor`, `preço`, `moeda` (divine, chaos, USD, BRL), `item` (se aplicável), `timestamp`
- Classificar o autor — marcar se é o revendedor principal ("CNL") ou "outros"
- Inserir no banco evitando duplicatas (usar message_id do Discord como chave)

**Entidade `PriceEntry`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `discord_message_id` | string (unique) | ID da mensagem original no Discord |
| `discord_channel_id` | string | Canal de origem |
| `discord_server_id` | string | Servidor de origem |
| `author_discord_id` | string | ID do autor no Discord |
| `author_name` | string | Nome do autor |
| `is_cnl` | boolean | Se é o revendedor principal (CNL) |
| `price` | decimal | Valor numérico do preço |
| `currency` | enum | `divine`, `chaos`, `usd`, `brl`, `other` |
| `item` | string? | Item referenciado (se extraível) |
| `raw_message` | text | Mensagem original completa |
| `message_timestamp` | timestamp | Data/hora da mensagem no Discord |
| `league` | string? | Liga/temporada do PoE (se identificável) |
| `created_at` | timestamp | |

**Entidade `DiscordSource` (configuração):**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `server_id` | string | ID do servidor Discord |
| `server_name` | string | Nome amigável |
| `channel_id` | string | ID do canal |
| `channel_name` | string | Nome amigável |
| `is_active` | boolean | Se deve ser coletado |
| `cnl_author_ids` | string[] | IDs do Discord que são classificados como "CNL" |

**Funcionalidades da UI:**

- **Configuração de Sources:** Tela para cadastrar/editar os servidores e canais do Discord a serem monitorados, e definir quais author_ids são "CNL"
- **Dashboard de Preços:**
  - Gráfico de linha temporal mostrando evolução dos preços (CNL vs Outros)
  - Filtros por: período, canal, liga, moeda
  - Tabela com histórico detalhado (paginada)
  - Indicadores: preço atual CNL, preço médio CNL (7d, 30d), preço médio mercado, spread CNL vs mercado

> **Pergunta para o dev:** Qual é o formato típico das mensagens de preço no Discord? Exemplos reais ajudariam a construir o parser/regex. Perguntar ao usuário por 3-5 exemplos de mensagens.

> **Pergunta para o dev:** O token do Discord será de um bot ou de um usuário? Isso impacta a configuração do DiscordChatExporter.

---

### 3.3 — Módulo: Registro de Vendas

**Descrição:** Registrar cada venda realizada, com preço, comprador, quantidade, e valor da Divine no momento.

**Entidade `Sale`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `date` | date | Data da venda |
| `buyer_id` | UUID (FK → Buyer) | Para quem foi vendido |
| `quantity` | decimal | Quantidade vendida (em divines ou unidades) |
| `unit` | enum | `divine`, `chaos`, `exalted`, `other` |
| `divine_price_usd` | decimal? | Preço da divine em USD no momento da venda |
| `divine_price_brl` | decimal? | Preço da divine em BRL no momento da venda |
| `total_usd` | decimal? | Valor total em USD (calculado ou manual) |
| `total_brl` | decimal? | Valor total em BRL (calculado ou manual) |
| `league` | string | Liga/temporada |
| `notes` | text? | Observações |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Entidade `Buyer`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | Nome/apelido do comprador |
| `is_cnl` | boolean | Se é o revendedor principal |
| `contact` | string? | Discord, email, etc. |
| `notes` | text? | |

**Funcionalidades da UI:**

- **Formulário de Nova Venda:**
  - Selecionar comprador (dropdown com busca, opção de criar novo inline)
  - Data (default: hoje)
  - Quantidade
  - Preço da Divine (USD e/ou BRL) — com opção de puxar automaticamente o último preço do módulo de Histórico de Preços
  - Total calculado automaticamente
  - Liga (dropdown das ligas cadastradas)
- **Histórico de Vendas:**
  - Tabela paginada com filtros: período, comprador, liga
  - Totais acumulados no topo (total USD, total BRL, quantidade total)
  - Export para CSV
- **Dashboard de Vendas:**
  - Gráfico de vendas por período (dia/semana/mês)
  - Vendas por comprador (pizza/bar)
  - Revenue total por liga

---

### 3.4 — Módulo: Simulações de Faturamento

**Descrição:** Criar simulações/projeções de faturamento para ligas futuras ou em andamento, baseando-se em: preços de mercado, quantidade de bots rodando por período, e custos operacionais.

**Este é o módulo mais complexo. Atenção especial à flexibilidade.**

#### Entidades:

**`Simulation`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | Nome da simulação (ex: "Liga 3.26 - Cenário Otimista") |
| `league` | string | Liga de referência |
| `status` | enum | `draft`, `active`, `archived` |
| `duration_weeks` | int | Duração total da simulação em semanas |
| `notes` | text? | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**`SimulationWeek`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `simulation_id` | UUID (FK) | |
| `week_number` | int | Semana 1, 2, 3... |
| `label` | string? | Label customizado (ex: "Launch Week") |
| `default_active_bots` | int | Qtd padrão de bots para todos os dias desta semana |
| `default_divine_per_hour` | decimal | Div/hora padrão por bot para todos os dias desta semana |
| `default_hours_per_day` | decimal | Horas de operação por dia (default: 24) |
| `default_divine_price_usd` | decimal? | Preço padrão da divine em USD para a semana |
| `default_divine_price_brl` | decimal? | Preço padrão da divine em BRL para a semana |

> **Herança semana → dia:** Todos os campos `default_*` da semana são herdados pelos dias. Se o dia tiver um override (valor não-nulo), o override prevalece. Isso permite configurar a semana inteira de uma vez e só ajustar dias específicos quando necessário.

**`SimulationDay`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `simulation_week_id` | UUID (FK) | |
| `day_number` | int | Dia dentro da semana (1-7) |
| `date` | date? | Data real (opcional, para simular datas específicas) |
| `active_bots` | int? | **Override:** se `null`, herda `default_active_bots` da semana |
| `divine_per_hour` | decimal? | **Override:** se `null`, herda `default_divine_per_hour` da semana |
| `hours_per_day` | decimal? | **Override:** se `null`, herda `default_hours_per_day` da semana |
| `divine_price_usd` | decimal? | **Override:** se `null`, herda `default_divine_price_usd` da semana |
| `divine_price_brl` | decimal? | **Override:** se `null`, herda `default_divine_price_brl` da semana |
| `override_notes` | text? | Justificativa para valores customizados |

> **Lógica de resolução (para cada campo):**
> ```
> valor_efetivo = dia.campo ?? semana.default_campo
> ```
> Na UI, campos herdados devem aparecer com estilo visual diferente (ex: texto cinza/itálico) para indicar que vêm da semana. Ao editar, o campo se torna um override (texto normal/bold). Deve haver ação de "resetar para padrão da semana" (setar null) em cada campo do dia.

**`GlobalCostConfig`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | Nome da configuração (ex: "Custos Padrão 2026") |
| `is_default` | boolean | Se é a config ativa |
| `proxy_cost_per_bot_monthly` | decimal | Custo mensal de proxy por bot |
| `vps_cost_monthly` | decimal | Custo mensal de VPS |
| `dpb_license_cost_monthly` | decimal | Custo de licença DPB mensal |
| `other_fixed_costs_monthly` | decimal | Outros custos fixos mensais |
| `other_variable_cost_per_bot` | decimal | Outros custos variáveis por bot |
| `notes` | text? | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

> **A `GlobalCostConfig` é compartilhada entre simulações.** Uma simulação referencia uma configuração de custos, mas a quantidade de bots/dia é exclusiva de cada simulação.

**`SimulationCostLink`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `simulation_id` | UUID (FK) | |
| `cost_config_id` | UUID (FK) | |

#### Cálculos da Simulação:

**Resolução de valores (herança semana → dia):**
```
active_bots       = dia.active_bots       ?? semana.default_active_bots
divine_per_hour   = dia.divine_per_hour   ?? semana.default_divine_per_hour
hours_per_day     = dia.hours_per_day     ?? semana.default_hours_per_day
divine_price_usd  = dia.divine_price_usd  ?? semana.default_divine_price_usd
divine_price_brl  = dia.divine_price_brl  ?? semana.default_divine_price_brl
```

Para cada dia:
```
divines_dia = active_bots × divine_per_hour × hours_per_day
receita_dia_usd = divines_dia × divine_price_usd
receita_dia_brl = divines_dia × divine_price_brl
```

Para cada semana:
```
receita_semana = Σ receita_dia (todos os dias da semana)
custo_semana = (custos_fixos_mensais / 4) + (max(active_bots_na_semana) × custos_variaveis_por_bot × 7/30)
lucro_semana = receita_semana - custo_semana
```

Para a simulação inteira:
```
receita_total = Σ receita_semana
custo_total = Σ custo_semana
lucro_total = receita_total - custo_total
roi = lucro_total / custo_total × 100
```

> **Nota:** As fórmulas de rateio de custo acima são sugestões. O dev deve perguntar ao usuário se a lógica de rateio faz sentido ou se prefere outro modelo.

#### Funcionalidades da UI:

- **Lista de Simulações:**
  - Cards ou tabela com nome, liga, status, receita/lucro estimados
  - Ações: duplicar, arquivar, deletar
  - Criar nova simulação (wizard ou formulário)

- **Tela de Edição da Simulação:**
  - **Vista por Semana:** Accordion/tabs mostrando cada semana
    - **Header da semana:** Campos editáveis para os defaults da semana (`default_active_bots`, `default_divine_per_hour`, `default_hours_per_day`, `default_divine_price_usd/brl`). Alterar aqui propaga para todos os dias que **não** têm override.
    - **Tabela de dias (dentro da semana):** 7 linhas, uma por dia, com colunas editáveis inline
      - Campos herdados da semana exibidos em **cinza/itálico** — indicam valor padrão
      - Ao clicar e editar, o campo vira **override** (texto normal/bold)
      - Ícone de "reset" (↩) ao lado de cada campo com override para voltar ao padrão da semana
      - Coluna calculada: `divines_dia`, `receita_dia` (não editável, recalcula em tempo real)
    - Subtotais por semana (receita, custo, lucro)
  - **Vista Geral:** Gráfico mostrando curva de receita/custo/lucro ao longo das semanas
  - **Configuração de Custos:** Selecionar qual `GlobalCostConfig` usar, com link para editar
  - **Preenchimento Rápido:**
    - "Aplicar X bots para toda a semana Y" (seta `default_active_bots` da semana)
    - "Aplicar X div/hora para toda a semana Y"
    - "Aplicar preço da divine de $Z para todas as semanas"
    - "Importar preços médios do módulo de Histórico de Preços"
    - "Copiar configuração da semana X para a semana Y"
  - **Resumo:**
    - Receita total estimada (USD e BRL)
    - Custo total estimado
    - Lucro líquido estimado
    - ROI
    - Break-even (em qual semana os custos são cobertos)

- **Configuração Global de Custos:**
  - CRUD de configurações de custo
  - Uma config pode ser marcada como "padrão" para novas simulações
  - Campos editáveis com labels claros e tooltips explicativos

---

### 3.5 — Módulo: Tarefas

**Descrição:** Kanban simples para organização de tarefas entre os sócios. Não é um Jira — é um board leve para dividir o que precisa ser feito.

**Entidade `Task`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `title` | string | Título curto da tarefa |
| `description` | text? | Detalhes (suportar markdown básico) |
| `status` | enum | `backlog`, `todo`, `in_progress`, `done` |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `assigned_to` | UUID? (FK → User) | Quem é o responsável |
| `created_by` | UUID (FK → User) | Quem criou |
| `due_date` | date? | Prazo opcional |
| `league` | string? | Liga relacionada (opcional, para contextualizar) |
| `module` | enum? | `bots`, `prices`, `sales`, `simulations`, `infra`, `other` — categorizar por área |
| `position` | int | Ordem dentro da coluna (para drag-and-drop) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Funcionalidades da UI:**

- **Board Kanban:** 4 colunas (Backlog, To Do, Em Progresso, Concluído)
  - Drag-and-drop entre colunas (atualiza `status` e `position`)
  - Cards mostrando: título, prioridade (badge colorido), assignee (avatar/inicial), due date
  - Filtro por: assignee, prioridade, módulo
- **Criação rápida:** Input inline no topo de cada coluna para criar task com título (expandir para form completo ao clicar)
- **Modal de detalhes:** Clicar no card abre modal com edição completa (título, descrição, status, prioridade, assignee, due date, módulo)
- **Lista alternativa:** Toggle entre vista Kanban e vista lista/tabela para quem preferir

---

## 4. Entidades Auxiliares

**`League`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | Nome da liga (ex: "Settlers of Kalguur") |
| `poe_version` | enum | `poe1`, `poe2` |
| `start_date` | date? | |
| `end_date` | date? | |
| `is_current` | boolean | |

**`User` (autenticação interna):**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `username` | string | |
| `password_hash` | string | |
| `role` | enum | `admin`, `operator` |

---

## 5. Páginas/Rotas

```
/                          → Dashboard geral (resumo de tudo)
/login                     → Login

/bots                      → Lista de bots
/bots/new                  → Cadastrar bot
/bots/[id]                 → Editar bot

/prices                    → Dashboard de preços + histórico
/prices/sources            → Configurar sources do Discord

/sales                     → Histórico de vendas
/sales/new                 → Registrar venda
/sales/dashboard           → Dashboard de vendas

/simulations               → Lista de simulações
/simulations/new           → Criar simulação
/simulations/[id]          → Editar/visualizar simulação
/simulations/[id]/weeks/[n]→ Editar semana específica

/tasks                     → Board Kanban de tarefas

/settings                  → Configurações gerais
/settings/costs            → Configurações de custo
/settings/leagues          → Gerenciar ligas
/settings/buyers           → Gerenciar compradores
```

---

## 6. Requisitos Não-Funcionais

- **Segurança:** Campos sensíveis (senhas de bots, senhas de proxy) devem ser criptografados at-rest no banco (AES-256). O app deve rodar atrás de HTTPS.
- **Responsividade:** A UI deve funcionar bem em desktop (prioridade) e ser usável em mobile.
- **Performance:** O histórico de preços pode crescer bastante. Usar paginação e índices adequados. Considerar particionamento por liga se necessário.
- **Backup:** Configurar pg_dump automatizado (cron diário mínimo).
- **Docker:** Toda a aplicação (Next.js + PostgreSQL) deve rodar em Docker Compose para facilitar deploy e portabilidade.
- **Monorepo:** O script de scraping de preços do Discord pode ficar no mesmo repositório, em um diretório separado (ex: `scripts/discord-price-scraper/`).

---

## 7. Estratégia de Testes

**Regra fundamental:** Nenhuma feature é considerada completa sem testes. Testes devem ser escritos imediatamente após cada feature, antes de avançar para a próxima.

### Stack de Testes

| Tipo | Ferramenta | Descrição |
|---|---|---|
| **Unit Tests** | Vitest | Lógica pura: cálculos de simulação, crypto, parsers, validações zod |
| **Integration Tests** | Vitest + Prisma (test DB) | API Routes: CRUD completo, auth, edge cases, error handling |
| **Component Tests** | Vitest + React Testing Library | Componentes client-side: formulários, interações, estados |
| **E2E Tests** | Playwright | Fluxos críticos completos no browser (opcional, prioridade menor) |

### O que testar por módulo

**Gestão de Bots:**
- Unit: encrypt/decrypt de senhas (`lib/crypto.ts`)
- Integration: CRUD API (criar, listar, editar, deletar bot), validação de campos obrigatórios, autenticação obrigatória
- Component: formulário de bot (validação client-side, toggle de visibilidade de senha)

**Tarefas:**
- Integration: CRUD API, mudança de status, reordenação (position), filtros por assignee/prioridade
- Component: drag-and-drop do Kanban, criação rápida inline

**Registro de Vendas:**
- Unit: cálculo de totais (quantidade × preço divine)
- Integration: CRUD API, filtros por período/comprador/liga, criação de buyer inline
- Component: formulário de venda com auto-cálculo

**Histórico de Preços:**
- Unit: parser de mensagens do Discord (regex), extração de preços, classificação CNL vs outros
- Integration: inserção no banco com deduplicação por discord_message_id, idempotência do script
- Component: filtros do dashboard, gráfico de preços

**Simulações de Faturamento:**
- Unit: **cálculos são críticos** — testar extensivamente:
  - Herança semana→dia (campo do dia ?? default da semana)
  - `divines_dia = active_bots × divine_per_hour × hours_per_day`
  - Receita, custo, lucro por dia/semana/total
  - ROI e break-even
  - Edge cases: 0 bots, preço null, semana sem dias editados
- Integration: CRUD simulação, duplicar simulação, associar cost config
- Component: edição inline de semana/dia, visual de herança (cinza/bold), reset de override

### Convenções

- Arquivos de teste: `*.test.ts` / `*.test.tsx` co-localizados ao lado do arquivo testado, ou em `__tests__/`
- Naming: `describe('ModuleName')` → `it('should do X when Y')`
- Test DB: usar database separado (`potc_test`) via `DATABASE_URL` no `.env.test`
- Fixtures/factories: criar em `tests/factories/` para gerar dados de teste (bots, sales, simulations)
- CI: todos os testes devem passar no GitHub Actions antes de merge

### Cobertura mínima

| Tipo | Target |
|---|---|
| Cálculos de simulação | 100% |
| Crypto (encrypt/decrypt) | 100% |
| API Routes | 90%+ |
| Parser Discord | 90%+ |
| Componentes UI | 70%+ |

---

## 8. Prioridade de Implementação

> **Regra:** Cada fase inclui a escrita de testes. Uma feature só está completa quando seus testes passam. O ciclo por fase é: **Schema → API → Testes de API → UI → Testes de Componente → Review (qa-reviewer)**.

| Fase | Módulo | Inclui Testes |
|---|---|---|
| **1** | Infra + Auth | Setup Vitest + React Testing Library + test DB. Testes do `lib/crypto.ts` e auth |
| **2** | Gestão de Bots | Unit (crypto), Integration (CRUD API), Component (formulário) |
| **3** | Tarefas | Integration (CRUD API, reordenação), Component (Kanban) |
| **4** | Registro de Vendas | Unit (cálculos), Integration (CRUD API), Component (formulário) |
| **5** | Histórico de Preços | Unit (parser Discord), Integration (inserção + dedup), Component (dashboard) |
| **6** | Simulações de Faturamento | Unit (cálculos — cobertura 100%), Integration (CRUD + duplicação), Component (edição inline) |
| **7** | Dashboard Geral | Integration (agregações), Component (widgets) |
| **8** | Polish + E2E | Playwright para fluxos críticos, refinamentos de UX |

---

## 9. Perguntas em Aberto (para o dev resolver com o usuário)

1. **Formato das mensagens de preço no Discord:** Fornecer 3-5 exemplos reais de como os preços aparecem nos canais para calibrar o parser/regex.
2. **Token do Discord:** Será um bot token ou user token? Há algum bot já criado no Discord Developer Portal?
3. **Proxy port:** O IP do proxy já inclui a porta (ex: `138.99.147.151:port`) ou a porta é separada? Qual a porta padrão?
4. **Moeda das vendas:** As vendas são sempre em divines? Ou pode ser em outras moedas do jogo (chaos, exalted)?
5. **Rateio de custos na simulação:** A fórmula sugerida de custo semanal faz sentido? O custo de proxy é proporcional aos bots ativos ou é fixo por bot cadastrado?
6. **Divine per hour:** O valor de div/hora é estimado manualmente pelo operador ou existe alguma métrica/log dos bots para calcular automaticamente? O `hours_per_day` default deve ser 24 (bot roda o dia todo)?
7. **Multi-league:** Haverá necessidade de acompanhar múltiplas ligas simultaneamente (ex: PoE1 e PoE2)?
8. **Rate de câmbio USD→BRL:** Deve ser inserido manualmente ou puxar de alguma API (ex: AwesomeAPI)?

---

## 10. Referência de Dados Iniciais

### Bots (seed inicial)

O sistema deve ter um seed script para popular os bots iniciais. Os dados serão fornecidos separadamente em formato seguro (não incluir credenciais neste documento).

**Quantidade inicial:** 10 bots  
**Proxy username (padrão para todos):** será configurado no seed  
**Proxy password (padrão para todos):** será configurado no seed  

### Compradores (seed inicial)

- **CNL** — Revendedor principal (marcar `is_cnl = true`)
- Outros compradores a serem cadastrados conforme necessidade

---

## 11. Convenções Técnicas

- **Linguagem:** TypeScript everywhere (frontend, API, scripts)
- **Estilo de código:** ESLint + Prettier
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **Naming:** camelCase para variáveis/funções, PascalCase para componentes/tipos, snake_case para colunas do banco
- **Env vars:** Usar `.env.local` para dev, `.env.production` para prod. Nunca commitar secrets.
- **Prisma:** Migrations versionadas no git. Seed script para dados iniciais.
