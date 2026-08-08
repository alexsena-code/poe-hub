import { describe, it, expect } from "vitest";
import { buildProfitForecast } from "./profit-forecast";
import { decomposeDailyCost } from "./daily-cost";
import { buildDecayCurve, type LeagueSeries } from "./league-price-curve";

const SERIES: LeagueSeries[] = [
  {
    league: "A",
    points: [
      { dayOfLeague: 7, price: 2 },
      { dayOfLeague: 14, price: 1 },
      { dayOfLeague: 21, price: 0.5 },
    ],
  },
];

const CURVE = buildDecayCurve(SERIES)!;

const COST = decomposeDailyCost({
  proxyCostPerBotMonthly: 3,
  levelingCostPerBot: 5,
  expluginsKeyCostDaily: 0.2,
  dpbKeyCostDaily: 0.1,
});

const BASE = {
  basePriceUsd: 0.06,
  currentDayOfLeague: 7,
  days: 3,
  divinesPerHour: 2,
  hoursPerDay: 8,
  activeBots: 10,
};

describe("buildProfitForecast", () => {
  it("calcula produção como bots × divines/hora × horas", () => {
    const forecast = buildProfitForecast(BASE);
    expect(forecast.days[0].divines).toBe(160);
  });

  it("sem custo, o lucro do dia é a receita bruta", () => {
    const forecast = buildProfitForecast(BASE);
    // 160 divines × US$ 0,06
    expect(forecast.todayProfitUsd).toBeCloseTo(9.6, 10);
    expect(forecast.days[0].costUsd).toBe(0);
  });

  it("desconta o custo diário quando a config é passada", () => {
    const forecast = buildProfitForecast({ ...BASE, costParts: COST });
    // (0.2 + 0.1 + 0.1) × 10 bots = US$ 4/dia
    expect(forecast.days[0].costUsd).toBeCloseTo(4, 10);
    expect(forecast.todayProfitUsd).toBeCloseTo(5.6, 10);
  });

  it("sem curva o preço fica constante e é sinalizado", () => {
    const forecast = buildProfitForecast(BASE);
    expect(forecast.days[2].priceUsd).toBeCloseTo(0.06, 10);
    expect(forecast.days[2].priceFromCurve).toBe(false);
  });

  it("aplica a queda da curva ao longo dos dias", () => {
    const forecast = buildProfitForecast({ ...BASE, days: 8, curve: CURVE });
    expect(forecast.days[0].priceUsd).toBeCloseTo(0.06, 10);
    // Dia 14 vale metade do dia 7 nesta série.
    expect(forecast.days[7].priceUsd).toBeCloseTo(0.03, 10);
    expect(forecast.days[7].priceFromCurve).toBe(true);
  });

  it("mantém o preço além do fim da curva sem extrapolar", () => {
    const forecast = buildProfitForecast({
      ...BASE,
      currentDayOfLeague: 21,
      days: 5,
      curve: CURVE,
    });
    const precos = forecast.days.map((d) => d.priceUsd);
    expect(new Set(precos.map((p) => p.toFixed(8))).size).toBe(1);
  });

  it("aponta o dia em que a operação passa a dar prejuízo", () => {
    // Com a queda, a receita cai abaixo do custo fixo em algum ponto.
    const forecast = buildProfitForecast({
      ...BASE,
      days: 15,
      curve: CURVE,
      costParts: COST,
    });
    expect(forecast.breakEvenDayOffset).not.toBeNull();
    const virada = forecast.days[forecast.breakEvenDayOffset!];
    expect(virada.profitUsd).toBeLessThan(0);
    expect(forecast.days[virada.dayOffset - 1].profitUsd).toBeGreaterThanOrEqual(0);
  });

  it("devolve breakEven null quando a operação nunca fica negativa", () => {
    const forecast = buildProfitForecast(BASE);
    expect(forecast.breakEvenDayOffset).toBeNull();
  });

  it("soma os totais do horizonte", () => {
    const forecast = buildProfitForecast({ ...BASE, costParts: COST });
    expect(forecast.totals.divines).toBe(480);
    expect(forecast.totals.costUsd).toBeCloseTo(12, 10);
    expect(forecast.totals.profitUsd).toBeCloseTo(
      forecast.days.reduce((s, d) => s + d.profitUsd, 0),
      10,
    );
  });

  it("com zero bots não produz nada, mas mantém o custo global", () => {
    const comGlobal = decomposeDailyCost({
      proxyCostPerBotMonthly: 3,
      levelingCostPerBot: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      customCosts: [{ id: "1", name: "VPS", amount: 30, cadence: "monthly", perBot: false }],
    });
    const forecast = buildProfitForecast({ ...BASE, activeBots: 0, costParts: comGlobal });
    expect(forecast.days[0].divines).toBe(0);
    expect(forecast.todayProfitUsd).toBeCloseTo(-1, 10);
  });

  it.each([
    [{ basePriceUsd: 0 }, /bad basePriceUsd: 0/],
    [{ days: 0 }, /bad days: 0/],
    [{ days: 1.5 }, /bad days: 1\.5/],
    [{ hoursPerDay: 25 }, /bad hoursPerDay: 25/],
    [{ activeBots: -2 }, /bad activeBots: -2/],
    [{ divinesPerHour: -1 }, /bad divinesPerHour: -1/],
  ])("rejeita entrada inválida %#", (patch, matcher) => {
    expect(() => buildProfitForecast({ ...BASE, ...patch })).toThrow(matcher);
  });
});
