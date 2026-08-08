import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildSaleInput,
  createSale,
  createBuyer,
  cleanupSales,
} from "@/tests/factories/sale.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_BY_ID, PUT, DELETE } from "./[id]/route";

function jsonReq(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(url: string) {
  return new NextRequest(url);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Sales API", () => {
  beforeEach(async () => {
    await cleanupSales();
  });

  afterAll(async () => {
    await cleanupSales();
    await prisma.$disconnect();
  });

  describe("POST /api/sales", () => {
    it("should create a sale", async () => {
      const buyer = await createBuyer();
      const input = buildSaleInput(buyer.id);

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.buyerId).toBe(buyer.id);
      expect(body.buyer.name).toBe(buyer.name);
      expect(body.league).toBe(input.league);
    });

    it("should validate required fields", async () => {
      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", {}));
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should reject missing date", async () => {
      const buyer = await createBuyer();
      const input = buildSaleInput(buyer.id);
      const { date: _, ...noDate } = input;

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", noDate));
      expect(res.status).toBe(400);
    });

    it("should reject missing buyerId", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/sales", "POST", {
          date: "2026-01-01",
          quantity: 10,
          league: "Test",
        })
      );
      expect(res.status).toBe(400);
    });

    // Regressão: o buyer "CNL" é semeado com id fixo ("cnl-buyer", ver
    // prisma/seed.ts). Enquanto buyerId exigia `.uuid()`, registrar uma venda
    // para ele falhava com "Validation failed".
    it("should accept a buyer whose id is not a UUID", async () => {
      const buyer = await prisma.buyer.create({
        data: { id: "cnl-buyer", name: "CNL", isCnl: true },
      });
      const input = buildSaleInput(buyer.id);

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.buyerId).toBe("cnl-buyer");
    });

    it("should reject non-existent buyer", async () => {
      const input = buildSaleInput("00000000-0000-0000-0000-000000000000");

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("Buyer not found");
    });

    it("should auto-calculate totalUsd from quantity * divinePriceUsd", async () => {
      const buyer = await createBuyer();
      const input = buildSaleInput(buyer.id, {
        quantity: 5,
        divinePriceUsd: 2.0,
        divinePriceBrl: 10.0,
        totalUsd: null,
        totalBrl: null,
      });

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      // 5 * 2.0 = 10.0
      expect(parseFloat(body.totalUsd)).toBeCloseTo(10.0);
      // 5 * 10.0 = 50.0
      expect(parseFloat(body.totalBrl)).toBeCloseTo(50.0);
    });

    it("should use provided totals instead of calculating", async () => {
      const buyer = await createBuyer();
      const input = buildSaleInput(buyer.id, {
        quantity: 5,
        divinePriceUsd: 2.0,
        totalUsd: 99.99,
      });

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(parseFloat(body.totalUsd)).toBeCloseTo(99.99);
    });

    it("should create sale with default unit divine", async () => {
      const buyer = await createBuyer();
      const { unit: _, ...input } = buildSaleInput(buyer.id);

      const res = await POST(jsonReq("http://localhost:3000/api/sales", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.unit).toBe("divine");
    });
  });

  describe("GET /api/sales", () => {
    it("should list sales with pagination", async () => {
      const buyer = await createBuyer();
      await createSale(buyer.id, { league: "League-A" });
      await createSale(buyer.id, { league: "League-B" });
      await createSale(buyer.id, { league: "League-C" });

      const res = await GET(getReq("http://localhost:3000/api/sales?page=1&limit=2"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });

    it("should include buyer relation in list", async () => {
      const buyer = await createBuyer({ name: "BuyerWithName", isCnl: true });
      await createSale(buyer.id);

      const res = await GET(getReq("http://localhost:3000/api/sales"));
      const body = await res.json();

      expect(body.data[0].buyer).toBeDefined();
      expect(body.data[0].buyer.name).toBe("BuyerWithName");
      expect(body.data[0].buyer.isCnl).toBe(true);
    });

    it("should filter by date range", async () => {
      const buyer = await createBuyer();
      await createSale(buyer.id, { date: "2026-01-15" });
      await createSale(buyer.id, { date: "2026-06-15" });
      await createSale(buyer.id, { date: "2026-12-15" });

      const res = await GET(
        getReq("http://localhost:3000/api/sales?dateFrom=2026-01-01&dateTo=2026-06-30")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(2);
    });

    it("should filter by buyerId", async () => {
      const buyer1 = await createBuyer({ name: "Buyer1" });
      const buyer2 = await createBuyer({ name: "Buyer2" });
      await createSale(buyer1.id);
      await createSale(buyer2.id);

      const res = await GET(
        getReq(`http://localhost:3000/api/sales?buyerId=${buyer1.id}`)
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].buyerId).toBe(buyer1.id);
    });

    it("should filter by league", async () => {
      const buyer = await createBuyer();
      await createSale(buyer.id, { league: "Settlers" });
      await createSale(buyer.id, { league: "Necropolis" });

      const res = await GET(getReq("http://localhost:3000/api/sales?league=Settlers"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].league).toBe("Settlers");
    });

    it("should return empty list when no sales match", async () => {
      const res = await GET(getReq("http://localhost:3000/api/sales?league=NonExistent"));
      const body = await res.json();

      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe("GET /api/sales/[id]", () => {
    it("should get a sale by id with buyer", async () => {
      const buyer = await createBuyer({ name: "GetMeBuyer" });
      const sale = await createSale(buyer.id);

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/sales/${sale.id}`),
        makeParams(sale.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe(sale.id);
      expect(body.buyer.name).toBe("GetMeBuyer");
    });

    it("should return 404 for non-existent sale", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/sales/00000000-0000-0000-0000-000000000000"),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/sales/[id]", () => {
    it("should update a sale", async () => {
      const buyer = await createBuyer();
      const sale = await createSale(buyer.id);

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/sales/${sale.id}`, "PUT", {
          league: "UpdatedLeague",
          notes: "Updated notes",
        }),
        makeParams(sale.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.league).toBe("UpdatedLeague");
      expect(body.notes).toBe("Updated notes");
    });

    it("should return 404 for non-existent sale", async () => {
      const res = await PUT(
        jsonReq("http://localhost:3000/api/sales/00000000-0000-0000-0000-000000000000", "PUT", {
          league: "Test",
        }),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/sales/[id]", () => {
    it("should delete a sale", async () => {
      const buyer = await createBuyer();
      const sale = await createSale(buyer.id);

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/sales/${sale.id}`, { method: "DELETE" }),
        makeParams(sale.id)
      );
      expect(res.status).toBe(200);

      const dbSale = await prisma.sale.findUnique({ where: { id: sale.id } });
      expect(dbSale).toBeNull();
    });

    it("should return 404 for non-existent sale", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/sales/00000000-0000-0000-0000-000000000000", {
          method: "DELETE",
        }),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });
});
