import { describe, it, expect } from "vitest";
import { decomposeDailyCost, dailyCostFor, type CostConfigData } from "./daily-cost";

function makeConfig(overrides: Partial<CostConfigData> = {}): CostConfigData {
  return {
    proxyCostPerBotMonthly: 3,
    levelingCostPerBot: 5,
    stashPackCostPerBot: 10,
    expluginsKeyCostDaily: 0.2,
    dpbKeyCostDaily: 0.1,
    customCosts: null,
    ...overrides,
  };
}

describe("decomposeDailyCost", () => {
  it("converte custo mensal de proxy para diário em mês de 30 dias", () => {
    expect(decomposeDailyCost(makeConfig()).proxyPerBotDaily).toBeCloseTo(0.1, 10);
  });

  it("aceita Decimal do Prisma além de number", () => {
    const decimal = { toNumber: () => 6 };
    const parts = decomposeDailyCost(makeConfig({ proxyCostPerBotMonthly: decimal }));
    expect(parts.proxyPerBotDaily).toBeCloseTo(0.2, 10);
  });

  it("separa custo custom por bot de custo global", () => {
    const parts = decomposeDailyCost(
      makeConfig({
        customCosts: [
          { id: "1", name: "VPS", amount: 30, cadence: "monthly", perBot: false },
          { id: "2", name: "Extra", amount: 0.5, cadence: "daily", perBot: true },
        ],
      }),
    );
    expect(parts.customGlobalDaily).toBeCloseTo(1, 10);
    expect(parts.customPerBotDaily).toBeCloseTo(0.5, 10);
  });

  it("ignora custo one_time, que não tem expressão diária", () => {
    const parts = decomposeDailyCost(
      makeConfig({
        customCosts: [
          { id: "1", name: "Setup", amount: 500, cadence: "one_time", perBot: false },
        ],
      }),
    );
    expect(parts.customGlobalDaily).toBe(0);
  });

  it("não conta leveling nem stash pack: são cobranças únicas", () => {
    const parts = decomposeDailyCost(makeConfig());
    const total = dailyCostFor(parts, 1);
    // 0.2 explugins + 0.1 dpb + 0.1 proxy = 0.4 — sem os 5 e 10 de setup.
    expect(total).toBeCloseTo(0.4, 10);
  });
});

describe("dailyCostFor", () => {
  const parts = decomposeDailyCost(
    makeConfig({
      customCosts: [{ id: "1", name: "VPS", amount: 30, cadence: "monthly", perBot: false }],
    }),
  );

  it("escala o custo por bot e soma o global uma vez só", () => {
    // (0.2 + 0.1 + 0.1) * 10 + 1 = 5
    expect(dailyCostFor(parts, 10)).toBeCloseTo(5, 10);
  });

  it("cobra o custo global mesmo sem bot ligado", () => {
    expect(dailyCostFor(parts, 0)).toBeCloseTo(1, 10);
  });

  it("aplica o override de explugins quando informado", () => {
    // explugins cai de 0.2 para 0: (0 + 0.1 + 0.1) * 10 + 1 = 3
    expect(dailyCostFor(parts, 10, 0)).toBeCloseTo(3, 10);
  });

  it("rejeita número de bots negativo informando o valor", () => {
    expect(() => dailyCostFor(parts, -1)).toThrow(/bad activeBots: -1/);
  });
});
