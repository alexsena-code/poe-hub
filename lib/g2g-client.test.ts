import { describe, it, expect } from "vitest";
import { fetchG2gOffers, parseG2gTitle, toG2gLeagueLabel } from "./g2g-client";

type FakeOffer = {
  title: string;
  price: number;
};

/**
 * Fake da API de busca do G2G.
 *
 * Reproduz as duas coisas que o client precisa acertar: o envelope
 * `{ payload: { results } }` e a paginação por `page_size`, que só termina
 * quando uma página volta incompleta (a resposta real não traz cursor).
 */
class FakeG2gApi {
  readonly requestedPages: number[] = [];
  readonly requestedQueries: string[] = [];

  constructor(
    private readonly offers: FakeOffer[],
    private readonly pageSize = 100,
  ) {}

  readonly fetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page"));
    this.requestedPages.push(page);
    this.requestedQueries.push(url.searchParams.get("q") ?? "");

    const slice = this.offers.slice((page - 1) * this.pageSize, page * this.pageSize);
    const results = slice.map((o) => ({
      title: o.title,
      converted_unit_price: o.price,
      available_qty: 500,
      min_qty: 10,
      username: "vendedor",
      satisfaction_rate: 1,
    }));

    return new Response(JSON.stringify({ payload: { results } }), { status: 200 });
  };
}

class FailingG2gApi {
  constructor(private readonly status: number) {}

  readonly fetch: typeof fetch = async () =>
    new Response("upstream caiu", { status: this.status });
}

const DIVINE_ALLFLAME = "[PC] Allflame Standard > Divine Orb";

describe("toG2gLeagueLabel", () => {
  it("sufixa a dificuldade na liga temporária", () => {
    expect(toG2gLeagueLabel("Allflame")).toBe("Allflame Standard");
    expect(toG2gLeagueLabel("Allflame", true)).toBe("Allflame Hardcore");
  });

  it("não duplica o nome nas ligas permanentes", () => {
    expect(toG2gLeagueLabel("Standard")).toBe("Standard");
    expect(toG2gLeagueLabel("Hardcore", true)).toBe("Hardcore");
  });
});

describe("parseG2gTitle", () => {
  it("separa plataforma, liga e item", () => {
    expect(parseG2gTitle(DIVINE_ALLFLAME)).toEqual({
      platform: "PC",
      league: "Allflame Standard",
      item: "Divine Orb",
    });
  });

  it("aceita nome de liga com espaços", () => {
    const parts = parseG2gTitle("[PC] Keepers of the Flame Standard > Chaos Orb");
    expect(parts?.league).toBe("Keepers of the Flame Standard");
  });

  it("devolve null para título fora do formato", () => {
    expect(parseG2gTitle("Divine Orb barato")).toBeNull();
  });
});

describe("fetchG2gOffers", () => {
  it("fica só com a liga, plataforma e item pedidos", async () => {
    const api = new FakeG2gApi([
      { title: DIVINE_ALLFLAME, price: 0.06 },
      { title: DIVINE_ALLFLAME, price: 0.07 },
      { title: "[PS4] Allflame Standard > Divine Orb", price: 0.09 },
      { title: "[PC] Standard > Divine Orb", price: 0.02 },
      { title: "[PC] Allflame Hardcore > Divine Orb", price: 0.11 },
      { title: "[PC] Allflame Standard > Chaos Orb", price: 0.0001 },
    ]);

    const result = await fetchG2gOffers({ league: "Allflame", fetchImpl: api.fetch });

    expect(result.offers.map((o) => o.priceUsd)).toEqual([0.06, 0.07]);
    expect(result.g2gLeague).toBe("Allflame Standard");
    expect(result.rawResultCount).toBe(6);
  });

  it("pagina até a página vir incompleta", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      title: DIVINE_ALLFLAME,
      price: 0.05 + i / 10000,
    }));
    const api = new FakeG2gApi(many);

    const result = await fetchG2gOffers({ league: "Allflame", fetchImpl: api.fetch });

    expect(api.requestedPages).toEqual([1, 2]);
    expect(result.offers).toHaveLength(150);
    expect(result.pagesFetched).toBe(2);
  });

  it("para na primeira página quando ela já vem incompleta", async () => {
    const api = new FakeG2gApi([{ title: DIVINE_ALLFLAME, price: 0.06 }]);
    await fetchG2gOffers({ league: "Allflame", fetchImpl: api.fetch });
    expect(api.requestedPages).toEqual([1]);
  });

  it("manda o item como termo de busca — sem isso o Divine nunca aparece", async () => {
    const api = new FakeG2gApi([]);
    await fetchG2gOffers({ league: "Allflame", item: "Chaos Orb", fetchImpl: api.fetch });
    expect(api.requestedQueries[0]).toBe("Chaos Orb");
  });

  it("descarta oferta sem preço utilizável", async () => {
    const api = new FakeG2gApi([
      { title: DIVINE_ALLFLAME, price: 0 },
      { title: DIVINE_ALLFLAME, price: 0.06 },
    ]);
    const result = await fetchG2gOffers({ league: "Allflame", fetchImpl: api.fetch });
    expect(result.offers).toHaveLength(1);
  });

  it("propaga erro HTTP com o status na mensagem", async () => {
    const api = new FailingG2gApi(503);
    await expect(
      fetchG2gOffers({ league: "Allflame", fetchImpl: api.fetch }),
    ).rejects.toThrow(/503/);
  });

  it("devolve amostra vazia quando a liga não existe no G2G", async () => {
    const api = new FakeG2gApi([{ title: DIVINE_ALLFLAME, price: 0.06 }]);
    const result = await fetchG2gOffers({ league: "LigaInexistente", fetchImpl: api.fetch });
    expect(result.offers).toHaveLength(0);
    expect(result.rawResultCount).toBe(1);
  });
});
