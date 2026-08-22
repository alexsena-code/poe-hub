import { describe, expect, it } from "vitest";
import { simulateBotSales, type BotSalesSimulationInput } from "./bot-sales-simulator";

const BASE: BotSalesSimulationInput = {
  horizonDays: 60,
  salesStartDay: 7,
  salesEndDay: 30,
  newCustomersPerDay: 4,
  startingCustomers: 0,
  botsPerCustomer: 1,
  dailyPriceUsd: 1,
  billingMode: "active_day",
  earlyHoursPerDay: 14,
  lateHoursPerDay: 9,
  hoursChangeDay: 30,
  utilizationPercent: 100,
  paymentFeePercent: 0,
  refundPercent: 0,
  supportCostPerCustomerDayUsd: 0,
  fixedCostUsd: 0,
  launchCostUsd: 0,
};

describe("simulateBotSales", () => {
  it("ramps four customers daily through day 30 and holds the cap", () => {
    const result = simulateBotSales(BASE);

    expect(result.days[5].customers).toBe(0);
    expect(result.days[6].customers).toBe(4);
    expect(result.days[29].customers).toBe(96);
    expect(result.days[59].customers).toBe(96);
    expect(result.billableBotDays).toBe(4_080);
    expect(result.grossRevenueUsd).toBe(4_080);
  });

  it("charges accumulated runtime as fractions of a 24-hour bot-day", () => {
    const result = simulateBotSales({ ...BASE, billingMode: "runtime_24h" });

    expect(result.billableBotDays).toBe(1_780);
    expect(result.grossRevenueUsd).toBe(1_780);
  });

  it("charges every bot owned by each customer", () => {
    const result = simulateBotSales({ ...BASE, botsPerCustomer: 3 });

    expect(result.finalCustomers).toBe(96);
    expect(result.finalActiveBots).toBe(288);
    expect(result.billableBotDays).toBe(12_240);
    expect(result.grossRevenueUsd).toBe(12_240);
    expect(result.supportCostUsd).toBe(0);
  });

  it("deducts fees, refunds, support, fixed and launch costs", () => {
    const result = simulateBotSales({
      ...BASE,
      paymentFeePercent: 5,
      refundPercent: 2,
      supportCostPerCustomerDayUsd: 0.1,
      fixedCostUsd: 100,
      launchCostUsd: 200,
    });

    expect(result.paymentFeesUsd).toBe(204);
    expect(result.refundsUsd).toBeCloseTo(81.6);
    expect(result.supportCostUsd).toBeCloseTo(408);
    expect(result.totalCostUsd).toBeCloseTo(993.6);
    expect(result.profitUsd).toBeCloseTo(3_086.4);
    expect(result.breakEvenDay).not.toBeNull();
  });

  it("rejects a sales window outside the horizon", () => {
    expect(() => simulateBotSales({ ...BASE, salesEndDay: 61 })).toThrow(
      "bad salesEndDay: 61 (expected in [7, 60])",
    );
  });
});
