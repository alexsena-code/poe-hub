/**
 * Estatística robusta sobre as ofertas cruas do G2G.
 *
 * Separado do client de rede de propósito: aqui não há I/O, então a calibragem
 * do filtro de outliers é testável contra fixtures reais.
 *
 * Por que MAD e não IQR: a distribuição de preços do G2G é muito assimétrica à
 * direita. Numa amostra de 80 ofertas de Divine (08/08/2026) a cerca clássica
 * `q3 + 1.5*IQR` caiu em US$ 0,394 — quase 7x a mediana — e ainda deixava passar
 * listagens de US$ 0,39. O MAD ignora a cauda por construção: com k=4 a mesma
 * amostra corta em US$ 0,165 e descarta as listagens de US$ 1, US$ 22 e
 * US$ 999,99 que existem de verdade na página 2 do resultado.
 */

/** Oferta já normalizada pelo client — o mínimo que a estatística precisa. */
export type G2gOffer = {
  priceUsd: number;
  availableQty: number;
  minQty: number;
  sellerName: string;
  satisfactionRate: number;
};

export type G2gPriceStats = {
  median: number;
  mean: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  /** Ofertas que sobreviveram ao filtro de outliers. */
  offerCount: number;
  /** Ofertas antes do filtro — a razão entre os dois indica quão sujo veio. */
  rawOfferCount: number;
};

/** Múltiplo de desvios (escala MAD) além do qual a oferta é considerada ruído. */
export const DEFAULT_MAD_K = 4;

/** Constante que põe o MAD na mesma escala de um desvio-padrão normal. */
const MAD_TO_SIGMA = 1.4826;

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median: lista vazia (esperado >= 1 valor)");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Percentil por índice truncado — barato e suficiente para amostras desse porte. */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) throw new Error("percentile: lista vazia (esperado >= 1 valor)");
  if (fraction < 0 || fraction > 1) {
    throw new Error(`percentile: fraction inválida: ${fraction} (esperado entre 0 e 1)`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

/**
 * Descarta ofertas cujo preço se afasta demais da mediana em escala MAD.
 *
 * Quando o MAD é zero (todas as ofertas no mesmo preço) não há dispersão para
 * medir e a amostra passa inteira — filtrar aí só removeria dados válidos.
 */
export function rejectOutliers(offers: G2gOffer[], k = DEFAULT_MAD_K): G2gOffer[] {
  if (offers.length < 4) return offers;

  const prices = offers.map((o) => o.priceUsd);
  const center = median(prices);
  const mad = median(prices.map((p) => Math.abs(p - center)));
  if (mad === 0) return offers;

  const spread = k * MAD_TO_SIGMA * mad;
  return offers.filter((o) => Math.abs(o.priceUsd - center) <= spread);
}

/**
 * Resume as ofertas em um snapshot de preço.
 *
 * Devolve `null` para amostra vazia em vez de lançar: coleta sem resultado é um
 * estado operacional normal (liga errada, item sem oferta), não uma exceção.
 */
export function summarizeOffers(offers: G2gOffer[], k = DEFAULT_MAD_K): G2gPriceStats | null {
  if (offers.length === 0) return null;

  const kept = rejectOutliers(offers, k);
  const prices = kept.map((o) => o.priceUsd).sort((a, b) => a - b);
  const sum = prices.reduce((acc, p) => acc + p, 0);

  return {
    median: median(prices),
    mean: sum / prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    p25: percentile(prices, 0.25),
    p75: percentile(prices, 0.75),
    offerCount: prices.length,
    rawOfferCount: offers.length,
  };
}
