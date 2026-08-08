# Coletor de preço da concorrência (G2G)

Lê o preço do Divine Orb no marketplace **G2G** e grava um snapshot em
`g2g_price_snapshots`. Substitui o scraper do Discord, removido em ago/2026.

```
G2G search API  →  filtro por liga/plataforma/item  →  filtro MAD  →  G2gPriceSnapshot
```

## Por que snapshots, e não um agregado diário

**A G2G não expõe histórico de preço.** Verificado em 08/08/2026: todos os
endpoints plausíveis (`price-history`, `price-trend`, `statistics`, `chart`)
devolvem 404, e os 403 são o API Gateway da AWS respondendo rota inexistente —
um path inventado dá o mesmo 403. A página pública também não tem gráfico
nenhum (zero ocorrências de `chart`; `history` só aparece em "order history" do
vendedor).

Consequência prática: **cada coleta perdida é um buraco permanente na série.**
Não há como recuperar o passado depois. O histórico é um ativo que só existe
porque o cron roda.

## Uso

```bash
npx tsx scripts/g2g-price-collector/index.ts              # coleta e grava
npx tsx scripts/g2g-price-collector/index.ts --dry-run    # calcula, não grava
npx tsx scripts/g2g-price-collector/index.ts --league Allflame
npx tsx scripts/g2g-price-collector/index.ts --item "Chaos Orb"
npx tsx scripts/g2g-price-collector/index.ts --hardcore
```

Sem `--league`, resolve a liga PoE1 marcada como `isCurrent` no banco.

A única variável necessária é `DATABASE_URL` — **a API do G2G é pública e sem
autenticação**.

## Cron (produção)

**Scheduled Task do Coolify**, não container próprio. O hub roda no Coolify
(`hub.pathoftrade.net`), então o agendador natural é o da própria aplicação —
um container só para duas chamadas HTTP a cada 30 min seria ~500 MB parados.

| Campo | Valor |
|---|---|
| Nome | `g2g-price-collect` |
| Frequência | `*/30 * * * *` |
| Timeout | 120 s |

A task roda **dentro** do container do app e não tem cookie de sessão, então
chama a rota com `Authorization: Bearer $CRON_SECRET`:

```sh
node -e "fetch('http://127.0.0.1:3000/api/prices/g2g',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text().then(t=>{console.log(r.status,t.slice(0,200));process.exit(r.ok?0:1)}))"
```

`node -e` em vez de curl porque a imagem de produção é Alpine slim e **não tem
curl** — só `wget` do busybox e o `fetch` nativo do Node 20. Sem `Content-Type`
nem body porque a rota trata corpo ausente (`request.json().catch(() => ({}))`),
e o comando precisa caber nos 255 caracteres da coluna `command` do Coolify.

O `CRON_SECRET` é uma env var da aplicação no Coolify. **Sem ela no ambiente o
caminho do cron fica desligado** — um secret vazio nunca autentica. Env var nova
só entra no container após **redeploy**.

Também dá para disparar pela UI em `/farm/prices` ("Coletar agora"), que usa a
mesma rota — por sessão, sem o secret.

## A API do G2G

```
https://sls.g2g.com/offer/search?seo_term=poe-currency&country=US&currency=USD
  &page_size=100&sort=lowest_price&group=0&q=Divine%20Orb&page=1
```

Nada disso é documentado; foi tudo descoberto por tentativa:

| Parâmetro | Por que importa |
|---|---|
| `country` | **Obrigatório.** Sem ele: `4001 Missing mandatory parameter`. |
| `group=0` | Abre os grupos. No default (`is_group_display: true`) cada linha é só a oferta mais barata do grupo — some a amostra que a mediana precisa. |
| `q=<item>` | Filtra por item. Sem ele, `sort=lowest_price` nunca alcança o Divine: as 100 primeiras linhas são Chaos Orb e Lifeforce. |
| `seo_term` | `poe-currency` funciona; `path-of-exile-currency` dá 404. |

Liga e item **não** têm campo próprio: `offer_attributes` usa IDs opacos
(`lgc_19398_tier_47227`). A única fonte legível é o `title`, no formato
`[PC] Allflame Standard > Divine Orb`. Atenção ao sufixo: no G2G "Standard" ali
é **dificuldade**, não a liga permanente — a liga temporária softcore aparece
como "Allflame Standard".

Uma consulta devolve PC, PS4 e Xbox e todas as ligas misturadas, então o filtro
é feito no cliente.

## O filtro de outliers

Usa **MAD** (median absolute deviation) com `k = 4`, não o IQR clássico.

A distribuição do G2G é muito assimétrica à direita. Numa amostra real de 80
ofertas de Divine (08/08/2026) havia listagens de US$ 1, US$ 2,20, US$ 10,05,
US$ 22 e **US$ 999,99** contra uma mediana de US$ 0,06. A cerca `q3 + 1.5*IQR`
caiu em US$ 0,394 — quase 7x a mediana — e ainda deixava lixo passar. Com MAD
k=4 o corte fica em US$ 0,165 e sobram 58 das 80.

A mediana ficou estável (US$ 0,0595 – US$ 0,0600) para k entre 3 e 6, o que é
o sinal de que a estimativa é robusta à escolha do parâmetro.

Cuidado ao ler o **piso**: as ofertas mais baratas costumam ter
`min_qty == available_qty`, ou seja, só vendem o lote inteiro. Por isso o
snapshot guarda `p25` além do `min` — e uma amostra das 10 mais baratas em
`cheapest_sample`, para auditar uma mediana suspeita.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.ts` | CLI / entrypoint do cron |
| `lib/g2g-client.ts` | Chamada HTTP, paginação e parse do título |
| `lib/g2g-stats.ts` | Estatística pura (mediana, quartis, filtro MAD) |
| `lib/g2g-collector.ts` | Orquestra e persiste; compartilhado com a rota HTTP |

Não há `cron-runner.ts` separado. O scraper do Discord precisava de um porque
isolava um binário externo que travava; aqui o processo é uma chamada HTTP e
termina sozinho.
