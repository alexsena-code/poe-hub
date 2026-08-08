import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";

/** Simula requisição sem cookie de sessão — o caso do cron. */
function withoutSession() {
  vi.mocked(getServerSession).mockResolvedValueOnce(null);
}

/**
 * Fake da API do G2G instalado no fetch global.
 *
 * A rota não expõe injeção de `fetchImpl` (só o collector expõe), então o
 * ponto de costura em teste de rota é o fetch global mesmo.
 */
function stubG2gApi(prices: number[], league = "Allflame Standard") {
  const results = prices.map((price) => ({
    title: `[PC] ${league} > Divine Orb`,
    converted_unit_price: price,
    available_qty: 500,
    min_qty: 10,
    username: "vendedor",
    satisfaction_rate: 1,
  }));

  const fake = vi.fn(async () =>
    new Response(JSON.stringify({ payload: { results } }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fake);
  return fake;
}

function stubG2gFailure(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("erro", { status })),
  );
}

async function cleanupSnapshots() {
  await prisma.g2gPriceSnapshot.deleteMany();
}

async function seedSnapshot(overrides: { collectedAt?: Date; median?: number } = {}) {
  return prisma.g2gPriceSnapshot.create({
    data: {
      item: "Divine Orb",
      league: "Allflame",
      g2gLeague: "Allflame Standard",
      platform: "PC",
      currency: "usd",
      median: overrides.median ?? 0.06,
      mean: 0.062,
      min: 0.049,
      max: 0.09,
      p25: 0.053,
      p75: 0.075,
      offerCount: 50,
      rawOfferCount: 70,
      collectedAt: overrides.collectedAt ?? new Date(),
    },
  });
}

describe("G2G prices API", () => {
  beforeEach(async () => {
    await cleanupSnapshots();
    vi.unstubAllGlobals();
    // Reset explícito: quando o Bearer autentica, `getServerSession` nem é
    // chamado, então um `mockResolvedValueOnce` não consumido vazaria para o
    // teste seguinte e o faria falhar por engano.
    vi.mocked(getServerSession).mockReset();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id", name: "admin", role: "admin" },
    });
  });

  afterAll(async () => {
    await cleanupSnapshots();
    vi.unstubAllGlobals();
  });

  describe("GET /api/prices/g2g", () => {
    it("devolve série vazia quando não há coleta", async () => {
      const res = await GET(new NextRequest("http://localhost/api/prices/g2g"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.latest).toBeNull();
    });

    it("devolve os snapshots em ordem crescente de tempo", async () => {
      const older = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await seedSnapshot({ collectedAt: older, median: 0.05 });
      await seedSnapshot({ median: 0.07 });

      const res = await GET(new NextRequest("http://localhost/api/prices/g2g"));
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      expect(body.data[0].median).toBe(0.05);
      expect(body.data[1].median).toBe(0.07);
      // `latest` é o mais recente, independente da ordem de `data`.
      expect(body.latest.median).toBe(0.07);
    });

    it("converte Decimal do Prisma em número no JSON", async () => {
      await seedSnapshot({ median: 0.06 });
      const res = await GET(new NextRequest("http://localhost/api/prices/g2g"));
      const body = await res.json();

      expect(typeof body.data[0].median).toBe("number");
      expect(typeof body.data[0].p25).toBe("number");
    });

    it("exclui snapshot fora da janela de dias pedida", async () => {
      const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await seedSnapshot({ collectedAt: longAgo });

      const res = await GET(
        new NextRequest("http://localhost/api/prices/g2g?days=7"),
      );
      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });

    // Regressão: `Number(null)` é 0 e passa no isFinite, então o clamp
    // devolvia 1 e a série inteira virava um único ponto sem `?limit=`.
    it("sem ?limit= devolve a série inteira, não um ponto só", async () => {
      for (let i = 0; i < 3; i += 1) {
        await seedSnapshot({ collectedAt: new Date(Date.now() - i * 60_000) });
      }

      const res = await GET(new NextRequest("http://localhost/api/prices/g2g"));
      expect((await res.json()).data).toHaveLength(3);
    });

    it("respeita ?limit= quando informado", async () => {
      for (let i = 0; i < 3; i += 1) {
        await seedSnapshot({ collectedAt: new Date(Date.now() - i * 60_000) });
      }

      const res = await GET(
        new NextRequest("http://localhost/api/prices/g2g?limit=2"),
      );
      expect((await res.json()).data).toHaveLength(2);
    });

    it("filtra por liga", async () => {
      await seedSnapshot();
      const res = await GET(
        new NextRequest("http://localhost/api/prices/g2g?league=Mirage"),
      );
      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });
  });

  describe("POST /api/prices/g2g", () => {
    it("coleta e grava um snapshot", async () => {
      stubG2gApi([0.05, 0.06, 0.07, 0.08]);

      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "Allflame" }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.stats.median).toBeCloseTo(0.065, 6);
      expect(body.g2gLeague).toBe("Allflame Standard");

      const saved = await prisma.g2gPriceSnapshot.findMany();
      expect(saved).toHaveLength(1);
      expect(Number(saved[0].median)).toBeCloseTo(0.065, 6);
    });

    it("em dryRun calcula mas não grava", async () => {
      stubG2gApi([0.05, 0.06, 0.07, 0.08]);

      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "Allflame", dryRun: true }),
        }),
      );

      expect(res.status).toBe(200);
      expect(await prisma.g2gPriceSnapshot.count()).toBe(0);
    });

    it("responde 502 quando a liga não casa com nenhuma oferta", async () => {
      stubG2gApi([0.05, 0.06], "Outra Liga Standard");

      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "Allflame" }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(502);
      expect(body.error).toMatch(/nenhuma oferta/i);
      expect(await prisma.g2gPriceSnapshot.count()).toBe(0);
    });

    it("responde 502 quando o G2G devolve erro HTTP", async () => {
      stubG2gFailure(503);

      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "Allflame" }),
        }),
      );

      expect(res.status).toBe(502);
      expect(await prisma.g2gPriceSnapshot.count()).toBe(0);
    });

    it("rejeita payload inválido com 400", async () => {
      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "" }),
        }),
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Validation failed");
    });
  });

  // A Scheduled Task do Coolify roda dentro do container e não tem cookie.
  describe("POST autenticado por CRON_SECRET", () => {
    const OLD_SECRET = process.env.CRON_SECRET;

    afterAll(() => {
      process.env.CRON_SECRET = OLD_SECRET;
    });

    function cronReq(token: string | null) {
      return new NextRequest("http://localhost/api/prices/g2g", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ league: "Allflame" }),
      });
    }

    it("aceita o Bearer correto sem sessão", async () => {
      process.env.CRON_SECRET = "segredo-de-teste";
      stubG2gApi([0.05, 0.06, 0.07, 0.08]);
      withoutSession();

      const res = await POST(cronReq("segredo-de-teste"));

      expect(res.status).toBe(201);
      expect(await prisma.g2gPriceSnapshot.count()).toBe(1);
    });

    it("rejeita Bearer errado com 401", async () => {
      process.env.CRON_SECRET = "segredo-de-teste";
      withoutSession();

      expect((await POST(cronReq("segredo-errado"))).status).toBe(401);
      expect(await prisma.g2gPriceSnapshot.count()).toBe(0);
    });

    it("rejeita quando não há sessão nem Bearer", async () => {
      process.env.CRON_SECRET = "segredo-de-teste";
      withoutSession();

      expect((await POST(cronReq(null))).status).toBe(401);
    });

    // Sem a variável no ambiente o caminho do cron fica desligado por inteiro.
    it("não autentica quando CRON_SECRET não está configurado", async () => {
      delete process.env.CRON_SECRET;
      withoutSession();

      expect((await POST(cronReq("qualquer-coisa"))).status).toBe(401);
    });

    // Bearer de tamanho diferente não pode explodir no timingSafeEqual.
    it("rejeita Bearer de tamanho diferente sem lançar", async () => {
      process.env.CRON_SECRET = "segredo-de-teste";
      withoutSession();

      expect((await POST(cronReq("x"))).status).toBe(401);
    });

    it("sessão continua valendo mesmo sem Bearer", async () => {
      process.env.CRON_SECRET = "segredo-de-teste";
      stubG2gApi([0.05, 0.06, 0.07, 0.08]);

      expect((await POST(cronReq(null))).status).toBe(201);
    });
  });

  describe("validação", () => {
    it("rejeita payload inválido com 400 (com sessão)", async () => {
      const res = await POST(
        new NextRequest("http://localhost/api/prices/g2g", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league: "" }),
        }),
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Validation failed");
    });
  });
});
