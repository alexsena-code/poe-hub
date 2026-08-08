/**
 * Client da API de busca do G2G — preço da concorrência em USD.
 *
 * Endpoint público, SEM autenticação (verificado ao vivo em 08/08/2026):
 *
 *   https://sls.g2g.com/offer/search?seo_term=poe-currency&country=US&currency=USD
 *
 * Três parâmetros ditam o desenho e nenhum está documentado — foram descobertos
 * por tentativa:
 *
 *   - `country` é OBRIGATÓRIO. Sem ele a API responde `4001 Missing mandatory
 *     parameter`.
 *   - `group=0` abre os grupos. Por padrão a resposta vem agrupada
 *     (`is_group_display: true`) e cada linha é só a oferta mais barata do
 *     grupo, o que descarta a amostra inteira que interessa para a mediana.
 *   - `q=<item>` filtra por item. Sem ele, `sort=lowest_price` nunca alcança o
 *     Divine: as 100 primeiras linhas são Chaos Orb e Lifeforce, que valem
 *     ordens de grandeza menos.
 *
 * O item e a liga não vêm em campo próprio — `offer_attributes` usa IDs opacos
 * (`lgc_19398_tier_47227`). A única fonte legível é o `title`, no formato
 * `[PC] Allflame Standard > Divine Orb`, que é o que parseamos.
 */

import type { G2gOffer } from "./g2g-stats";

const G2G_SEARCH_URL = "https://sls.g2g.com/offer/search";

/** O G2G exige um UA de navegador; com o default do fetch a resposta varia. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

/** Trava de segurança: 2 páginas cobriam todo o Divine em 08/08/2026. */
const MAX_PAGES = 5;

type G2gRawOffer = {
  title?: string;
  converted_unit_price?: number;
  unit_price_in_usd?: number;
  available_qty?: number;
  min_qty?: number;
  username?: string;
  satisfaction_rate?: number;
};

export type G2gTitleParts = {
  platform: string;
  league: string;
  item: string;
};

export type FetchG2gOffersOptions = {
  /** Nome da liga no hub, ex. "Allflame". Vira "Allflame Standard" no G2G. */
  league: string;
  item?: string;
  platform?: string;
  hardcore?: boolean;
  /** Injetável para teste — o repo evita mockar rede por import global. */
  fetchImpl?: typeof fetch;
};

export type G2gOffersResult = {
  offers: G2gOffer[];
  /** Rótulo da liga como o G2G escreve, ex. "Allflame Standard". */
  g2gLeague: string;
  platform: string;
  item: string;
  /** Linhas devolvidas pela API antes do filtro de liga/item/plataforma. */
  rawResultCount: number;
  pagesFetched: number;
};

/**
 * Converte o nome da liga do hub no rótulo do G2G.
 *
 * O G2G sufixa a dificuldade no nome: a liga temporária softcore vira
 * "Allflame Standard" — "Standard" ali é dificuldade, NÃO a liga permanente.
 * A permanente é "Standard"/"Hardcore" sem prefixo.
 */
export function toG2gLeagueLabel(league: string, hardcore = false): string {
  const difficulty = hardcore ? "Hardcore" : "Standard";
  const permanent = league === "Standard" || league === "Hardcore";
  return permanent ? difficulty : `${league} ${difficulty}`;
}

/** Extrai plataforma/liga/item de `[PC] Allflame Standard > Divine Orb`. */
export function parseG2gTitle(title: string): G2gTitleParts | null {
  const match = /^\[([^\]]+)\]\s*(.*?)\s*>\s*(.*)$/.exec(title);
  if (!match) return null;
  return { platform: match[1].trim(), league: match[2].trim(), item: match[3].trim() };
}

function buildSearchUrl(item: string, page: number): string {
  const params = new URLSearchParams({
    seo_term: "poe-currency",
    country: "US",
    currency: "USD",
    page_size: String(PAGE_SIZE),
    sort: "lowest_price",
    group: "0",
    q: item,
    page: String(page),
  });
  return `${G2G_SEARCH_URL}?${params.toString()}`;
}

async function fetchPage(
  item: string,
  page: number,
  fetchImpl: typeof fetch,
): Promise<G2gRawOffer[]> {
  const res = await fetchImpl(buildSearchUrl(item, page), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`G2G respondeu HTTP ${res.status} na página ${page} (esperado 200)`);
  }

  const payload = (await res.json()) as { payload?: { results?: G2gRawOffer[] } };
  return payload.payload?.results ?? [];
}

function toOffer(raw: G2gRawOffer): G2gOffer | null {
  const priceUsd = raw.converted_unit_price ?? raw.unit_price_in_usd;
  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    priceUsd,
    availableQty: raw.available_qty ?? 0,
    minQty: raw.min_qty ?? 0,
    sellerName: raw.username ?? "desconhecido",
    satisfactionRate: raw.satisfaction_rate ?? 0,
  };
}

/**
 * Busca todas as ofertas de um item numa liga/plataforma, paginando até o fim.
 *
 * O filtro é feito no cliente porque a API não aceita filtro por liga: uma
 * mesma consulta devolve PC, PS4 e Xbox e todas as ligas misturadas.
 *
 * @example
 * const { offers } = await fetchG2gOffers({ league: "Allflame" });
 * const stats = summarizeOffers(offers);
 */
export async function fetchG2gOffers(
  options: FetchG2gOffersOptions,
): Promise<G2gOffersResult> {
  const {
    league,
    item = "Divine Orb",
    platform = "PC",
    hardcore = false,
    fetchImpl = fetch,
  } = options;

  const g2gLeague = toG2gLeagueLabel(league, hardcore);
  const offers: G2gOffer[] = [];
  let rawResultCount = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const results = await fetchPage(item, page, fetchImpl);
    pagesFetched = page;
    rawResultCount += results.length;

    for (const raw of results) {
      const parts = raw.title ? parseG2gTitle(raw.title) : null;
      if (!parts) continue;
      if (parts.platform !== platform) continue;
      if (parts.league !== g2gLeague) continue;
      if (parts.item.toLowerCase() !== item.toLowerCase()) continue;

      const offer = toOffer(raw);
      if (offer) offers.push(offer);
    }

    // Página incompleta significa que era a última — não há cursor na resposta.
    if (results.length < PAGE_SIZE) break;
  }

  return { offers, g2gLeague, platform, item, rawResultCount, pagesFetched };
}
