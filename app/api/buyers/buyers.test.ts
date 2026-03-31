import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createBuyer,
  createSale,
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

describe("Buyers API", () => {
  beforeEach(async () => {
    await cleanupSales();
  });

  afterAll(async () => {
    await cleanupSales();
    await prisma.$disconnect();
  });

  describe("POST /api/buyers", () => {
    it("should create a buyer", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/buyers", "POST", {
          name: "NewBuyer",
          isCnl: true,
          contact: "discord#1234",
        })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("NewBuyer");
      expect(body.isCnl).toBe(true);
      expect(body.contact).toBe("discord#1234");
    });

    it("should reject missing name", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/buyers", "POST", { isCnl: false })
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should create buyer with defaults", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/buyers", "POST", { name: "MinimalBuyer" })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.isCnl).toBe(false);
      expect(body.contact).toBeNull();
      expect(body.notes).toBeNull();
    });
  });

  describe("GET /api/buyers", () => {
    it("should list all buyers ordered by name", async () => {
      await createBuyer({ name: "Zeta" });
      await createBuyer({ name: "Alpha" });
      await createBuyer({ name: "Middle" });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].name).toBe("Alpha");
      expect(body.data[1].name).toBe("Middle");
      expect(body.data[2].name).toBe("Zeta");
    });
  });

  describe("GET /api/buyers/[id]", () => {
    it("should get a buyer by id", async () => {
      const buyer = await createBuyer({ name: "GetMeBuyer" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/buyers/${buyer.id}`),
        makeParams(buyer.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("GetMeBuyer");
    });

    it("should return 404 for non-existent buyer", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/buyers/00000000-0000-0000-0000-000000000000"),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/buyers/[id]", () => {
    it("should update a buyer", async () => {
      const buyer = await createBuyer();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/buyers/${buyer.id}`, "PUT", {
          name: "UpdatedName",
          isCnl: true,
        }),
        makeParams(buyer.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("UpdatedName");
      expect(body.isCnl).toBe(true);
    });

    it("should return 404 for non-existent buyer", async () => {
      const res = await PUT(
        jsonReq("http://localhost:3000/api/buyers/00000000-0000-0000-0000-000000000000", "PUT", {
          name: "Test",
        }),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/buyers/[id]", () => {
    it("should delete a buyer without sales", async () => {
      const buyer = await createBuyer();

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/buyers/${buyer.id}`, { method: "DELETE" }),
        makeParams(buyer.id)
      );
      expect(res.status).toBe(200);

      const dbBuyer = await prisma.buyer.findUnique({ where: { id: buyer.id } });
      expect(dbBuyer).toBeNull();
    });

    it("should return 409 when deleting buyer with sales", async () => {
      const buyer = await createBuyer();
      await createSale(buyer.id);

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/buyers/${buyer.id}`, { method: "DELETE" }),
        makeParams(buyer.id)
      );
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toBe("Cannot delete buyer with existing sales");
    });

    it("should return 404 for non-existent buyer", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/buyers/00000000-0000-0000-0000-000000000000", {
          method: "DELETE",
        }),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });
});
