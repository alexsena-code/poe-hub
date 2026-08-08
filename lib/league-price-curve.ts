/**
 * Curva típica de queda do preço do Divine ao longo de uma liga.
 *
 * Deriva de `daily_prices` — a série do scraper do Discord, congelada em
 * ago/2026 mas ainda o único registro de ligas inteiras que temos. A moeda ali
 * é BRL e não importa: tudo aqui é **razão**, então a unidade se cancela.
 *
 * Por que normalizar antes de agregar: cada liga tem um patamar de preço
 * próprio (numa amostra real o dia 7 variou de R$ 1,10 a R$ 5,50). Uma média
 * dos preços absolutos mediria a diferença entre ligas, não o formato da queda.
 * Depois de dividir cada liga pelo seu próprio dia de referência, as curvas
 * ficam notavelmente parecidas — em PoE1 o dia 14 caiu para 0,34–0,38 do dia 7
 * em três ligas independentes.
 */

/** Série de uma liga, já normalizada em dia-de-liga (dia 1 = lançamento). */
export interface LeagueSeries {
  league: string;
  points: { dayOfLeague: number; price: number }[];
}

export interface DecayCurve {
  /** dayOfLeague -> preço relativo ao dia de referência. */
  factors: Map<number, number>;
  referenceDay: number;
  /** Ligas que tinham cobertura suficiente e entraram na mediana. */
  leaguesUsed: string[];
  maxDay: number;
}

/**
 * Dia usado como denominador. 7 e não 1 de propósito: a primeira semana é
 * caótica (o próprio scraper antigo descartava o dia de lançamento) e várias
 * séries só começam no dia 2.
 */
export const DEFAULT_REFERENCE_DAY = 7;

/** Tolerância ao procurar o dia de referência numa série com buracos. */
const REFERENCE_TOLERANCE_DAYS = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Preço no dia pedido, ou no dia válido mais próximo dentro da tolerância. */
function priceNearDay(
  points: { dayOfLeague: number; price: number }[],
  day: number,
  tolerance: number,
): number | null {
  let best: { distance: number; price: number } | null = null;
  for (const point of points) {
    if (point.price <= 0) continue;
    const distance = Math.abs(point.dayOfLeague - day);
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { distance, price: point.price };
  }
  return best?.price ?? null;
}

/**
 * Constrói a curva mediana a partir das séries de várias ligas.
 *
 * Devolve `null` quando nenhuma liga tem cobertura no dia de referência — sem
 * denominador comum não há como comparar formatos, e inventar um produziria uma
 * curva que mistura escalas.
 */
export function buildDecayCurve(
  series: LeagueSeries[],
  referenceDay: number = DEFAULT_REFERENCE_DAY,
): DecayCurve | null {
  const perDay = new Map<number, number[]>();
  const leaguesUsed: string[] = [];

  for (const entry of series) {
    const base = priceNearDay(entry.points, referenceDay, REFERENCE_TOLERANCE_DAYS);
    if (base == null || base <= 0) continue;

    leaguesUsed.push(entry.league);
    for (const point of entry.points) {
      if (point.price <= 0) continue;
      const bucket = perDay.get(point.dayOfLeague) ?? [];
      bucket.push(point.price / base);
      perDay.set(point.dayOfLeague, bucket);
    }
  }

  if (leaguesUsed.length === 0) return null;

  const rawByDay = new Map<number, number>();
  let maxDay = 0;
  perDay.forEach((ratios, day) => {
    rawByDay.set(day, median(ratios));
    if (day > maxDay) maxDay = day;
  });

  return {
    factors: enforceNonIncreasing(rawByDay),
    referenceDay,
    leaguesUsed,
    maxDay,
  };
}

/**
 * Achata a curva num mínimo corrente, para que ela nunca suba.
 *
 * O preço de currency numa liga não se recupera: o supply só cresce. Qualquer
 * subida na série agregada é ruído, e na cauda o histórico do scraper do
 * Discord tem bastante — em `daily_prices` (verificado 08/08/2026) "Keepers of
 * the Flame" tem fator 7,5 no dia 92 e "Mercenaries" 1,75 no dia 85, contra
 * ~0,09 nos dias vizinhos. Como poucas ligas cobrem a cauda, a mediana de dois
 * valores não filtra nada e um único ponto sujo levantava a curva inteira,
 * fazendo a projeção prever preço SUBINDO.
 *
 * Tomar o mínimo corrente é conservador na direção certa: no pior caso
 * subestima uma recuperação real (que é rara e pequena), em vez de projetar
 * receita que não existe.
 */
function enforceNonIncreasing(rawByDay: Map<number, number>): Map<number, number> {
  const days = Array.from(rawByDay.keys()).sort((a, b) => a - b);
  const smoothed = new Map<number, number>();

  let runningMin = Infinity;
  for (const day of days) {
    const value = rawByDay.get(day)!;
    if (value < runningMin) runningMin = value;
    smoothed.set(day, runningMin);
  }
  return smoothed;
}

/** Ponto da curva em formato serializável — `Map` não sobrevive a JSON. */
export interface CurvePoint {
  dayOfLeague: number;
  factor: number;
}

export function curveToPoints(curve: DecayCurve): CurvePoint[] {
  const points: CurvePoint[] = [];
  curve.factors.forEach((factor, dayOfLeague) => points.push({ dayOfLeague, factor }));
  return points.sort((a, b) => a.dayOfLeague - b.dayOfLeague);
}

/** Reconstrói a curva do lado do cliente, a partir do que a rota serializou. */
export function curveFromPoints(
  points: CurvePoint[],
  referenceDay: number,
  leaguesUsed: string[] = [],
): DecayCurve | null {
  if (points.length === 0) return null;
  const factors = new Map<number, number>();
  let maxDay = 0;
  for (const point of points) {
    factors.set(point.dayOfLeague, point.factor);
    if (point.dayOfLeague > maxDay) maxDay = point.dayOfLeague;
  }
  return { factors, referenceDay, leaguesUsed, maxDay };
}

/**
 * Fator da curva num dia, interpolando linearmente entre os vizinhos.
 *
 * Além do último dia conhecido a curva não extrapola: repete o último fator.
 * Preferimos subestimar a queda a inventar um decaimento que os dados não
 * sustentam — no fim da liga o preço já está achatado mesmo.
 */
export function curveFactorAt(curve: DecayCurve, day: number): number | null {
  const exact = curve.factors.get(day);
  if (exact !== undefined) return exact;

  let before: { day: number; factor: number } | null = null;
  let after: { day: number; factor: number } | null = null;
  curve.factors.forEach((factor, d) => {
    if (d < day && (!before || d > before.day)) before = { day: d, factor };
    if (d > day && (!after || d < after.day)) after = { day: d, factor };
  });

  // O TS não estreita variáveis capturadas por closure; reatribuir resolve.
  const lo = before as { day: number; factor: number } | null;
  const hi = after as { day: number; factor: number } | null;

  if (lo && hi) {
    const span = hi.day - lo.day;
    const progress = (day - lo.day) / span;
    return lo.factor + (hi.factor - lo.factor) * progress;
  }
  if (lo) return lo.factor;
  if (hi) return hi.factor;
  return null;
}

/**
 * Projeta o preço de `targetDay` a partir de um preço observado em `fromDay`.
 *
 * Usa só a razão entre os dois pontos da curva, então o dia de referência
 * escolhido na construção se cancela e não influencia o resultado.
 *
 * @example
 * // curva com dia 16 = 0,50 e dia 20 = 0,40; preço hoje US$ 0,06 no dia 16
 * projectPrice(curve, 0.06, 16, 20); // 0.048
 */
export function projectPrice(
  curve: DecayCurve,
  basePrice: number,
  fromDay: number,
  targetDay: number,
): number | null {
  if (basePrice <= 0) {
    throw new Error(`bad basePrice: ${basePrice} (expected > 0)`);
  }
  const fromFactor = curveFactorAt(curve, fromDay);
  const targetFactor = curveFactorAt(curve, targetDay);
  if (fromFactor == null || targetFactor == null || fromFactor <= 0) return null;

  return basePrice * (targetFactor / fromFactor);
}
