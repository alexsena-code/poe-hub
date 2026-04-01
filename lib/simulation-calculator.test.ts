import { describe, it, expect } from "vitest";
import {
  resolveDay,
  calculateDay,
  calculateWeek,
  calculateSimulation,
  type RawDay,
  type RawWeek,
  type CostConfigData,
} from "./simulation-calculator";

// ============================================================
// Helpers
// ============================================================

function makeWeek(overrides: Partial<RawWeek> = {}): RawWeek {
  return {
    weekNumber: 1,
    label: "Semana 1",
    defaultActiveBots: 5,
    defaultDivinePerHour: 0.5,
    defaultHoursPerDay: 24,
    defaultDivinePriceUsd: 2.0,
    defaultDivinePriceBrl: 10.0,
    ...overrides,
  };
}

function makeDay(overrides: Partial<RawDay> = {}): RawDay {
  return {
    dayNumber: 1,
    activeBots: null,
    divinePerHour: null,
    hoursPerDay: null,
    divinePriceUsd: null,
    divinePriceBrl: null,
    ...overrides,
  };
}

function makeCostConfig(overrides: Partial<CostConfigData> = {}): CostConfigData {
  return {
    proxyCostPerBotMonthly: 1,
    levelingCostPerBot: 20,
    expluginsKeyCostDaily: 3,
    dpbKeyCostDaily: 2,
    ...overrides,
  };
}

function makeDays7(overrides: Partial<RawDay> = {}): RawDay[] {
  return Array.from({ length: 7 }, (_, i) => makeDay({ dayNumber: i + 1, ...overrides }));
}

// ============================================================
// resolveDay
// ============================================================

describe("resolveDay", () => {
  it("inherits all fields from week when day has no overrides", () => {
    const week = makeWeek();
    const day = makeDay();
    const resolved = resolveDay(day, week);

    expect(resolved.activeBots).toBe(5);
    expect(resolved.divinePerHour).toBe(0.5);
    expect(resolved.hoursPerDay).toBe(24);
    expect(resolved.divinePriceUsd).toBe(2.0);
    expect(resolved.divinePriceBrl).toBe(10.0);
  });

  it("uses day override for activeBots when provided", () => {
    const week = makeWeek({ defaultActiveBots: 5 });
    const day = makeDay({ activeBots: 10 });
    const resolved = resolveDay(day, week);

    expect(resolved.activeBots).toBe(10);
  });

  it("uses day override for divinePerHour when provided", () => {
    const week = makeWeek({ defaultDivinePerHour: 0.5 });
    const day = makeDay({ divinePerHour: 1.5 });
    const resolved = resolveDay(day, week);

    expect(resolved.divinePerHour).toBe(1.5);
  });

  it("uses day override for hoursPerDay when provided", () => {
    const week = makeWeek({ defaultHoursPerDay: 24 });
    const day = makeDay({ hoursPerDay: 12 });
    const resolved = resolveDay(day, week);

    expect(resolved.hoursPerDay).toBe(12);
  });

  it("uses day override for divinePriceUsd when provided", () => {
    const week = makeWeek({ defaultDivinePriceUsd: 2.0 });
    const day = makeDay({ divinePriceUsd: 3.0 });
    const resolved = resolveDay(day, week);

    expect(resolved.divinePriceUsd).toBe(3.0);
  });

  it("uses day override for divinePriceBrl when provided", () => {
    const week = makeWeek({ defaultDivinePriceBrl: 10.0 });
    const day = makeDay({ divinePriceBrl: 15.0 });
    const resolved = resolveDay(day, week);

    expect(resolved.divinePriceBrl).toBe(15.0);
  });

  it("inherits null price from week when both day and week are null", () => {
    const week = makeWeek({ defaultDivinePriceUsd: null, defaultDivinePriceBrl: null });
    const day = makeDay();
    const resolved = resolveDay(day, week);

    expect(resolved.divinePriceUsd).toBeNull();
    expect(resolved.divinePriceBrl).toBeNull();
  });

  it("allows activeBots=0 as a valid override (not fallback)", () => {
    const week = makeWeek({ defaultActiveBots: 5 });
    const day = makeDay({ activeBots: 0 });
    const resolved = resolveDay(day, week);

    // 0 is falsy but not null, so it should be used
    expect(resolved.activeBots).toBe(0);
  });

  it("preserves dayNumber", () => {
    const week = makeWeek();
    const day = makeDay({ dayNumber: 4 });
    const resolved = resolveDay(day, week);

    expect(resolved.dayNumber).toBe(4);
  });
});

// ============================================================
// calculateDay
// ============================================================

describe("calculateDay", () => {
  it("calculates divines produced correctly", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    // 5 * 0.5 * 24 = 60
    expect(result.divinesProduced).toBe(60);
  });

  it("calculates revenueUsd correctly", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    // 60 divines * $2.0 = $120
    expect(result.revenueUsd).toBe(120);
  });

  it("calculates revenueBrl correctly", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    // 60 divines * R$10.0 = R$600
    expect(result.revenueBrl).toBe(600);
  });

  it("returns null revenueUsd when price is null", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: null,
      divinePriceBrl: 10.0,
    });

    expect(result.revenueUsd).toBeNull();
    expect(result.revenueBrl).toBe(600);
  });

  it("returns null revenueBrl when price is null", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: null,
    });

    expect(result.revenueUsd).toBe(120);
    expect(result.revenueBrl).toBeNull();
  });

  it("returns 0 divines when activeBots is 0", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 0,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    expect(result.divinesProduced).toBe(0);
    expect(result.revenueUsd).toBe(0);
    expect(result.revenueBrl).toBe(0);
  });

  it("returns 0 divines when hoursPerDay is 0", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 0,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    expect(result.divinesProduced).toBe(0);
  });

  it("returns 0 divines when divinePerHour is 0", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0,
      hoursPerDay: 24,
      divinePriceUsd: 2.0,
      divinePriceBrl: 10.0,
    });

    expect(result.divinesProduced).toBe(0);
  });

  it("returns null for both revenues when both prices are null", () => {
    const result = calculateDay({
      dayNumber: 1,
      activeBots: 5,
      divinePerHour: 0.5,
      hoursPerDay: 24,
      divinePriceUsd: null,
      divinePriceBrl: null,
    });

    expect(result.divinesProduced).toBe(60);
    expect(result.revenueUsd).toBeNull();
    expect(result.revenueBrl).toBeNull();
  });
});

// ============================================================
// calculateWeek
// ============================================================

describe("calculateWeek", () => {
  it("sums daily revenues across 7 days", () => {
    const week = makeWeek({
      defaultActiveBots: 2,
      defaultDivinePerHour: 1.0,
      defaultHoursPerDay: 10,
      defaultDivinePriceUsd: 3.0,
      defaultDivinePriceBrl: 15.0,
    });
    const days = makeDays7();

    const result = calculateWeek(week, days);

    // Per day: 2 * 1.0 * 10 = 20 divines; 7 days = 140
    expect(result.totalDivines).toBe(140);
    // USD: 140 * 3.0 = 420
    expect(result.revenueUsd).toBe(420);
    // BRL: 140 * 15.0 = 2100
    expect(result.revenueBrl).toBe(2100);
  });

  it("calculates cost using cost config", () => {
    const week = makeWeek({ defaultActiveBots: 10 });
    const days = makeDays7();
    const costConfig = makeCostConfig({
      proxyCostPerBotMonthly: 2,
      expluginsKeyCostDaily: 5,
      dpbKeyCostDaily: 3,
    });

    const result = calculateWeek(week, days, costConfig);

    // costPerBotDaily = 5 + 3 + 2/30 = 8.0667; 10 bots * 7 days
    expect(result.costUsd).toBeCloseTo(7 * 10 * (5 + 3 + 2 / 30), 2);
  });

  it("returns 0 cost when no cost config provided", () => {
    const week = makeWeek();
    const days = makeDays7();

    const result = calculateWeek(week, days);

    expect(result.costUsd).toBe(0);
  });

  it("returns 0 cost when cost config is null", () => {
    const week = makeWeek();
    const days = makeDays7();

    const result = calculateWeek(week, days, null);

    expect(result.costUsd).toBe(0);
  });

  it("calculates profit as revenue - cost", () => {
    const week = makeWeek({
      defaultActiveBots: 5,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
    });
    const days = makeDays7();
    const costConfig = makeCostConfig();

    const result = calculateWeek(week, days, costConfig);

    // Revenue: 5 * 0.5 * 24 * 7 * 2.0 = 840
    // costPerBotDaily = 3 + 2 + 1/30; 5 bots * 7 days
    const weekCost = 7 * 5 * (3 + 2 + 1 / 30);
    expect(result.profitUsd).toBeCloseTo(840 - weekCost, 2);
  });

  it("returns null profit when revenue is null", () => {
    const week = makeWeek({ defaultDivinePriceUsd: null, defaultDivinePriceBrl: null });
    const days = makeDays7();

    const result = calculateWeek(week, days, makeCostConfig());

    expect(result.revenueUsd).toBeNull();
    expect(result.profitUsd).toBeNull();
  });

  it("tracks maxActiveBots across days with overrides", () => {
    const week = makeWeek({ defaultActiveBots: 3 });
    const days = [
      makeDay({ dayNumber: 1 }),
      makeDay({ dayNumber: 2, activeBots: 10 }),
      makeDay({ dayNumber: 3 }),
      makeDay({ dayNumber: 4, activeBots: 7 }),
      makeDay({ dayNumber: 5 }),
      makeDay({ dayNumber: 6 }),
      makeDay({ dayNumber: 7 }),
    ];

    const result = calculateWeek(week, days);

    expect(result.maxActiveBots).toBe(10);
  });

  it("handles week with all days having 0 bots", () => {
    const week = makeWeek({ defaultActiveBots: 0 });
    const days = makeDays7();
    const costConfig = makeCostConfig();

    const result = calculateWeek(week, days, costConfig);

    expect(result.totalDivines).toBe(0);
    expect(result.revenueUsd).toBe(0);
    expect(result.maxActiveBots).toBe(0);
    // 0 bots = 0 cost (all costs are per-bot)
    expect(result.costUsd).toBe(0);
  });

  it("handles mixed override days correctly", () => {
    const week = makeWeek({
      defaultActiveBots: 2,
      defaultDivinePerHour: 1.0,
      defaultHoursPerDay: 10,
      defaultDivinePriceUsd: 5.0,
    });
    // 6 days inherit (2*1.0*10=20 divines each = 120 total)
    // 1 day overridden to 5 bots (5*1.0*10=50 divines)
    const days = [
      ...Array.from({ length: 6 }, (_, i) => makeDay({ dayNumber: i + 1 })),
      makeDay({ dayNumber: 7, activeBots: 5 }),
    ];

    const result = calculateWeek(week, days);

    expect(result.totalDivines).toBe(170); // 120 + 50
    expect(result.revenueUsd).toBe(850); // 170 * 5
  });

  it("returns per-day calculations array", () => {
    const week = makeWeek();
    const days = makeDays7();
    const result = calculateWeek(week, days);

    expect(result.days).toHaveLength(7);
    expect(result.days[0].divinesProduced).toBe(60); // 5 * 0.5 * 24
  });
});

// ============================================================
// calculateSimulation
// ============================================================

describe("calculateSimulation", () => {
  it("sums totals across all weeks", () => {
    const week1 = makeWeek({ weekNumber: 1, defaultActiveBots: 5 });
    const week2 = makeWeek({ weekNumber: 2, defaultActiveBots: 10 });
    const days1 = makeDays7();
    const days2 = makeDays7();

    const result = calculateSimulation(
      [
        { week: week1, days: days1 },
        { week: week2, days: days2 },
      ],
      makeCostConfig()
    );

    // Week1 divines: 5 * 0.5 * 24 * 7 = 420
    // Week2 divines: 10 * 0.5 * 24 * 7 = 840
    expect(result.totalDivines).toBe(1260);
  });

  it("calculates total revenue correctly", () => {
    const week = makeWeek({
      defaultActiveBots: 5,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
      defaultDivinePriceBrl: 10.0,
    });
    const days = makeDays7();

    const result = calculateSimulation([{ week, days }]);

    // 420 divines * $2 = $840
    expect(result.totalRevenueUsd).toBe(840);
    // 420 divines * R$10 = R$4200
    expect(result.totalRevenueBrl).toBe(4200);
  });

  it("calculates total cost across weeks", () => {
    const week1 = makeWeek({ weekNumber: 1, defaultActiveBots: 5 });
    const week2 = makeWeek({ weekNumber: 2, defaultActiveBots: 5 });
    const costConfig = makeCostConfig();

    const result = calculateSimulation(
      [
        { week: week1, days: makeDays7() },
        { week: week2, days: makeDays7() },
      ],
      costConfig
    );

    // costPerBotDaily = 3 + 2 + 1/30; 5 bots * 14 days
    // Leveling: maxBots = 5, levelingCostPerBot = 20 -> 100
    const opCost2w = 14 * 5 * (3 + 2 + 1 / 30);
    expect(result.totalCostUsd).toBeCloseTo(opCost2w + 100, 2);
  });

  it("calculates profit as total revenue - total cost", () => {
    const week = makeWeek({
      defaultActiveBots: 5,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
    });
    const costConfig = makeCostConfig();

    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      costConfig
    );

    // Revenue: 840
    // Operational: 5 bots * (3+2+1/30) * 7 days; Leveling: 5*20=100
    const opCost = 7 * 5 * (3 + 2 + 1 / 30);
    const totalCost = opCost + 100;
    expect(result.totalProfitUsd).toBeCloseTo(840 - totalCost, 2);
  });

  it("calculates ROI correctly", () => {
    const week = makeWeek({
      defaultActiveBots: 5,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
    });
    const costConfig = makeCostConfig();

    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      costConfig
    );

    const opCost = 7 * 5 * (3 + 2 + 1 / 30);
    const totalCost = opCost + 100;
    expect(result.roi).toBeCloseTo(((840 - totalCost) / totalCost) * 100, 1);
  });

  it("returns null ROI when cost is 0", () => {
    const week = makeWeek({ defaultDivinePriceUsd: 2.0 });
    const result = calculateSimulation([{ week, days: makeDays7() }]);

    // No cost config, cost=0
    expect(result.roi).toBeNull();
  });

  it("returns null ROI when no USD prices", () => {
    const week = makeWeek({ defaultDivinePriceUsd: null, defaultDivinePriceBrl: 10 });
    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      makeCostConfig()
    );

    expect(result.totalRevenueUsd).toBeNull();
    expect(result.roi).toBeNull();
  });

  it("finds break-even week", () => {
    // Week 1: high per-bot cost, low revenue -> negative cumulative
    // Week 2: high revenue -> positive cumulative
    const costConfig = makeCostConfig({
      expluginsKeyCostDaily: 20, // per-bot daily
      dpbKeyCostDaily: 0,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
    });

    const week1 = makeWeek({
      weekNumber: 1,
      defaultActiveBots: 5,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
    });
    // Week1: revenue=5*0.5*24*7*2=840, cost=5*20*7=700 -> cumulative: 140
    // That's already positive... need higher cost
    // Actually let's use 30/bot/day: cost=5*30*7=1050, revenue=840 -> cumulative: -210
    const week2 = makeWeek({
      weekNumber: 2,
      defaultActiveBots: 5,
      defaultDivinePerHour: 1.0,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 2.0,
    });
    // Week2: revenue=5*1*24*7*2=1680, cost=5*30*7=1050 -> cumulative: -210+630=420

    const costConfig2 = makeCostConfig({
      expluginsKeyCostDaily: 30,
      dpbKeyCostDaily: 0,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
    });

    const result = calculateSimulation(
      [
        { week: week1, days: makeDays7() },
        { week: week2, days: makeDays7() },
      ],
      costConfig2
    );

    expect(result.breakEvenWeek).toBe(2);
  });

  it("returns null break-even when never profitable", () => {
    const costConfig = makeCostConfig({
      expluginsKeyCostDaily: 10000, // per-bot, huge
      dpbKeyCostDaily: 0,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
    });

    const week = makeWeek({
      defaultActiveBots: 1,
      defaultDivinePerHour: 0.1,
      defaultHoursPerDay: 1,
      defaultDivinePriceUsd: 0.01,
    });

    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      costConfig
    );

    expect(result.breakEvenWeek).toBeNull();
  });

  it("break-even is week 1 when immediately profitable", () => {
    const week = makeWeek({
      weekNumber: 1,
      defaultActiveBots: 10,
      defaultDivinePerHour: 1.0,
      defaultHoursPerDay: 24,
      defaultDivinePriceUsd: 5.0,
    });
    const costConfig = makeCostConfig(); // low cost

    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      costConfig
    );

    expect(result.breakEvenWeek).toBe(1);
  });

  it("returns null break-even when no USD prices", () => {
    const week = makeWeek({
      defaultDivinePriceUsd: null,
      defaultDivinePriceBrl: 10.0,
    });

    const result = calculateSimulation(
      [{ week, days: makeDays7() }],
      makeCostConfig()
    );

    expect(result.breakEvenWeek).toBeNull();
  });

  it("handles empty weeks array", () => {
    const result = calculateSimulation([], makeCostConfig());

    expect(result.totalDivines).toBe(0);
    expect(result.totalRevenueUsd).toBeNull();
    expect(result.totalRevenueBrl).toBeNull();
    expect(result.totalCostUsd).toBe(0);
    expect(result.totalProfitUsd).toBeNull();
    expect(result.roi).toBeNull();
    expect(result.breakEvenWeek).toBeNull();
  });

  it("handles no cost config", () => {
    const week = makeWeek({ defaultDivinePriceUsd: 2.0 });

    const result = calculateSimulation([{ week, days: makeDays7() }]);

    expect(result.totalCostUsd).toBe(0);
    expect(result.totalProfitUsd).toBe(result.totalRevenueUsd);
  });

  it("handles week with no overrides (all days inherit)", () => {
    const week = makeWeek({
      defaultActiveBots: 3,
      defaultDivinePerHour: 2.0,
      defaultHoursPerDay: 12,
      defaultDivinePriceUsd: 1.5,
      defaultDivinePriceBrl: 7.5,
    });
    // All days have null overrides
    const days = makeDays7();

    const result = calculateSimulation([{ week, days }]);

    // Per day: 3 * 2.0 * 12 = 72 divines; 7 days = 504
    expect(result.totalDivines).toBe(504);
    // USD: 504 * 1.5 = 756
    expect(result.totalRevenueUsd).toBe(756);
    // BRL: 504 * 7.5 = 3780
    expect(result.totalRevenueBrl).toBe(3780);
  });

  it("adds leveling cost once using max bots across all weeks", () => {
    // Week1: 3 bots, Week2: 8 bots -> maxBots = 8
    const week1 = makeWeek({ weekNumber: 1, defaultActiveBots: 3 });
    const week2 = makeWeek({ weekNumber: 2, defaultActiveBots: 8 });
    const costConfig = makeCostConfig({
      proxyCostPerBotMonthly: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      levelingCostPerBot: 50,
    });

    const result = calculateSimulation(
      [
        { week: week1, days: makeDays7() },
        { week: week2, days: makeDays7() },
      ],
      costConfig
    );

    // Operational cost: 0 per day across all days
    // Leveling: 8 * 50 = 400
    expect(result.totalCostUsd).toBeCloseTo(400, 2);
  });

  it("leveling cost is 0 when levelingCostPerBot is 0", () => {
    const week = makeWeek({ defaultActiveBots: 10 });
    const costConfig = makeCostConfig({
      proxyCostPerBotMonthly: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      levelingCostPerBot: 0,
    });

    const result = calculateSimulation([{ week, days: makeDays7() }], costConfig);

    expect(result.totalCostUsd).toBe(0);
  });

  it("leveling cost uses highest bot count across weeks, not sum", () => {
    // If leveling were applied per-week it would be 3+8=11 bots worth; correct is max=8
    const week1 = makeWeek({ weekNumber: 1, defaultActiveBots: 3 });
    const week2 = makeWeek({ weekNumber: 2, defaultActiveBots: 8 });
    const costConfig = makeCostConfig({
      proxyCostPerBotMonthly: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      levelingCostPerBot: 10,
    });

    const result = calculateSimulation(
      [
        { week: week1, days: makeDays7() },
        { week: week2, days: makeDays7() },
      ],
      costConfig
    );

    // Should be 8 * 10 = 80, not (3+8)*10 = 110
    expect(result.totalCostUsd).toBeCloseTo(80, 2);
  });
});
