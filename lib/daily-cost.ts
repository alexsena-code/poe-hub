/**
 * Decomposição do custo operacional diário a partir de uma GlobalCostConfig.
 *
 * Extraído de `simulation-calculator.ts` quando a calculadora rápida de profit
 * passou a precisar da mesma conta. Os dois caminhos têm que concordar: se a
 * simulação e a calculadora divergirem no custo, o operador não sabe em qual
 * acreditar.
 *
 * Só custo **recorrente** mora aqui. `levelingCostPerBot` e
 * `stashPackCostPerBot` são cobranças únicas por bot, não diárias — quem
 * precisa delas soma à parte.
 */

/** Custo avulso configurado pelo operador. */
export interface CustomCostEntry {
  id: string;
  name: string;
  amount: number;
  cadence: "daily" | "monthly" | "one_time";
  perBot: boolean;
}

/** Campos numéricos chegam como Decimal do Prisma ou number, conforme a origem. */
export interface CostConfigData {
  proxyCostPerBotMonthly: number | { toNumber(): number };
  levelingCostPerBot: number | { toNumber(): number };
  stashPackCostPerBot?: number | { toNumber(): number };
  expluginsKeyCostDaily: number | { toNumber(): number };
  dpbKeyCostDaily: number | { toNumber(): number };
  customCosts?: CustomCostEntry[] | null;
}

export interface DailyCostComponents {
  expluginsPerBotDaily: number;
  dpbPerBotDaily: number;
  proxyPerBotDaily: number;
  customPerBotDaily: number;
  /** Custos que não escalam com o número de bots (assinatura fixa, VPS, etc). */
  customGlobalDaily: number;
}

/** Mês comercial de 30 dias — mesma convenção do simulation-calculator. */
const DAYS_PER_MONTH = 30;

/**
 * Converte Decimal do Prisma (ou number) em number.
 *
 * Chama `toNumber()` de verdade em vez de `Number(val)`: o segundo só funciona
 * com o Decimal por acidente, via `toString()`, e devolve NaN para qualquer
 * outro objeto que satisfaça o tipo declarado.
 */
export function toNumber(val: number | { toNumber(): number }): number {
  if (typeof val === "number") return val;
  if (typeof val?.toNumber === "function") return val.toNumber();
  return Number(val);
}

/**
 * Separa a config nos componentes que compõem um dia de operação.
 *
 * Custos `one_time` são ignorados de propósito: não têm expressão diária.
 */
export function decomposeDailyCost(config: CostConfigData): DailyCostComponents {
  let customPerBotDaily = 0;
  let customGlobalDaily = 0;

  for (const cost of config.customCosts ?? []) {
    if (cost.cadence === "one_time") continue;
    const daily = cost.cadence === "monthly" ? cost.amount / DAYS_PER_MONTH : cost.amount;
    if (cost.perBot) customPerBotDaily += daily;
    else customGlobalDaily += daily;
  }

  return {
    expluginsPerBotDaily: toNumber(config.expluginsKeyCostDaily),
    dpbPerBotDaily: toNumber(config.dpbKeyCostDaily),
    proxyPerBotDaily: toNumber(config.proxyCostPerBotMonthly) / DAYS_PER_MONTH,
    customPerBotDaily,
    customGlobalDaily,
  };
}

/**
 * Custo de um dia com `activeBots` bots ligados.
 *
 * `expluginsOverride` existe para a simulação, que aplica um desconto
 * progressivo na chave do ExPlugins a partir de certo dia.
 *
 * @example
 * const parts = decomposeDailyCost(config);
 * dailyCostFor(parts, 10); // custo de um dia com 10 bots
 */
export function dailyCostFor(
  parts: DailyCostComponents,
  activeBots: number,
  expluginsOverride?: number,
): number {
  if (activeBots < 0) {
    throw new Error(`bad activeBots: ${activeBots} (expected >= 0)`);
  }
  const explugins = expluginsOverride ?? parts.expluginsPerBotDaily;
  const perBot =
    explugins + parts.dpbPerBotDaily + parts.proxyPerBotDaily + parts.customPerBotDaily;
  return activeBots * perBot + parts.customGlobalDaily;
}
