import { describe, it, expect } from "vitest";
import {
  buildDecayCurve,
  curveFactorAt,
  projectPrice,
  type LeagueSeries,
} from "./league-price-curve";

/**
 * Formato real das curvas em `daily_prices` (medianas em BRL, PoE1, ago/2026).
 * Os patamares são bem diferentes entre ligas — é justamente o que a
 * normalização precisa neutralizar.
 */
const REAL_SERIES: LeagueSeries[] = [
  {
    league: "Keepers of the Flame",
    points: [
      { dayOfLeague: 7, price: 2.0 },
      { dayOfLeague: 14, price: 0.75 },
      { dayOfLeague: 30, price: 0.24 },
    ],
  },
  {
    league: "Mercenaries",
    points: [
      { dayOfLeague: 7, price: 2.5 },
      { dayOfLeague: 14, price: 0.9 },
      { dayOfLeague: 30, price: 0.33 },
    ],
  },
  {
    league: "Mirage",
    points: [
      { dayOfLeague: 7, price: 1.1 },
      { dayOfLeague: 14, price: 0.37 },
    ],
  },
];

describe("buildDecayCurve", () => {
  it("normaliza o dia de referência para 1 em todas as ligas", () => {
    const curve = buildDecayCurve(REAL_SERIES);
    expect(curve?.factors.get(7)).toBe(1);
    expect(curve?.leaguesUsed).toHaveLength(3);
  });

  it("agrega o formato da queda, não o patamar de preço", () => {
    const curve = buildDecayCurve(REAL_SERIES);
    // Medianas de 0.375, 0.36 e 0.336 → 0.36
    expect(curve?.factors.get(14)).toBeCloseTo(0.36, 3);
    // Só duas ligas cobrem o dia 30: 0.12 e 0.132 → média dos dois centrais
    expect(curve?.factors.get(30)).toBeCloseTo(0.126, 3);
  });

  it("é imune a diferença de escala entre ligas", () => {
    const escalado: LeagueSeries[] = REAL_SERIES.map((s) => ({
      league: `${s.league} x1000`,
      points: s.points.map((p) => ({ ...p, price: p.price * 1000 })),
    }));
    const base = buildDecayCurve(REAL_SERIES);
    const outro = buildDecayCurve(escalado);
    expect(outro?.factors.get(14)).toBeCloseTo(base!.factors.get(14)!, 10);
  });

  it("aceita série cujo dia de referência está dentro da tolerância", () => {
    const curve = buildDecayCurve([
      { league: "A", points: [{ dayOfLeague: 8, price: 2 }, { dayOfLeague: 14, price: 1 }] },
    ]);
    expect(curve?.leaguesUsed).toEqual(["A"]);
  });

  it("descarta liga sem cobertura perto do dia de referência", () => {
    const curve = buildDecayCurve([
      ...REAL_SERIES,
      // Settlers só tem dias 311-315 no banco — não serve de base.
      { league: "Settlers", points: [{ dayOfLeague: 311, price: 0.5 }] },
    ]);
    expect(curve?.leaguesUsed).not.toContain("Settlers");
  });

  it("devolve null quando nenhuma liga cobre o dia de referência", () => {
    expect(buildDecayCurve([{ league: "X", points: [{ dayOfLeague: 90, price: 1 }] }])).toBeNull();
  });

  // Regressão: com dados reais a curva subia de 0,085 (dia 60) para 0,465
  // (dia 90) por causa de pontos sujos do scraper antigo, e a projeção passava
  // a prever preço em alta.
  it("nunca sobe, mesmo com ponto sujo na cauda", () => {
    const curve = buildDecayCurve([
      {
        league: "Suja",
        points: [
          { dayOfLeague: 7, price: 2 },
          { dayOfLeague: 14, price: 1 },
          { dayOfLeague: 60, price: 0.2 },
          // Ruído real: preço 7x o do dia 7, no meio da cauda.
          { dayOfLeague: 92, price: 15 },
        ],
      },
    ]);

    const factors = [7, 14, 60, 92].map((d) => curve!.factors.get(d)!);
    for (let i = 1; i < factors.length; i += 1) {
      expect(factors[i]).toBeLessThanOrEqual(factors[i - 1]);
    }
    expect(curve!.factors.get(92)).toBeCloseTo(0.1, 6);
  });

  it("ignora preço zero ou negativo", () => {
    const curve = buildDecayCurve([
      { league: "A", points: [{ dayOfLeague: 7, price: 2 }, { dayOfLeague: 14, price: 0 }] },
    ]);
    expect(curve?.factors.has(14)).toBe(false);
  });
});

describe("curveFactorAt", () => {
  const curve = buildDecayCurve(REAL_SERIES)!;

  it("interpola linearmente entre dois dias conhecidos", () => {
    const d7 = curve.factors.get(7)!;
    const d14 = curve.factors.get(14)!;
    const meio = curveFactorAt(curve, 10)!;
    expect(meio).toBeLessThan(d7);
    expect(meio).toBeGreaterThan(d14);
  });

  it("repete o último fator além do fim da curva em vez de extrapolar", () => {
    const ultimo = curve.factors.get(30)!;
    expect(curveFactorAt(curve, 200)).toBeCloseTo(ultimo, 10);
  });

  it("usa o primeiro fator antes do início da curva", () => {
    expect(curveFactorAt(curve, 1)).toBeCloseTo(curve.factors.get(7)!, 10);
  });
});

describe("projectPrice", () => {
  const curve = buildDecayCurve(REAL_SERIES)!;

  it("projeta a queda a partir do preço de hoje", () => {
    // Do dia 7 (fator 1) para o dia 14 (fator 0,36).
    expect(projectPrice(curve, 0.1, 7, 14)).toBeCloseTo(0.036, 5);
  });

  it("devolve o próprio preço quando origem e destino coincidem", () => {
    expect(projectPrice(curve, 0.06, 14, 14)).toBeCloseTo(0.06, 10);
  });

  it("independe do dia de referência escolhido na construção", () => {
    const outraRef = buildDecayCurve(REAL_SERIES, 14)!;
    expect(projectPrice(outraRef, 0.1, 7, 14)).toBeCloseTo(
      projectPrice(curve, 0.1, 7, 14)!,
      10,
    );
  });

  it("rejeita preço base inválido com o valor na mensagem", () => {
    expect(() => projectPrice(curve, 0, 7, 14)).toThrow(/bad basePrice: 0/);
  });
});
