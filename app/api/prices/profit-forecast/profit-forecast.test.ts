import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", name: "admin", role: "admin" },
  }),
}));

import { GET } from "./route";

const TODAY = new Date();

/** Liga que começou `daysAgo` dias atrás, para o dia-de-liga ficar previsível. */
function startDaysAgo(daysAgo: number): Date {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function cleanAll() {
  await prisma.g2gPriceSnapshot.deleteMany();
  await prisma.dailyPrice.deleteMany();
  await prisma.globalCostConfig.deleteMany();
  await prisma.league.deleteMany();
}

async function seedCurrentLeague() {
  return prisma.league.create({
    data: {
      name: "LigaAtual",
      poeVersion: "poe1",
      startDate: startDaysAgo(15),
      isCurrent: true,
    },
  });
}

/** Liga passada com série que cai pela metade entre o dia 7 e o dia 14. */
async function seedPastLeague(name: string, basePrice: number) {
  const start = startDaysAgo(400);
  await prisma.league.create({
    data: { name, poeVersion: "poe1", startDate: start, isCurrent: false },
  });

  for (const [dayOfLeague, price] of [
    [7, basePrice],
    [14, basePrice / 2],
    [21, basePrice / 4],
  ] as const) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOfLeague - 1);
    await prisma.dailyPrice.create({
      data: {
        date,
        item: "divine",
        league: name,
        currency: "brl",
        median: price,
        mean: price,
        min: price,
        max: price,
        sellCount: 1,
        buyCount: 1,
        totalOffers: 1,
      },
    });
  }
}

async function seedSnapshot(league: string) {
  return prisma.g2gPriceSnapshot.create({
    data: {
      item: "Divine Orb",
      league,
      g2gLeague: `${league} Standard`,
      platform: "PC",
      currency: "usd",
      median: 0.06,
      mean: 0.065,
      min: 0.05,
      max: 0.1,
      p25: 0.052,
      p75: 0.08,
      offerCount: 50,
      rawOfferCount: 70,
    },
  });
}

function req(qs = "") {
  return new NextRequest(`http://localhost/api/prices/profit-forecast${qs}`);
}

describe("GET /api/prices/profit-forecast", () => {
  beforeEach(cleanAll);
  afterAll(cleanAll);

  it("devolve 404 quando não há liga atual", async () => {
    const res = await GET(req());
    expect(res.status).toBe(404);
  });

  it("resolve a liga atual e o dia de liga", async () => {
    await seedCurrentLeague();
    const body = await (await GET(req())).json();

    expect(body.league.name).toBe("LigaAtual");
    expect(body.league.currentDayOfLeague).toBe(16);
  });

  it("devolve basePrice null quando não houve coleta", async () => {
    await seedCurrentLeague();
    const body = await (await GET(req())).json();
    expect(body.basePrice).toBeNull();
  });

  it("expõe mediana e p25 do snapshot mais recente", async () => {
    const league = await seedCurrentLeague();
    await seedSnapshot(league.name);

    const body = await (await GET(req())).json();
    expect(body.basePrice.medianUsd).toBeCloseTo(0.06, 6);
    expect(body.basePrice.p25Usd).toBeCloseTo(0.052, 6);
  });

  it("monta a curva a partir das ligas passadas, normalizada no dia 7", async () => {
    await seedCurrentLeague();
    await seedPastLeague("Passada A", 2);
    await seedPastLeague("Passada B", 8);

    const body = await (await GET(req())).json();
    const factorAt = (day: number) =>
      body.curve.points.find((p: { dayOfLeague: number }) => p.dayOfLeague === day)?.factor;

    expect(body.curve.leaguesUsed).toHaveLength(2);
    expect(factorAt(7)).toBeCloseTo(1, 6);
    // Ambas caem pela metade, apesar dos patamares 2 e 8 serem diferentes.
    expect(factorAt(14)).toBeCloseTo(0.5, 6);
  });

  it("não usa a própria liga atual para construir a curva", async () => {
    const league = await seedCurrentLeague();
    await seedPastLeague("Passada A", 2);

    const body = await (await GET(req())).json();
    expect(body.curve.leaguesUsed).not.toContain(league.name);
  });

  it("devolve curve null sem histórico", async () => {
    await seedCurrentLeague();
    const body = await (await GET(req())).json();
    expect(body.curve).toBeNull();
  });

  it("decompõe os custos diários da config", async () => {
    await seedCurrentLeague();
    await prisma.globalCostConfig.create({
      data: {
        name: "Padrão",
        isDefault: true,
        proxyCostPerBotMonthly: 3,
        levelingCostPerBot: 5,
        expluginsKeyCostDaily: 0.2,
        dpbKeyCostDaily: 0.1,
      },
    });

    const body = await (await GET(req())).json();
    const parts = body.costConfigs[0].parts;

    expect(parts.proxyPerBotDaily).toBeCloseTo(0.1, 6);
    expect(parts.expluginsPerBotDaily).toBeCloseTo(0.2, 6);
    expect(body.costConfigs[0].isDefault).toBe(true);
  });

  it("aceita liga explícita por query", async () => {
    await seedCurrentLeague();
    await prisma.league.create({
      data: {
        name: "Outra",
        poeVersion: "poe1",
        startDate: startDaysAgo(50),
        isCurrent: false,
      },
    });

    const body = await (await GET(req("?league=Outra"))).json();
    expect(body.league.name).toBe("Outra");
    expect(body.league.currentDayOfLeague).toBe(51);
  });

  it("devolve 404 para liga inexistente informando o nome", async () => {
    await seedCurrentLeague();
    const res = await GET(req("?league=NaoExiste"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/NaoExiste/);
  });
});
