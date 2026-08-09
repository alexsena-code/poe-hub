/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfitSummaryCards } from "./profit-summary-cards";
import { decomposeDailyCost, perBotDailyCost } from "@/lib/daily-cost";
import { buildProfitForecast } from "@/lib/profit-forecast";
import { computeBotPayback } from "@/lib/bot-payback";

// Config de produção em ago/2026: ExPlugins 1,80 + DPB 0,30 + proxy 3/mês.
const PARTS = decomposeDailyCost({
  proxyCostPerBotMonthly: 3,
  levelingCostPerBot: 50,
  stashPackCostPerBot: 0,
  expluginsKeyCostDaily: 1.8,
  dpbKeyCostDaily: 0.3,
  customCosts: null,
});

const ONE_TIME_PER_BOT = 50;

function renderCards({
  activeBots = 6,
  withCost = true,
  priceUsd = 0.042,
  divinesPerHour = 2,
} = {}) {
  const parts = withCost ? PARTS : null;
  const forecast = buildProfitForecast({
    basePriceUsd: priceUsd,
    currentDayOfLeague: 10,
    days: 7,
    divinesPerHour,
    hoursPerDay: 8,
    activeBots,
    costParts: parts,
  });
  const payback = computeBotPayback({
    oneTimeUsd: ONE_TIME_PER_BOT,
    divinesPerDayPerBot: divinesPerHour * 8,
    priceUsd,
    dailyCostPerBotUsd: parts ? perBotDailyCost(parts) : 0,
  });
  render(
    <ProfitSummaryCards
      forecast={forecast}
      days={7}
      costParts={parts}
      activeBots={activeBots}
      payback={payback}
      oneTimePerBot={ONE_TIME_PER_BOT}
    />,
  );
}

describe("ProfitSummaryCards", () => {
  it("mostra o custo do dia já multiplicado pelo número de bots", () => {
    renderCards();
    // 6 × (1,80 + 0,30 + 0,10) = 13,20
    expect(screen.getByText("US$ 13,20")).toBeDefined();
  });

  it("explica a multiplicação no hint do card de custo", () => {
    renderCards();
    expect(screen.getByText("6 bots × US$ 2,20/bot")).toBeDefined();
  });

  it("avisa quando não há custo recorrente em vez de fingir uma config", () => {
    renderCards({ withCost: false });
    expect(screen.getByText("Sem custo recorrente")).toBeDefined();
  });

  it("diz que já está no prejuízo quando o dia 0 fecha negativo", () => {
    // 96 divines × 0,042 = US$ 4,03 de receita contra US$ 13,20 de custo.
    renderCards();
    expect(screen.getByText("Já está")).toBeDefined();
  });

  it("mostra 'Nunca' no payback quando o bot não fecha o dia no positivo", () => {
    renderCards();
    expect(screen.getByText("Nunca")).toBeDefined();
    expect(screen.getByText("O bot não fecha o dia no positivo")).toBeDefined();
  });

  it("mostra o payback em dias quando o bot dá lucro", () => {
    // 16 div × 0,50 = 8,00 de receita − 2,20 = 5,80/dia; 50 / 5,80 = 8,6 dias.
    renderCards({ priceUsd: 0.5 });
    expect(screen.getByText("8,6 dias")).toBeDefined();
  });

  it("mostra o payback em horas quando é menos de um dia", () => {
    // 160 div × 0,50 = 80 − 2,20 = 77,80/dia; 50 / 77,80 = 0,64 dia = 15,4 h.
    renderCards({ priceUsd: 0.5, divinesPerHour: 20 });
    expect(screen.getByText("15,4 h")).toBeDefined();
  });
});
