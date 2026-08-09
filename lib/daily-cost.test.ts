import { describe, it, expect } from "vitest";
import {
  decomposeDailyCost,
  dailyCostFor,
  breakdownDailyCost,
  oneTimeCostPerBot,
  perBotDailyCost,
  type CostConfigData,
} from "./daily-cost";

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

describe("oneTimeCostPerBot", () => {
  it("soma leveling e stash pack, que o custo diário ignora", () => {
    expect(oneTimeCostPerBot(makeConfig())).toBeCloseTo(15, 10);
  });

  it("inclui custom one_time por bot e exclui o global", () => {
    const total = oneTimeCostPerBot(
      makeConfig({
        customCosts: [
          { id: "1", name: "Conta", amount: 20, cadence: "one_time", perBot: true },
          { id: "2", name: "Servidor", amount: 999, cadence: "one_time", perBot: false },
        ],
      }),
    );
    // 5 leveling + 10 stash + 20 da conta; o servidor é da operação, não do bot.
    expect(total).toBeCloseTo(35, 10);
  });

  it("ignora custos recorrentes, que não são desembolso de setup", () => {
    const total = oneTimeCostPerBot(
      makeConfig({
        customCosts: [
          { id: "1", name: "Extra", amount: 50, cadence: "monthly", perBot: true },
        ],
      }),
    );
    expect(total).toBeCloseTo(15, 10);
  });

  it("trata stash pack ausente como zero", () => {
    const config = makeConfig();
    delete config.stashPackCostPerBot;
    expect(oneTimeCostPerBot(config)).toBeCloseTo(5, 10);
  });
});

describe("perBotDailyCost", () => {
  it("soma só as parcelas que escalam com bot", () => {
    const parts = decomposeDailyCost(
      makeConfig({
        customCosts: [
          { id: "1", name: "VPS", amount: 30, cadence: "monthly", perBot: false },
        ],
      }),
    );
    // 0.2 + 0.1 + 0.1 = 0.4 — o 1/dia da VPS não entra.
    expect(perBotDailyCost(parts)).toBeCloseTo(0.4, 10);
  });

  it("concorda com dailyCostFor quando não há custo global", () => {
    const parts = decomposeDailyCost(makeConfig());
    expect(perBotDailyCost(parts) * 7).toBeCloseTo(dailyCostFor(parts, 7), 10);
  });
});

describe("breakdownDailyCost", () => {
  const parts = decomposeDailyCost(
    makeConfig({
      customCosts: [{ id: "1", name: "VPS", amount: 30, cadence: "monthly", perBot: false }],
    }),
  );

  it("soma das parcelas bate com dailyCostFor", () => {
    const lines = breakdownDailyCost(parts, 6);
    const soma = lines.reduce((acc, line) => acc + line.totalDaily, 0);
    expect(soma).toBeCloseTo(dailyCostFor(parts, 6), 10);
  });

  it("escala as parcelas por bot e mantém a global fixa", () => {
    const lines = breakdownDailyCost(parts, 6);
    const explugins = lines.find((l) => l.key === "explugins");
    const global = lines.find((l) => l.key === "customGlobal");
    // 0.2 * 6 = 1.2 no explugins; VPS de 30/mês = 1/dia, sem multiplicar.
    expect(explugins?.totalDaily).toBeCloseTo(1.2, 10);
    expect(global?.totalDaily).toBeCloseTo(1, 10);
    expect(global?.perBotDaily).toBe(0);
  });

  it("omite componentes zerados", () => {
    const semDpb = decomposeDailyCost(makeConfig({ dpbKeyCostDaily: 0 }));
    const keys = breakdownDailyCost(semDpb, 6).map((l) => l.key);
    expect(keys).toEqual(["explugins", "proxy"]);
  });

  it("mantém as taxas por bot mesmo com zero bot ligado", () => {
    const lines = breakdownDailyCost(parts, 0);
    const explugins = lines.find((l) => l.key === "explugins");
    expect(explugins?.perBotDaily).toBeCloseTo(0.2, 10);
    expect(explugins?.totalDaily).toBe(0);
  });

  it("rejeita número de bots negativo informando o valor", () => {
    expect(() => breakdownDailyCost(parts, -2)).toThrow(/bad activeBots: -2/);
  });
});
