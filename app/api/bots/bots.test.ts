import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { buildBotInput, createBot, cleanupBots } from "@/tests/factories/bot.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_BY_ID, PUT, DELETE } from "./[id]/route";
import { PATCH } from "./[id]/status/route";

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

describe("Bots API", () => {
  beforeEach(async () => {
    await cleanupBots();
  });

  afterAll(async () => {
    await cleanupBots();
    await prisma.$disconnect();
  });

  describe("POST /api/bots", () => {
    it("should create a bot with encrypted fields", async () => {
      const input = buildBotInput();
      const res = await POST(jsonReq("http://localhost:3000/api/bots", "POST", input));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.nick).toBe(input.nick);
      expect(body.email).toBe(input.email);
      expect(body.password).toBe("••••••••");
      expect(body.id).toBeDefined();

      // Verify encryption in DB
      const dbBot = await prisma.bot.findUnique({ where: { id: body.id } });
      expect(dbBot).not.toBeNull();
      expect(decrypt(dbBot!.password)).toBe(input.password);
    });

    it("should reject invalid input", async () => {
      const res = await POST(jsonReq("http://localhost:3000/api/bots", "POST", { nick: "" }));
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("should reject missing required fields", async () => {
      const res = await POST(jsonReq("http://localhost:3000/api/bots", "POST", {}));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/bots", () => {
    it("should list bots with pagination", async () => {
      await createBot({ nick: "Bot-A" });
      await createBot({ nick: "Bot-B" });
      await createBot({ nick: "Bot-C" });

      const res = await GET(getReq("http://localhost:3000/api/bots?page=1&limit=2"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });

    it("should filter by status", async () => {
      await createBot({ status: "active" });
      await createBot({ status: "banned" });

      const res = await GET(getReq("http://localhost:3000/api/bots?status=active"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("active");
    });

    it("should search by nick", async () => {
      await createBot({ nick: "Luizina" });
      await createBot({ nick: "Sister" });

      const res = await GET(getReq("http://localhost:3000/api/bots?search=luiz"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].nick).toBe("Luizina");
    });

    it("should mask sensitive fields in list", async () => {
      await createBot();

      const res = await GET(getReq("http://localhost:3000/api/bots"));
      const body = await res.json();

      expect(body.data[0].password).toBe("••••••••");
    });
  });

  describe("GET /api/bots/[id]", () => {
    it("should get a bot by id", async () => {
      const bot = await createBot({ nick: "GetMe" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/bots/${bot.id}`),
        makeParams(bot.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.nick).toBe("GetMe");
      expect(body.password).toBe("••••••••");
    });

    it("should reveal secrets when requested", async () => {
      const bot = await createBot();

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/bots/${bot.id}?reveal=true`),
        makeParams(bot.id)
      );
      const body = await res.json();

      expect(body.password).not.toBe("••••••••");
    });

    it("should return 404 for non-existent bot", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/bots/nonexistent"),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/bots/[id]", () => {
    it("should update a bot", async () => {
      const bot = await createBot();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/bots/${bot.id}`, "PUT", {
          nick: "UpdatedNick",
          status: "maintenance",
        }),
        makeParams(bot.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.nick).toBe("UpdatedNick");
      expect(body.status).toBe("maintenance");
    });

    it("should re-encrypt password on update", async () => {
      const bot = await createBot();

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/bots/${bot.id}`, "PUT", {
          password: "new-secret-password",
        }),
        makeParams(bot.id)
      );
      expect(res.status).toBe(200);

      const dbBot = await prisma.bot.findUnique({ where: { id: bot.id } });
      expect(decrypt(dbBot!.password)).toBe("new-secret-password");
    });

    it("should return 404 for non-existent bot", async () => {
      const res = await PUT(
        jsonReq("http://localhost:3000/api/bots/fake-id", "PUT", { nick: "Test" }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/bots/[id]", () => {
    it("should delete a bot", async () => {
      const bot = await createBot();

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/bots/${bot.id}`, { method: "DELETE" }),
        makeParams(bot.id)
      );
      expect(res.status).toBe(200);

      const dbBot = await prisma.bot.findUnique({ where: { id: bot.id } });
      expect(dbBot).toBeNull();
    });

    it("should return 404 for non-existent bot", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/bots/fake-id", { method: "DELETE" }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/bots/[id]/status", () => {
    it("should toggle bot status", async () => {
      const bot = await createBot({ status: "active" });

      const res = await PATCH(
        jsonReq(`http://localhost:3000/api/bots/${bot.id}/status`, "PATCH", {
          status: "inactive",
        }),
        makeParams(bot.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("inactive");
    });

    it("should reject invalid status", async () => {
      const bot = await createBot();

      const res = await PATCH(
        jsonReq(`http://localhost:3000/api/bots/${bot.id}/status`, "PATCH", {
          status: "invalid_status",
        }),
        makeParams(bot.id)
      );
      expect(res.status).toBe(400);
    });
  });
});
