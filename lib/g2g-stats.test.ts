import { describe, it, expect } from "vitest";
import {
  median,
  percentile,
  rejectOutliers,
  summarizeOffers,
  type G2gOffer,
} from "./g2g-stats";

/**
 * Preços reais de Divine Orb em PC / Allflame Standard, coletados do G2G em
 * 08/08/2026 (80 ofertas, as duas páginas do resultado).
 *
 * A cauda é o ponto: as listagens de US$ 10, US$ 22 e US$ 999,99 existem de
 * verdade e são exatamente o que o filtro precisa remover.
 */
const REAL_PRICES = [
  0.049, 0.0499, 0.04999, 0.04999, 0.05, 0.0516, 0.052, 0.0522, 0.052249, 0.052391, 0.0524,
  0.0524, 0.0525, 0.052549, 0.05255, 0.05259, 0.05259, 0.05279, 0.053999, 0.054, 0.054025,
  0.054261, 0.0549, 0.055428, 0.055889, 0.056483, 0.058, 0.058787, 0.059, 0.0599, 0.060001,
  0.060801, 0.061325, 0.0614, 0.06149, 0.062, 0.06342, 0.065, 0.066, 0.067888, 0.071977,
  0.0725, 0.075, 0.07584, 0.075841, 0.08, 0.08, 0.085983, 0.0874, 0.0889, 0.09, 0.0912, 0.11,
  0.119, 0.12, 0.139, 0.15, 0.164706, 0.179, 0.19, 0.33, 0.372595, 0.39, 0.4, 0.5, 0.554017,
  0.554017, 0.613388, 0.639, 0.643187, 1, 1, 1, 1.0537, 2, 2.2, 2.9, 10.0539, 22, 999.999,
];

function makeOffer(priceUsd: number, overrides: Partial<G2gOffer> = {}): G2gOffer {
  return {
    priceUsd,
    availableQty: 1000,
    minQty: 1,
    sellerName: "vendedor",
    satisfactionRate: 1,
    ...overrides,
  };
}

const realOffers = REAL_PRICES.map((p) => makeOffer(p));

describe("median", () => {
  it("devolve o valor do meio numa lista ímpar", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("faz a média dos dois centrais numa lista par", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("não depende da ordem de entrada", () => {
    expect(median([9, 1, 5, 3, 7])).toBe(median([1, 3, 5, 7, 9]));
  });

  it("não muta o array recebido", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it("rejeita lista vazia com mensagem explícita", () => {
    expect(() => median([])).toThrow(/lista vazia/);
  });
});

describe("percentile", () => {
  it("devolve o mínimo em 0 e o máximo em 1", () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(5);
  });

  it("rejeita fração fora de [0, 1] informando o valor ofensor", () => {
    expect(() => percentile([1, 2], 1.5)).toThrow(/1\.5/);
  });
});

describe("rejectOutliers", () => {
  it("remove a cauda cara da amostra real e preserva o miolo", () => {
    const kept = rejectOutliers(realOffers);
    const prices = kept.map((o) => o.priceUsd);

    expect(kept.length).toBe(58);
    expect(Math.max(...prices)).toBeCloseTo(0.164706, 6);
    // As listagens absurdas somem; o piso legítimo continua.
    expect(prices).not.toContain(999.999);
    expect(prices).not.toContain(22);
    expect(prices).toContain(0.049);
  });

  it("mantém a amostra intacta quando todos os preços são iguais (MAD = 0)", () => {
    const flat = [0.06, 0.06, 0.06, 0.06, 0.06].map((p) => makeOffer(p));
    expect(rejectOutliers(flat)).toHaveLength(5);
  });

  it("não filtra amostras pequenas demais para estimar dispersão", () => {
    const tiny = [1, 2, 500].map((p) => makeOffer(p));
    expect(rejectOutliers(tiny)).toHaveLength(3);
  });

  it("fica mais permissivo conforme k cresce", () => {
    const strict = rejectOutliers(realOffers, 1).length;
    const loose = rejectOutliers(realOffers, 10).length;
    expect(strict).toBeLessThan(loose);
  });
});

describe("summarizeOffers", () => {
  it("resume a amostra real numa mediana resistente à cauda", () => {
    const stats = summarizeOffers(realOffers);
    if (!stats) throw new Error("esperava estatística para 80 ofertas");

    expect(stats.median).toBeCloseTo(0.05945, 5);
    expect(stats.offerCount).toBe(58);
    expect(stats.rawOfferCount).toBe(80);
    expect(stats.min).toBeCloseTo(0.049, 6);
    expect(stats.max).toBeCloseTo(0.164706, 6);
    expect(stats.p25).toBeLessThan(stats.median);
    expect(stats.p75).toBeGreaterThan(stats.median);
  });

  it("a média bruta seria distorcida pela cauda — a mediana não é", () => {
    const rawMean = REAL_PRICES.reduce((a, b) => a + b, 0) / REAL_PRICES.length;
    const stats = summarizeOffers(realOffers);
    if (!stats) throw new Error("esperava estatística para 80 ofertas");

    // A média sem filtro passa de US$ 13 por causa da listagem de US$ 999,99.
    expect(rawMean).toBeGreaterThan(13);
    expect(stats.median).toBeLessThan(0.07);
  });

  it("devolve null para amostra vazia em vez de lançar", () => {
    expect(summarizeOffers([])).toBeNull();
  });

  it("trata uma oferta única como mediana igual ao próprio preço", () => {
    const stats = summarizeOffers([makeOffer(0.06)]);
    expect(stats?.median).toBe(0.06);
    expect(stats?.offerCount).toBe(1);
  });
});
