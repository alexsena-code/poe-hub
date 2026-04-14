import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildSimulationInput,
  createSimulation,
  createCostConfig,
  cleanupSimulations,
} from "@/tests/factories/simulation.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_BY_ID, PUT, DELETE } from "./[id]/route";
import { POST as DUPLICATE } from "./[id]/duplicate/route";

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

describe("Simulations API", () => {
  beforeEach(async () => {
    await cleanupSimulations();
  });

  afterAll(async () => {
    await cleanupSimulations();
    await prisma.$disconnect();
  });

  // ============================================================
  // POST /api/simulations
  // ============================================================

  describe("POST /api/simulations", () => {
    it("should create a simulation with weeks and days", async () => {
      const input = buildSimulationInput({ durationWeeks: 3 });
      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.name).toBe(input.name);
      expect(body.league).toBe(input.league);
      expect(body.durationWeeks).toBe(3);
      expect(body.status).toBe("draft");
      expect(body.weeks).toHaveLength(3);
      expect(body.weeks[0].days).toHaveLength(7);
      expect(body.weeks[0].weekNumber).toBe(1);
      expect(body.weeks[0].days[0].dayNumber).toBe(1);
    });

    it("should create a simulation with costConfigIds", async () => {
      const config = await createCostConfig();
      const input = buildSimulationInput({ costConfigIds: [config.id] });

      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.costLinks).toHaveLength(1);
      expect(body.costLinks[0].costConfig.id).toBe(config.id);
    });

    it("should reject invalid cost config IDs", async () => {
      const input = buildSimulationInput({
        costConfigIds: ["00000000-0000-0000-0000-000000000000"],
      });

      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", input)
      );
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toContain("cost config");
    });

    it("should reject missing required fields", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", {})
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should reject invalid durationWeeks", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", {
          name: "Test",
          league: "TestLeague",
          durationWeeks: 0,
        })
      );
      expect(res.status).toBe(400);
    });

    it("should reject durationWeeks > 52", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/simulations", "POST", {
          name: "Test",
          league: "TestLeague",
          durationWeeks: 53,
        })
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/simulations
  // ============================================================

  describe("GET /api/simulations", () => {
    it("should list simulations with pagination", async () => {
      await createSimulation({ name: "Sim-A" });
      await createSimulation({ name: "Sim-B" });
      await createSimulation({ name: "Sim-C" });

      const res = await GET(
        getReq("http://localhost:3000/api/simulations?page=1&limit=2")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });

    it("should filter by status", async () => {
      await createSimulation({ status: "active" });
      await createSimulation({ status: "draft" });

      const res = await GET(
        getReq("http://localhost:3000/api/simulations?status=active")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("active");
    });

    it("should filter by league", async () => {
      await createSimulation({ league: "Settlers" });
      await createSimulation({ league: "Necropolis" });

      const res = await GET(
        getReq("http://localhost:3000/api/simulations?league=Settlers")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].league).toBe("Settlers");
    });

    it("should search by name", async () => {
      await createSimulation({ name: "RF Farming" });
      await createSimulation({ name: "MF Culler" });

      const res = await GET(
        getReq("http://localhost:3000/api/simulations?search=RF")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("RF Farming");
    });

    it("should include calculated totals", async () => {
      await createSimulation();

      const res = await GET(getReq("http://localhost:3000/api/simulations"));
      const body = await res.json();

      expect(body.data[0].totals).toBeDefined();
      expect(body.data[0].totals).toHaveProperty("revenueUsd");
      expect(body.data[0].totals).toHaveProperty("revenueBrl");
      expect(body.data[0].totals).toHaveProperty("cost");
      expect(body.data[0].totals).toHaveProperty("profit");
      expect(body.data[0].totals).toHaveProperty("roi");
    });

    it("should not include weeks in list response", async () => {
      await createSimulation();

      const res = await GET(getReq("http://localhost:3000/api/simulations"));
      const body = await res.json();

      expect(body.data[0].weeks).toBeUndefined();
    });
  });

  // ============================================================
  // GET /api/simulations/[id]
  // ============================================================

  describe("GET /api/simulations/[id]", () => {
    it("should get a simulation by id with weeks and calculated fields", async () => {
      const sim = await createSimulation({ name: "DetailSim" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/simulations/${sim.id}`),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("DetailSim");
      expect(body.weeks).toBeDefined();
      expect(body.weeks.length).toBeGreaterThan(0);
      expect(body.calculated).toBeDefined();
      expect(body.calculated).toHaveProperty("totalDivines");
      expect(body.calculated).toHaveProperty("totalRevenueUsd");
      expect(body.calculated).toHaveProperty("totalRevenueBrl");
      expect(body.calculated).toHaveProperty("totalCostUsd");
      expect(body.calculated).toHaveProperty("totalProfitUsd");
      expect(body.calculated).toHaveProperty("roi");
      expect(body.calculated).toHaveProperty("breakEvenWeek");
    });

    it("should include per-week calculated fields", async () => {
      const sim = await createSimulation();

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/simulations/${sim.id}`),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(body.weeks[0].calculated).toBeDefined();
      expect(body.weeks[0].calculated).toHaveProperty("totalDivines");
      expect(body.weeks[0].calculated).toHaveProperty("revenueUsd");
      expect(body.weeks[0].calculated).toHaveProperty("costUsd");
      expect(body.weeks[0].calculated).toHaveProperty("profitUsd");
      expect(body.weeks[0].calculated).toHaveProperty("maxActiveBots");
    });

    it("should return 404 for non-existent simulation", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/simulations/nonexistent"),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /api/simulations/[id]
  // ============================================================

  describe("PUT /api/simulations/[id]", () => {
    it("should update simulation fields", async () => {
      const sim = await createSimulation();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/simulations/${sim.id}`, "PUT", {
          name: "Updated Name",
          status: "active",
        }),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("Updated Name");
      expect(body.status).toBe("active");
    });

    it("should link cost config via costConfigIds", async () => {
      const sim = await createSimulation();
      const config = await createCostConfig();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/simulations/${sim.id}`, "PUT", {
          costConfigIds: [config.id],
        }),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.costLinks).toHaveLength(1);
      expect(body.costLinks[0].costConfig.id).toBe(config.id);
    });

    it("should reject invalid cost config IDs on update", async () => {
      const sim = await createSimulation();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/simulations/${sim.id}`, "PUT", {
          costConfigIds: ["00000000-0000-0000-0000-000000000000"],
        }),
        makeParams(sim.id)
      );
      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent simulation", async () => {
      const res = await PUT(
        jsonReq("http://localhost:3000/api/simulations/fake-id", "PUT", {
          name: "Test",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });

    it("should reject invalid status on update", async () => {
      const sim = await createSimulation();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/simulations/${sim.id}`, "PUT", {
          status: "invalid_status",
        }),
        makeParams(sim.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // DELETE /api/simulations/[id]
  // ============================================================

  describe("DELETE /api/simulations/[id]", () => {
    it("should delete a simulation and cascade to weeks/days", async () => {
      const sim = await createSimulation();
      const weekId = sim.weeks[0].id;

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/simulations/${sim.id}`, {
          method: "DELETE",
        }),
        makeParams(sim.id)
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify cascade deletion
      const dbSim = await prisma.simulation.findUnique({
        where: { id: sim.id },
      });
      expect(dbSim).toBeNull();

      const dbWeek = await prisma.simulationWeek.findUnique({
        where: { id: weekId },
      });
      expect(dbWeek).toBeNull();
    });

    it("should return 404 for non-existent simulation", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/simulations/fake-id", {
          method: "DELETE",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /api/simulations/[id]/duplicate
  // ============================================================

  describe("POST /api/simulations/[id]/duplicate", () => {
    it("should duplicate a simulation with weeks and days", async () => {
      const sim = await createSimulation({ name: "Original Sim" });

      const res = await DUPLICATE(
        jsonReq(
          `http://localhost:3000/api/simulations/${sim.id}/duplicate`,
          "POST",
          {}
        ),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).not.toBe(sim.id);
      expect(body.name).toBe("Original Sim (cópia)");
      expect(body.league).toBe(sim.league);
      expect(body.status).toBe("draft");
      expect(body.durationWeeks).toBe(sim.durationWeeks);
      expect(body.weeks).toHaveLength(sim.weeks.length);
      expect(body.weeks[0].days).toHaveLength(7);
    });

    it("should duplicate cost links", async () => {
      const config = await createCostConfig();
      const sim = await createSimulation();

      // Link cost config to original
      await prisma.simulationCostLink.create({
        data: { simulationId: sim.id, costConfigId: config.id },
      });

      const res = await DUPLICATE(
        jsonReq(
          `http://localhost:3000/api/simulations/${sim.id}/duplicate`,
          "POST",
          {}
        ),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.costLinks).toHaveLength(1);
      expect(body.costLinks[0].costConfig.id).toBe(config.id);
    });

    it("should preserve week and day values in duplicate", async () => {
      const sim = await createSimulation();

      // Update a week's defaults to non-default values
      await prisma.simulationWeek.update({
        where: { id: sim.weeks[0].id },
        data: {
          defaultActiveBots: 5,
          defaultDivinePerHour: 2.0,
          label: "Custom Week",
        },
      });

      // Update a day with override values
      await prisma.simulationDay.update({
        where: { id: sim.weeks[0].days[0].id },
        data: {
          activeBots: 10,
          divinePerHour: 3.0,
          overrideNotes: "test override",
        },
      });

      const res = await DUPLICATE(
        jsonReq(
          `http://localhost:3000/api/simulations/${sim.id}/duplicate`,
          "POST",
          {}
        ),
        makeParams(sim.id)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.weeks[0].defaultActiveBots).toBe(5);
      expect(body.weeks[0].label).toBe("Custom Week");
      expect(body.weeks[0].days[0].activeBots).toBe(10);
      expect(body.weeks[0].days[0].overrideNotes).toBe("test override");
    });

    it("should return 404 for non-existent simulation", async () => {
      const res = await DUPLICATE(
        jsonReq(
          "http://localhost:3000/api/simulations/fake-id/duplicate",
          "POST",
          {}
        ),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });
});
