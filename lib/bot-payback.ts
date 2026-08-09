/**
 * Em quanto tempo um bot paga o próprio setup.
 *
 * A pergunta operacional é "vale a pena subir mais uma conta hoje?", então a
 * conta é feita **por bot** e à taxa de hoje: o custo único (leveling, stash,
 * customs únicos) dividido pelo lucro que um bot deixa por dia.
 *
 * Custos globais (VPS, assinatura rateada) não entram — são da operação, não
 * da conta nova. Incluí-los faria o payback do bot piorar quando você liga
 * outro bot, o que é o contrário da realidade.
 */

export interface BotPaybackInput {
  /** Custo único de pôr o bot de pé, em USD. */
  oneTimeUsd: number;
  /** Divines que UM bot produz por dia. */
  divinesPerDayPerBot: number;
  /** Preço de hoje, em USD por divine. */
  priceUsd: number;
  /** Custo recorrente diário de UM bot, sem as parcelas globais. */
  dailyCostPerBotUsd: number;
}

export interface BotPayback {
  revenuePerBotUsd: number;
  profitPerBotUsd: number;
  /** Dias até se pagar. null = não se paga: o bot não fecha o dia no positivo. */
  days: number | null;
}

/**
 * @example
 * computeBotPayback({
 *   oneTimeUsd: 50, divinesPerDayPerBot: 16, priceUsd: 0.042, dailyCostPerBotUsd: 2.2,
 * }); // { revenuePerBotUsd: 0.672, profitPerBotUsd: -1.528, days: null }
 */
export function computeBotPayback(input: BotPaybackInput): BotPayback {
  const { oneTimeUsd, divinesPerDayPerBot, priceUsd, dailyCostPerBotUsd } = input;

  if (oneTimeUsd < 0) {
    throw new Error(`bad oneTimeUsd: ${oneTimeUsd} (expected >= 0)`);
  }
  if (priceUsd < 0) {
    throw new Error(`bad priceUsd: ${priceUsd} (expected >= 0)`);
  }

  const revenuePerBotUsd = divinesPerDayPerBot * priceUsd;
  const profitPerBotUsd = revenuePerBotUsd - dailyCostPerBotUsd;

  // Setup zerado se paga na hora, mesmo com lucro no talo — não há o que pagar.
  if (oneTimeUsd === 0) return { revenuePerBotUsd, profitPerBotUsd, days: 0 };
  if (profitPerBotUsd <= 0) return { revenuePerBotUsd, profitPerBotUsd, days: null };

  return { revenuePerBotUsd, profitPerBotUsd, days: oneTimeUsd / profitPerBotUsd };
}
