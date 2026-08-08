/**
 * Projeção rápida de receita, custo e lucro por dia.
 *
 * Versão enxuta do que `/farm/simulations` faz em detalhe: aqui não há
 * override por dia nem coorte de bots, só "essa taxa de farm, esse preço, essa
 * curva de queda — quanto sai por dia".
 *
 * A semântica de produção é a mesma do simulation-calculator
 * (`bots × divines/hora × horas`), de propósito: as duas telas precisam
 * concordar, senão o operador não sabe em qual acreditar.
 */

import { dailyCostFor, type DailyCostComponents } from "./daily-cost";
import { curveFactorAt, type DecayCurve } from "./league-price-curve";

export interface ProfitForecastInput {
  /** Preço do Divine hoje, em USD, já com o ajuste do operador aplicado. */
  basePriceUsd: number;
  /** Dia da liga correspondente a `basePriceUsd`. */
  currentDayOfLeague: number;
  /** Horizonte da projeção, em dias, contando hoje. */
  days: number;
  divinesPerHour: number;
  hoursPerDay: number;
  activeBots: number;
  /** Ausente = projeção sem custo, só receita bruta. */
  costParts?: DailyCostComponents | null;
  /** Ausente = preço constante (sem queda projetada). */
  curve?: DecayCurve | null;
}

export interface ProfitForecastDay {
  /** 0 = hoje. */
  dayOffset: number;
  dayOfLeague: number;
  priceUsd: number;
  divines: number;
  revenueUsd: number;
  costUsd: number;
  profitUsd: number;
  /** false quando a curva não cobria o dia e o preço foi mantido. */
  priceFromCurve: boolean;
}

export interface ProfitForecast {
  days: ProfitForecastDay[];
  totals: {
    divines: number;
    revenueUsd: number;
    costUsd: number;
    profitUsd: number;
  };
  /** Lucro do primeiro dia — o número que o operador olha primeiro. */
  todayProfitUsd: number;
  /** Dia (offset) em que o lucro passa a ser negativo; null se nunca. */
  breakEvenDayOffset: number | null;
}

const MAX_HORIZON_DAYS = 365;

function validate(input: ProfitForecastInput): void {
  const { basePriceUsd, days, divinesPerHour, hoursPerDay, activeBots } = input;
  if (basePriceUsd <= 0) {
    throw new Error(`bad basePriceUsd: ${basePriceUsd} (expected > 0)`);
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_HORIZON_DAYS) {
    throw new Error(`bad days: ${days} (expected integer in [1, ${MAX_HORIZON_DAYS}])`);
  }
  if (divinesPerHour < 0) {
    throw new Error(`bad divinesPerHour: ${divinesPerHour} (expected >= 0)`);
  }
  if (hoursPerDay < 0 || hoursPerDay > 24) {
    throw new Error(`bad hoursPerDay: ${hoursPerDay} (expected in [0, 24])`);
  }
  if (!Number.isInteger(activeBots) || activeBots < 0) {
    throw new Error(`bad activeBots: ${activeBots} (expected integer >= 0)`);
  }
}

/**
 * Preço projetado para um dia, relativo ao preço base de hoje.
 *
 * Sem curva, ou quando ela não alcança o dia pedido, devolve o preço base — é
 * mais honesto manter o preço do que extrapolar uma queda que os dados não
 * sustentam. O flag `fromCurve` avisa a UI para sinalizar isso.
 */
function priceForDay(
  input: ProfitForecastInput,
  dayOfLeague: number,
): { price: number; fromCurve: boolean } {
  const { curve, basePriceUsd, currentDayOfLeague } = input;
  if (!curve) return { price: basePriceUsd, fromCurve: false };

  const from = curveFactorAt(curve, currentDayOfLeague);
  const target = curveFactorAt(curve, dayOfLeague);
  if (from == null || target == null || from <= 0) {
    return { price: basePriceUsd, fromCurve: false };
  }

  return { price: basePriceUsd * (target / from), fromCurve: true };
}

/**
 * Projeta a operação dia a dia.
 *
 * @example
 * const forecast = buildProfitForecast({
 *   basePriceUsd: 0.06, currentDayOfLeague: 16, days: 7,
 *   divinesPerHour: 2, hoursPerDay: 8, activeBots: 10,
 * });
 * forecast.todayProfitUsd; // 9.6
 */
export function buildProfitForecast(input: ProfitForecastInput): ProfitForecast {
  validate(input);

  const { days, divinesPerHour, hoursPerDay, activeBots, costParts, currentDayOfLeague } =
    input;

  const divinesPerDay = activeBots * divinesPerHour * hoursPerDay;
  const costPerDay = costParts ? dailyCostFor(costParts, activeBots) : 0;

  const rows: ProfitForecastDay[] = [];
  let breakEvenDayOffset: number | null = null;

  for (let offset = 0; offset < days; offset += 1) {
    const dayOfLeague = currentDayOfLeague + offset;
    const { price, fromCurve } = priceForDay(input, dayOfLeague);
    const revenueUsd = divinesPerDay * price;
    const profitUsd = revenueUsd - costPerDay;

    if (breakEvenDayOffset === null && profitUsd < 0) breakEvenDayOffset = offset;

    rows.push({
      dayOffset: offset,
      dayOfLeague,
      priceUsd: price,
      divines: divinesPerDay,
      revenueUsd,
      costUsd: costPerDay,
      profitUsd,
      priceFromCurve: fromCurve,
    });
  }

  const totals = rows.reduce(
    (acc, row) => ({
      divines: acc.divines + row.divines,
      revenueUsd: acc.revenueUsd + row.revenueUsd,
      costUsd: acc.costUsd + row.costUsd,
      profitUsd: acc.profitUsd + row.profitUsd,
    }),
    { divines: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0 },
  );

  return {
    days: rows,
    totals,
    todayProfitUsd: rows[0].profitUsd,
    breakEvenDayOffset,
  };
}
