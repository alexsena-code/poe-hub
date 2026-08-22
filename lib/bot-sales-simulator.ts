export type BotSalesBillingMode = "active_day" | "runtime_24h";

export interface BotSalesSimulationInput {
  horizonDays: number;
  salesStartDay: number;
  salesEndDay: number;
  newCustomersPerDay: number;
  startingCustomers: number;
  botsPerCustomer: number;
  dailyPriceUsd: number;
  billingMode: BotSalesBillingMode;
  earlyHoursPerDay: number;
  lateHoursPerDay: number;
  hoursChangeDay: number;
  utilizationPercent: number;
  paymentFeePercent: number;
  refundPercent: number;
  supportCostPerCustomerDayUsd: number;
  fixedCostUsd: number;
  launchCostUsd: number;
}

export interface BotSalesSimulationDay {
  day: number;
  customers: number;
  activeBots: number;
  runtimeHours: number;
  billableBotDays: number;
  grossRevenueUsd: number;
  netRevenueUsd: number;
  cumulativeProfitUsd: number;
}

export interface BotSalesSimulation {
  days: BotSalesSimulationDay[];
  finalCustomers: number;
  finalActiveBots: number;
  billableBotDays: number;
  grossRevenueUsd: number;
  paymentFeesUsd: number;
  refundsUsd: number;
  supportCostUsd: number;
  totalCostUsd: number;
  profitUsd: number;
  marginPercent: number;
  breakEvenDay: number | null;
  revenuePerCustomerUsd: number;
}

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`bad ${name}: ${value} (expected in [${min}, ${max}])`);
  }
}

function validate(input: BotSalesSimulationInput): void {
  assertRange("horizonDays", input.horizonDays, 1, 365);
  assertRange("salesStartDay", input.salesStartDay, 1, input.horizonDays);
  assertRange("salesEndDay", input.salesEndDay, input.salesStartDay, input.horizonDays);
  assertRange("hoursChangeDay", input.hoursChangeDay, 1, input.horizonDays);
  assertRange("earlyHoursPerDay", input.earlyHoursPerDay, 0, 24);
  assertRange("lateHoursPerDay", input.lateHoursPerDay, 0, 24);
  assertRange("utilizationPercent", input.utilizationPercent, 0, 100);
  assertRange("paymentFeePercent", input.paymentFeePercent, 0, 100);
  assertRange("refundPercent", input.refundPercent, 0, 100);
  assertRange("newCustomersPerDay", input.newCustomersPerDay, 0, 100_000);
  assertRange("startingCustomers", input.startingCustomers, 0, 1_000_000);
  assertRange("botsPerCustomer", input.botsPerCustomer, 0, 100_000);
  assertRange("dailyPriceUsd", input.dailyPriceUsd, 0, 100_000);
  assertRange("supportCostPerCustomerDayUsd", input.supportCostPerCustomerDayUsd, 0, 100_000);
  assertRange("fixedCostUsd", input.fixedCostUsd, 0, 100_000_000);
  assertRange("launchCostUsd", input.launchCostUsd, 0, 100_000_000);
}

function customersAtDay(input: BotSalesSimulationInput, day: number): number {
  if (day < input.salesStartDay) return input.startingCustomers;
  const acquisitionDays = Math.min(day, input.salesEndDay) - input.salesStartDay + 1;
  return input.startingCustomers + acquisitionDays * input.newCustomersPerDay;
}

function billableFraction(input: BotSalesSimulationInput, runtimeHours: number): number {
  if (input.billingMode === "active_day") return runtimeHours > 0 ? 1 : 0;
  return runtimeHours / 24;
}

/**
 * Simula uma operação de licenças cobradas por uso, dia a dia.
 *
 * `runtime_24h` transforma horas efetivamente usadas em frações de bot-day;
 * `active_day` cobra uma diária inteira quando a instância foi usada no dia.
 */
export function simulateBotSales(input: BotSalesSimulationInput): BotSalesSimulation {
  validate(input);

  const utilization = input.utilizationPercent / 100;
  const feeRate = input.paymentFeePercent / 100;
  const refundRate = input.refundPercent / 100;
  const days: BotSalesSimulationDay[] = [];
  let cumulativeProfit = -input.launchCostUsd;

  for (let day = 1; day <= input.horizonDays; day += 1) {
    const customers = customersAtDay(input, day);
    const activeBots = customers * input.botsPerCustomer;
    const scheduledHours =
      day <= input.hoursChangeDay ? input.earlyHoursPerDay : input.lateHoursPerDay;
    const runtimeHours = scheduledHours * utilization;
    const billableBotDays = activeBots * billableFraction(input, runtimeHours);
    const grossRevenueUsd = billableBotDays * input.dailyPriceUsd;
    const netRevenueUsd = grossRevenueUsd * (1 - feeRate - refundRate);
    const supportCostUsd = customers * input.supportCostPerCustomerDayUsd;
    const fixedDailyUsd = input.fixedCostUsd / input.horizonDays;
    cumulativeProfit += netRevenueUsd - supportCostUsd - fixedDailyUsd;

    days.push({
      day,
      customers,
      activeBots,
      runtimeHours,
      billableBotDays,
      grossRevenueUsd,
      netRevenueUsd,
      cumulativeProfitUsd: cumulativeProfit,
    });
  }

  const billableBotDays = days.reduce((sum, day) => sum + day.billableBotDays, 0);
  const grossRevenueUsd = days.reduce((sum, day) => sum + day.grossRevenueUsd, 0);
  const paymentFeesUsd = grossRevenueUsd * feeRate;
  const refundsUsd = grossRevenueUsd * refundRate;
  const supportCostUsd = days.reduce(
    (sum, day) => sum + day.customers * input.supportCostPerCustomerDayUsd,
    0,
  );
  const totalCostUsd =
    paymentFeesUsd + refundsUsd + supportCostUsd + input.fixedCostUsd + input.launchCostUsd;
  const profitUsd = grossRevenueUsd - totalCostUsd;
  const breakEven = days.find((day) => day.cumulativeProfitUsd >= 0);
  const finalCustomers = days.at(-1)?.customers ?? 0;

  return {
    days,
    finalCustomers,
    finalActiveBots: finalCustomers * input.botsPerCustomer,
    billableBotDays,
    grossRevenueUsd,
    paymentFeesUsd,
    refundsUsd,
    supportCostUsd,
    totalCostUsd,
    profitUsd,
    marginPercent: grossRevenueUsd > 0 ? (profitUsd / grossRevenueUsd) * 100 : 0,
    breakEvenDay: breakEven?.day ?? null,
    revenuePerCustomerUsd: finalCustomers > 0 ? grossRevenueUsd / finalCustomers : 0,
  };
}
