# Reanálise & Reestruturação — Hub + Engine (2026-06)

> Documento de planejamento. Escopo: reposicionar o `path-of-trade-content`
> como **provedor de dados** (warehouse + persistência), mover a **geração de
> posts** para uma **skill do Claude Code**, e **enxugar o `poe-hub`** em volta
> de ver dados + publicar. Não é changelog de sessão — quando a execução
> começar, vira `docs/progress/session-NN.md`.

## 1. Objetivo do operador

1. Usar o engine **apenas para pegar dados** (não para gerar conteúdo).
2. Criar uma **skill do Claude** que gera os posts (escopo: ideação → outline
   → escrita PT-BR+EN → SEO). Decidido: skill mora em
   `path-of-trade-content/.claude/skills/`, output em `output/posts/*.json`,
   geração antiga do engine mantida como **fallback**.
3. **Coletar dados brutos e armazenar** — trackear canais do YouTube, posts do
   Reddit, dados de concorrentes. **Manter o GSC** (útil).
4. **Resumir features** do hub — hoje está bagunçado.

## 2. Descoberta-chave: o warehouse já existe

A premissa "precisamos coletar e armazenar dados brutos" **já está
implementada no engine**. Estado atual (verificado em junho/2026):

| Fonte | Tracking persistido | Tabelas Postgres | Cron |
|---|---|---|---|
| YouTube | Canais monitorados em `YouTubeChannel` | `YouTubeScan`, `YouTubeVideo`, `YouTubeKeyword` | `0 6 * * *` smart scan |
| Reddit | Subreddits monitorados (incremental, dedup por id) | `RedditScan`, `RedditPost`, `RedditComment` | `0 0,6,12,18 * * *` |
| Concorrentes | `Competitor` (registry + auto-discover SearxNG) | `Competitor`, `CompetitorContent`, `AutoActionLog` | `0 7 * * *` |
| GSC | `KeywordOpportunity source=gsc` | `KeywordOpportunity`, `KeywordSnapshot` | `0 7 * * 1` (**pausado** — falta OAuth) |
| Google Trends | histórico diário | `GoogleTrendSnapshot`, `GoogleTrendQuery` | dentro do daily pipeline |
| poe.ninja | snapshots diários | `NinjaSnapshot` | dentro do daily pipeline |
| Cross-source | consolidação + momentum | `TrendingTerm`, `KeywordOpportunity` | daily |

**Conclusão:** o trabalho de "warehouse" é majoritariamente **manutenção e
exposição**, não construção. O que pesa (e o que a skill torna opcional) é a
camada de **geração/RAG**: embeddings em Qdrant, VICE scoring, write/plan/
ideation nodes via OpenRouter.

**Ações de dados (pequenas, não greenfield):**
- Ativar o GSC (seguir `path-of-trade-content/docs/GSC_SETUP.md`, preencher
  OAuth, religar o cron pausado).
- Tornar a lista de canais do YouTube editável pela UI (já há model + registry;
  falta CRUD limpo no hub).
- Manter o auto-discover de concorrentes rodando (já roda no daily).

## 3. Arquitetura alvo

Três camadas com fronteiras limpas:

```
┌─────────────────────────────────────────────────────────────┐
│ ENGINE (path-of-trade-content)  →  PROVEDOR DE DADOS         │
│  • Crawlers Python (YouTube/Reddit/competitors/wiki/ninja)   │
│  • Persistência Postgres (warehouse de dados brutos)         │
│  • Endpoints de leitura: /knowledge/query, /seo/*, /poeninja │
│  • Crons diários que mantêm o warehouse fresco               │
│  • [FALLBACK, congelado] pipeline de geração LLM             │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP (dados) + filesystem (output/posts)
        ┌───────┴────────┐                  ┌──────────────────┐
        ▼                ▼                  ▼                  │
┌──────────────────┐  ┌────────────────────────────┐          │
│ SKILL DO CLAUDE  │  │ HUB (poe-hub)              │          │
│  lê YAML+dados   │  │  • Farm ops (negócio)      │          │
│  escreve o post  │  │  • Views do warehouse      │◄─────────┘
│  salva via API   │  │  • Publicação (Sanity)     │   exibe dados
└──────────────────┘  └────────────────────────────┘
```

- **Engine** para de gerar; continua coletando, armazenando e servindo dados.
- **Skill** é o gerador (Opus no lugar do OpenRouter): lê os YAML
  (`style_guide.yaml` + `templates/*.yaml`) e os dados, escreve, salva via
  `POST /content/posts`.
- **Hub** deixa de ser "painel para dirigir o pipeline de LLM" e vira "painel
  para ver os dados coletados + operar o negócio + publicar".

## 4. Reanálise do engine: dados vs geração

### 4.1 Camada de DADOS — a skill e o hub consomem (MANTER)
- `POST /knowledge/query` — context assembly **sem LLM** (DADOS EXATOS do PG +
  CONTEXTO de chunks + summaries). Fronteira principal para a skill.
- `POST /knowledge/poeninja`, `/knowledge/pob-decoder`,
  `GET /knowledge/item-raw/:name`, `/knowledge/passive-tools/:name`,
  `/knowledge/quick-wiki/:term`.
- `/seo/*` (~50 endpoints): keywords, SERP, Reddit, YouTube, GSC, competitors,
  trends — leitura sobre as tabelas do warehouse.
- Crons que mantêm o warehouse (manter todos).
- `GET /content/posts`, `POST /content/posts` (persistência — a skill grava aqui).

### 4.2 Camada de GERAÇÃO — bypassed pela skill (CONGELAR como fallback)
- `POST /content/generate`, `/content/write-section`, `/content/section/fix`,
  `/content/rewrite-selection`, `/content/optimize-seo`, `/content/outline*`.
- `POST /ideation/generate`.
- ~5.800 LOC: `pipeline/write.ts`, `pipeline/plan.ts`, `ideation.service.ts`,
  orchestrator, research, optimize, critique, autofix.
- **Decisão travada:** não deletar agora. Fica intacto como fallback; deixa de
  ser o caminho principal.

### 4.3 O que a skill lê (source of truth, em runtime)
- `config/style_guide.yaml` — voz, regras de não-fabricação, gramática de
  placeholders (`{{item:}}`/`{{passive:}}`/`{{price:}}`/`{{cta:}}`), banned
  phrases, mecânicas excluídas, mapa de awakened gems banidos.
- `config/templates/<tipo>.yaml` — seções com `instruction`, `rag_queries`,
  `query_type`, `max_tokens`.
- A skill **lê os YAML vivos** (não duplica) para não driftar do que o operador
  edita.

## 5. Reanálise do hub: inventário → manter / cortar / consolidar

Estado atual: 5 domínios (pós IA rework da session 01), ~76 rotas, sidebar
top-level de 6. A bagunça remanescente está concentrada no lado **conteúdo/SEO**
— e boa parte dela é UI para **dirigir o pipeline de geração**, que a skill
torna obsoleta.

### 5.1 MANTER — núcleo do negócio (não tocar)
- **Dashboard** — KPIs.
- **Farm**: `bots`, `sales`, `prices`, `simulations` (+ annual). Dados locais
  no Postgres do hub, é a operação real. Manter inteiro.
- **Config** essencial: `leagues`, `users`, `proxy`, `costs`.
- **Observability/Operations** — saúde dos crons do engine (vira mais útil
  ainda no modelo warehouse). Consolidar as duas em uma só (ver 5.3).

### 5.2 CONSOLIDAR — virar um domínio "Data" (o que o operador quer ver)
Hoje espalhado em `/seo/*` + `/admin/gsc` + `/admin/competitor-*` +
`/admin/domain-lists` + `/admin/auto-actions`. Proposta: **um domínio único de
views do warehouse**, porque é exatamente o "trackear YouTube/Reddit/
concorrentes + GSC" que o operador pediu:

| Novo (proposto) | Absorve hoje |
|---|---|
| Data › Keywords | `/seo/research`, `/seo/opportunities`, `/seo/keybert`, `/seo/posts-recommended` |
| Data › YouTube | `/seo/youtube` (+ CRUD de canais trackeados) |
| Data › Reddit | `/seo/reddit` |
| Data › Concorrentes | `/admin/competitor-gaps`, `/admin/competitor-pages`, `/admin/domain-lists`, `/admin/auto-actions` |
| Data › GSC | `/admin/gsc` |
| Data › Análise SERP | `/seo/analysis` |

Benefício: tudo que é "olhar o warehouse" fica em um lugar; `/admin` para de
acumular ferramentas de SEO soltas.

### 5.3 CONSOLIDAR — conteúdo/publicação
- **Blog + Guides** → um domínio "Content" com abas: publicar (Sanity) e ver
  guides gerados (output da skill via `/content/posts` → hub exibe).
- **Operations + Observability** → uma página `runtime` (cron health + disparo
  manual + logs).

### 5.4 CORTAR / ARQUIVAR — candidatos
Itens cuja razão de existir é **dirigir o LLM do engine** (a skill substitui).
Recomendação de cortar do caminho principal — mas validar uso real antes (ver
decisões abertas). **Farm e Hardware NÃO entram aqui — decisão do operador
(2026-06): ambos ficam no hub.**

| Item | Por quê | Recomendação |
|---|---|---|
| `/admin/benchmark` (+ Prisma Preset/Run/Evaluation) | Compara modelos do pipeline LLM — sem pipeline LLM, perde função | Arquivar com a geração |
| `/admin/config/engine` (tabs weights/routing/llm/budget/ideation) | Tuning do pipeline de geração | Arquivar; manter só `style` se a skill reusar |
| `/admin/config/feature-flags` | Flags do pipeline de geração | Arquivar com a geração |
| `/workspace/ideas` + briefing/outline/trace UI | Fluxo de geração via engine | Substituído pela skill |
| `/workspace/templates` | Editor dos YAML do engine | Manter leve OU editar YAML direto |
| `/workspace/people` | Rede/network, periférico | Validar uso; provável corte |
| `/workspace/qa` (+ ChatConversation) | Q&A via LLM do engine | Manter se útil; ou apontar pro Claude |

### 5.5 IA alvo do hub (proposta)
```
Dashboard
Farm        → Bots · Vendas · Preços · Simulações
Hardware    → Deals · Builder · Analytics (mantido — decisão do operador)
Data        → Keywords · YouTube · Reddit · Concorrentes · GSC · SERP
Content     → Publicar (Sanity) · Guides (output da skill) · Slang
Admin       → Runtime (crons+logs) · Tarefas · Config (leagues/users/proxy/costs)
```
Mais enxuto que hoje, alinhado ao modelo "ver dados + operar + publicar".
A UI de geração sai do caminho principal; Farm e Hardware ficam.

## 6. Plano faseado (proposto)

- **Fase 0 — este doc.** Reanálise + arquitetura alvo + decisões abertas.
- **Fase 1 — Skill (engine repo).** Confirmar contratos de `/knowledge/query` e
  `POST /content/posts`; construir `poe-post/` (SKILL.md + references +
  `scripts/engine.mjs`); validar gerando 1 post real end-to-end.
- **Fase 2 — Dados.** Ativar GSC; CRUD de canais YouTube no hub; confirmar que
  os crons do warehouse estão verdes.
- **Fase 3 — Hub: consolidar.** Criar domínio **Data**; fundir Blog+Guides em
  **Content**; fundir Operations+Observability em **Runtime**.
- **Fase 4 — Hub: cortar.** Arquivar UI de geração (benchmark, engine-config
  tabs, feature-flags, ideas/briefing/trace) atrás de uma flag, e remover
  `/hardware` do core. Código da geração no engine fica como fallback.
- **Fase 5 — Limpeza.** Atualizar sidebar, CLAUDE.md, PRD, métricas.

## 7. Decisões abertas (precisam do operador)

1. ~~**Farm/negócio continua no hub?**~~ **RESOLVIDO (2026-06): sim, continua.**
2. ~~**Hardware:** cortar, isolar ou integrar?~~ **RESOLVIDO (2026-06): mantido
   no hub.**
3. **UI de geração (benchmark / engine-config / feature-flags / ideas / trace):**
   arquivar já na Fase 4, ou manter visível enquanto a geração do engine for
   fallback? (Recomendo arquivar atrás de flag — não deletar.)
4. **`/workspace/qa` e `/workspace/people`:** algum desses tem uso real, ou
   podem sair? (Não consigo inferir do código — preciso da sua chamada.)
5. **Skill faz ideação de verdade** (puxando `/seo/*` para descobrir temas) ou
   o operador sempre dá o tema e a skill só pesquisa+escreve? (Afeta o passo 1
   da skill.)
```
