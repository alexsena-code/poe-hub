import { describe, it, expect } from "vitest";
import { computeBotPayback, type BotPaybackInput } from "./bot-payback";

function makeInput(overrides: Partial<BotPaybackInput> = {}): BotPaybackInput {
  return {
    oneTimeUsd: 50,
    divinesPerDayPerBot: 16,
    priceUsd: 0.5,
    dailyCostPerBotUsd: 2.2,
    ...overrides,
  };
}

describe("computeBotPayback", () => {
  it("divide o setup pelo lucro diário do bot", () => {
    // 16 × 0,5 = 8 de receita − 2,2 de custo = 5,8/dia; 50 / 5,8 = 8,62 dias.
    const payback = computeBotPayback(makeInput());
    expect(payback.revenuePerBotUsd).toBeCloseTo(8, 10);
    expect(payback.profitPerBotUsd).toBeCloseTo(5.8, 10);
    expect(payback.days).toBeCloseTo(8.6207, 3);
  });

  it("devolve null quando o bot fecha o dia no vermelho", () => {
    // Preço do CNL: 16 × 0,042 = 0,672 contra 2,20 de custo.
    const payback = computeBotPayback(makeInput({ priceUsd: 0.042 }));
    expect(payback.profitPerBotUsd).toBeLessThan(0);
    expect(payback.days).toBeNull();
  });

  it("devolve null no empate exato, que também nunca se paga", () => {
    const payback = computeBotPayback(makeInput({ dailyCostPerBotUsd: 8 }));
    expect(payback.profitPerBotUsd).toBe(0);
    expect(payback.days).toBeNull();
  });

  it("trata setup zerado como pago na hora", () => {
    expect(computeBotPayback(makeInput({ oneTimeUsd: 0 })).days).toBe(0);
  });

  it("ignora custo global: só o custo por bot entra", () => {
    // O chamador passa dailyCostPerBotUsd já sem a parcela global; um custo
    // por bot maior é o único jeito de piorar o payback.
    const base = computeBotPayback(makeInput()).days!;
    const pior = computeBotPayback(makeInput({ dailyCostPerBotUsd: 4.2 })).days!;
    expect(pior).toBeGreaterThan(base);
  });

  it("rejeita setup negativo informando o valor", () => {
    expect(() => computeBotPayback(makeInput({ oneTimeUsd: -1 }))).toThrow(
      /bad oneTimeUsd: -1/,
    );
  });

  it("rejeita preço negativo informando o valor", () => {
    expect(() => computeBotPayback(makeInput({ priceUsd: -0.5 }))).toThrow(
      /bad priceUsd: -0.5/,
    );
  });
});
