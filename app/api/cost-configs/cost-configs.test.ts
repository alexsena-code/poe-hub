import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCostConfigInput,
  createCostConfig,
  cleanupCostConfigs,
} from "@/tests/factories/cost-config.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
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

describe("Cost Configs API", () => {
  beforeEach(async () => {
    await cleanupCostConfigs();
  });

  afterAll(async () => {
    await cleanupCostConfigs();
    await prisma.$disconnect();
  });

  // ============================================================
  // POST /api/cost-configs
  // ============================================================
  describe("POST /api/cost-configs", () => {
    it("should create a cost config", async () => {
      const input = buildCostConfigInput();
      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.name).toBe(input.name);
      expect(body.id).toBeDefined();
      expect(Number(body.proxyCostPerBotMonthly)).toBe(
        input.proxyCostPerBotMonthly
      );
      expect(Number(body.levelingCostPerBot)).toBe(input.levelingCostPerBot);
      expect(Number(body.expluginsKeyCostDaily)).toBe(
        input.expluginsKeyCostDaily
      );
    });

    it("should reject invalid input (missing required fields)", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", {})
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should reject empty name", async () => {
      const input = buildCostConfigInput({ name: "" });
      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", input)
      );
      expect(res.status).toBe(400);
    });

    it("should reject negative costs", async () => {
      const input = buildCostConfigInput({ proxyCostPerBotMonthly: -1 });
      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", input)
      );
      expect(res.status).toBe(400);
    });

    it("should unset other defaults when isDefault is true", async () => {
      const first = await createCostConfig({ isDefault: true });

      const input = buildCostConfigInput({ isDefault: true });
      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", input)
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.isDefault).toBe(true);

      // Previous default should be unset
      const firstUpdated = await prisma.globalCostConfig.findUnique({
        where: { id: first.id },
      });
      expect(firstUpdated!.isDefault).toBe(false);
    });

    it("should default stashPackCostPerBot to 0 when omitted", async () => {
      const input = buildCostConfigInput();
      delete (input as Record<string, unknown>).stashPackCostPerBot;

      const res = await POST(
        jsonReq("http://localhost:3000/api/cost-configs", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(Number(body.stashPackCostPerBot)).toBe(0);
    });
  });

  // ============================================================
  // GET /api/cost-configs
  // ============================================================
  describe("GET /api/cost-configs", () => {
    it("should list configs ordered by isDefault desc, name asc", async () => {
      await createCostConfig({ name: "Zebra", isDefault: false });
      await createCostConfig({ name: "Alpha", isDefault: false });
      await createCostConfig({ name: "Default", isDefault: true });

      const res = await GET(getReq("http://localhost:3000/api/cost-configs"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(3);
      // Default first, then alphabetical
      expect(body.data[0].name).toBe("Default");
      expect(body.data[1].name).toBe("Alpha");
      expect(body.data[2].name).toBe("Zebra");
    });

    it("should include simulation link count", async () => {
      await createCostConfig();

      const res = await GET(getReq("http://localhost:3000/api/cost-configs"));
      const body = await res.json();

      expect(body.data[0]._count).toBeDefined();
      expect(body.data[0]._count.simulationLinks).toBe(0);
    });

    it("should return empty array when no configs exist", async () => {
      const res = await GET(getReq("http://localhost:3000/api/cost-configs"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
    });
  });

  // ============================================================
  // GET /api/cost-configs/[id]
  // ============================================================
  describe("GET /api/cost-configs/[id]", () => {
    it("should get a config by id with simulation links", async () => {
      const config = await createCostConfig({ name: "DetailConfig" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/cost-configs/${config.id}`),
        makeParams(config.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("DetailConfig");
      expect(body.simulationLinks).toBeDefined();
      expect(Array.isArray(body.simulationLinks)).toBe(true);
    });

    it("should return 404 for non-existent config", async () => {
      const res = await GET_BY_ID(
        getReq(
          "http://localhost:3000/api/cost-configs/00000000-0000-0000-0000-000000000000"
        ),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /api/cost-configs/[id]
  // ============================================================
  describe("PUT /api/cost-configs/[id]", () => {
    it("should update a config", async () => {
      const config = await createCostConfig();

      const res = await PUT(
        jsonReq(
          `http://localhost:3000/api/cost-configs/${config.id}`,
          "PUT",
          { name: "UpdatedName", proxyCostPerBotMonthly: 99.99 }
        ),
        makeParams(config.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("UpdatedName");
      expect(Number(body.proxyCostPerBotMonthly)).toBeCloseTo(99.99);
    });

    it("should return 404 for non-existent config", async () => {
      const res = await PUT(
        jsonReq(
          "http://localhost:3000/api/cost-configs/00000000-0000-0000-0000-000000000000",
          "PUT",
          { name: "Test" }
        ),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });

    it("should reject invalid update data", async () => {
      const config = await createCostConfig();

      const res = await PUT(
        jsonReq(
          `http://localhost:3000/api/cost-configs/${config.id}`,
          "PUT",
          { proxyCostPerBotMonthly: -5 }
        ),
        makeParams(config.id)
      );
      expect(res.status).toBe(400);
    });

    it("should handle isDefault toggle on update", async () => {
      const first = await createCostConfig({ isDefault: true });
      const second = await createCostConfig({ isDefault: false });

      const res = await PUT(
        jsonReq(
          `http://localhost:3000/api/cost-configs/${second.id}`,
          "PUT",
          { isDefault: true }
        ),
        makeParams(second.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.isDefault).toBe(true);

      // First should no longer be default
      const firstUpdated = await prisma.globalCostConfig.findUnique({
        where: { id: first.id },
      });
      expect(firstUpdated!.isDefault).toBe(false);
    });

    it("should allow partial update (only name)", async () => {
      const config = await createCostConfig();
      const originalProxy = Number(config.proxyCostPerBotMonthly);

      const res = await PUT(
        jsonReq(
          `http://localhost:3000/api/cost-configs/${config.id}`,
          "PUT",
          { name: "OnlyNameChanged" }
        ),
        makeParams(config.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("OnlyNameChanged");
      expect(Number(body.proxyCostPerBotMonthly)).toBe(originalProxy);
    });
  });

  // ============================================================
  // DELETE /api/cost-configs/[id]
  // ============================================================
  describe("DELETE /api/cost-configs/[id]", () => {
    it("should delete a config", async () => {
      const config = await createCostConfig();

      const res = await DELETE(
        new NextRequest(
          `http://localhost:3000/api/cost-configs/${config.id}`,
          { method: "DELETE" }
        ),
        makeParams(config.id)
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      const dbConfig = await prisma.globalCostConfig.findUnique({
        where: { id: config.id },
      });
      expect(dbConfig).toBeNull();
    });

    it("should return 404 for non-existent config", async () => {
      const res = await DELETE(
        new NextRequest(
          "http://localhost:3000/api/cost-configs/00000000-0000-0000-0000-000000000000",
          { method: "DELETE" }
        ),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });

    it("should return 409 when config is linked to simulations", async () => {
      const config = await createCostConfig();

      // Create a simulation and link it
      const simulation = await prisma.simulation.create({
        data: {
          name: "TestSim",
          league: "TestLeague",
          durationWeeks: 4,
          status: "draft",
        },
      });

      await prisma.simulationCostLink.create({
        data: {
          simulationId: simulation.id,
          costConfigId: config.id,
        },
      });

      const res = await DELETE(
        new NextRequest(
          `http://localhost:3000/api/cost-configs/${config.id}`,
          { method: "DELETE" }
        ),
        makeParams(config.id)
      );
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.linkedSimulations).toBe(1);

      // Config should still exist
      const dbConfig = await prisma.globalCostConfig.findUnique({
        where: { id: config.id },
      });
      expect(dbConfig).not.toBeNull();

      // Cleanup
      await prisma.simulationCostLink.deleteMany();
      await prisma.simulation.deleteMany();
    });
  });
});
