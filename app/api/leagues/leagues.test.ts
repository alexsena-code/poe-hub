import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildLeagueInput,
  createLeague,
  cleanupLeagues,
} from "@/tests/factories/league.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_BY_ID, PUT } from "./[id]/route";

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

describe("Leagues API", () => {
  beforeEach(async () => {
    await cleanupLeagues();
  });

  afterAll(async () => {
    await cleanupLeagues();
    await prisma.$disconnect();
  });

  // ============================================================
  // POST /api/leagues
  // ============================================================
  describe("POST /api/leagues", () => {
    it("should create a league", async () => {
      const input = buildLeagueInput({ poeVersion: "poe2" });
      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.name).toBe(input.name);
      expect(body.poeVersion).toBe("poe2");
      expect(body.id).toBeDefined();
    });

    it("should create a league with dates", async () => {
      const input = buildLeagueInput({
        startDate: "2025-01-10",
        endDate: "2025-04-10",
      });
      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.startDate).toBeDefined();
      expect(body.endDate).toBeDefined();
    });

    it("should default isCurrent to false", async () => {
      const input = buildLeagueInput();
      delete (input as Record<string, unknown>).isCurrent;

      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.isCurrent).toBe(false);
    });

    it("should reject empty name", async () => {
      const input = buildLeagueInput({ name: "" });
      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", input)
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should reject missing required fields", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", {})
      );
      expect(res.status).toBe(400);
    });

    it("should reject invalid poeVersion", async () => {
      const input = buildLeagueInput({ poeVersion: "poe3" });
      const res = await POST(
        jsonReq("http://localhost:3000/api/leagues", "POST", input)
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/leagues
  // ============================================================
  describe("GET /api/leagues", () => {
    it("should list leagues ordered by isCurrent desc, startDate desc, name asc", async () => {
      await createLeague({ name: "Old League", isCurrent: false, startDate: "2024-01-01" });
      await createLeague({ name: "Current League", isCurrent: true, startDate: "2025-01-01" });
      await createLeague({ name: "Another League", isCurrent: false, startDate: "2024-06-01" });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(3);
      // Current league first
      expect(body[0].name).toBe("Current League");
    });

    it("should return empty array when no leagues exist", async () => {
      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(0);
    });
  });

  // ============================================================
  // GET /api/leagues/[id]
  // ============================================================
  describe("GET /api/leagues/[id]", () => {
    it("should get a league by id", async () => {
      const league = await createLeague({ name: "FindMe" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/leagues/${league.id}`),
        makeParams(league.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("FindMe");
    });

    it("should return 404 for non-existent league", async () => {
      const res = await GET_BY_ID(
        getReq(
          "http://localhost:3000/api/leagues/00000000-0000-0000-0000-000000000000"
        ),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /api/leagues/[id]
  // ============================================================
  describe("PUT /api/leagues/[id]", () => {
    it("should update a league", async () => {
      const league = await createLeague();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/leagues/${league.id}`, "PUT", {
          name: "UpdatedLeague",
          poeVersion: "poe1",
        }),
        makeParams(league.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("UpdatedLeague");
      expect(body.poeVersion).toBe("poe1");
    });

    it("should allow partial update (only name)", async () => {
      const league = await createLeague({ poeVersion: "poe2" });

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/leagues/${league.id}`, "PUT", {
          name: "OnlyNameChanged",
        }),
        makeParams(league.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("OnlyNameChanged");
      expect(body.poeVersion).toBe("poe2");
    });

    it("should update dates", async () => {
      const league = await createLeague();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/leagues/${league.id}`, "PUT", {
          startDate: "2025-03-01",
          endDate: "2025-06-01",
        }),
        makeParams(league.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.startDate).toBeDefined();
      expect(body.endDate).toBeDefined();
    });

    it("should set dates to null", async () => {
      const league = await createLeague({
        startDate: "2025-01-01",
        endDate: "2025-04-01",
      });

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/leagues/${league.id}`, "PUT", {
          startDate: null,
          endDate: null,
        }),
        makeParams(league.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.startDate).toBeNull();
      expect(body.endDate).toBeNull();
    });

    it("should return 404 for non-existent league", async () => {
      const res = await PUT(
        jsonReq(
          "http://localhost:3000/api/leagues/00000000-0000-0000-0000-000000000000",
          "PUT",
          { name: "Test" }
        ),
        makeParams("00000000-0000-0000-0000-000000000000")
      );
      expect(res.status).toBe(404);
    });

    it("should reject invalid update data", async () => {
      const league = await createLeague();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/leagues/${league.id}`, "PUT", {
          poeVersion: "invalid",
        }),
        makeParams(league.id)
      );
      expect(res.status).toBe(400);
    });
  });

});
