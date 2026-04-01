import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPriceEntryInput,
  createPriceEntry,
  createDiscordSource,
  cleanupPrices,
  cleanupDiscordSources,
} from "@/tests/factories/price.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_STATS } from "./stats/route";
import { GET as GET_BY_ID, DELETE } from "./[id]/route";
import { GET as GET_SOURCES, POST as POST_SOURCE } from "../discord-sources/route";
import {
  GET as GET_SOURCE_BY_ID,
  PUT as PUT_SOURCE,
  DELETE as DELETE_SOURCE,
} from "../discord-sources/[id]/route";

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

describe("Prices API", () => {
  beforeEach(async () => {
    await cleanupPrices();
    await cleanupDiscordSources();
  });

  afterAll(async () => {
    await cleanupPrices();
    await cleanupDiscordSources();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // POST /api/prices — Bulk insert
  // ------------------------------------------------------------------
  describe("POST /api/prices", () => {
    it("should bulk insert price entries", async () => {
      const entries = [
        buildPriceEntryInput({ discordMessageId: "bulk-1" }),
        buildPriceEntryInput({ discordMessageId: "bulk-2" }),
        buildPriceEntryInput({ discordMessageId: "bulk-3" }),
      ];

      const res = await POST(
        jsonReq("http://localhost:3000/api/prices", "POST", { entries })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.created).toBe(3);
      expect(body.total).toBe(3);
    });

    it("should skip duplicates on discordMessageId", async () => {
      // Insert one first
      await createPriceEntry({ discordMessageId: "dup-msg-1" });

      const entries = [
        buildPriceEntryInput({ discordMessageId: "dup-msg-1" }),
        buildPriceEntryInput({ discordMessageId: "dup-msg-2" }),
      ];

      const res = await POST(
        jsonReq("http://localhost:3000/api/prices", "POST", { entries })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.created).toBe(1); // Only the new one
      expect(body.total).toBe(2);

      // Total in DB should be 2
      const count = await prisma.priceEntry.count();
      expect(count).toBe(2);
    });

    it("should reject empty entries array", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/prices", "POST", { entries: [] })
      );
      expect(res.status).toBe(400);
    });

    it("should reject invalid entry data", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/prices", "POST", {
          entries: [{ price: "abc" }],
        })
      );
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/prices — List with filters
  // ------------------------------------------------------------------
  describe("GET /api/prices", () => {
    it("should list prices with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await createPriceEntry();
      }

      const res = await GET(getReq("http://localhost:3000/api/prices?page=1&limit=3"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(3);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(2);
    });

    it("should filter by currency", async () => {
      await createPriceEntry({ currency: "divine" });
      await createPriceEntry({ currency: "chaos" });

      const res = await GET(getReq("http://localhost:3000/api/prices?currency=divine"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].currency).toBe("divine");
    });

    it("should filter by isCnl", async () => {
      await createPriceEntry({ isCnl: true });
      await createPriceEntry({ isCnl: false });

      const res = await GET(getReq("http://localhost:3000/api/prices?isCnl=true"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].isCnl).toBe(true);
    });

    it("should filter by league", async () => {
      await createPriceEntry({ league: "Settlers" });
      await createPriceEntry({ league: "Necropolis" });

      const res = await GET(getReq("http://localhost:3000/api/prices?league=Settlers"));
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].league).toBe("Settlers");
    });

    it("should order by messageTimestamp DESC", async () => {
      const older = new Date("2024-01-01T00:00:00Z");
      const newer = new Date("2024-06-01T00:00:00Z");

      await createPriceEntry({ messageTimestamp: older.toISOString() });
      await createPriceEntry({ messageTimestamp: newer.toISOString() });

      const res = await GET(getReq("http://localhost:3000/api/prices"));
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      const ts0 = new Date(body.data[0].messageTimestamp).getTime();
      const ts1 = new Date(body.data[1].messageTimestamp).getTime();
      expect(ts0).toBeGreaterThan(ts1);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/prices/stats
  // ------------------------------------------------------------------
  describe("GET /api/prices/stats", () => {
    it("should return price statistics", async () => {
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

      await createPriceEntry({
        isCnl: true,
        price: "2.00",
        currency: "divine",
        messageTimestamp: recent,
      });
      await createPriceEntry({
        isCnl: true,
        price: "3.00",
        currency: "divine",
        messageTimestamp: recent,
      });
      await createPriceEntry({
        isCnl: false,
        price: "1.50",
        currency: "divine",
        messageTimestamp: recent,
      });
      await createPriceEntry({
        isCnl: false,
        price: "2.50",
        currency: "divine",
        messageTimestamp: recent,
      });

      const res = await GET_STATS(
        getReq("http://localhost:3000/api/prices/stats?item=divine")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.item).toBe("divine");
      expect(body.currentCnlPrice).toBeDefined();
      expect(body.avgCnl7d).toBeCloseTo(2.5, 1);
      expect(body.avgMarket7d).toBeCloseTo(2.0, 1);
      expect(body.spreadCnlVsMarket).toBeDefined();
      expect(typeof body.spreadCnlVsMarket).toBe("number");
    });

    it("should return nulls when no data", async () => {
      const res = await GET_STATS(
        getReq("http://localhost:3000/api/prices/stats?currency=divine")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.currentCnlPrice).toBeNull();
      expect(body.avgCnl7d).toBeNull();
      expect(body.avgMarket7d).toBeNull();
      expect(body.spreadCnlVsMarket).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // GET /api/prices/[id] + DELETE
  // ------------------------------------------------------------------
  describe("GET /api/prices/[id]", () => {
    it("should get a single price entry", async () => {
      const entry = await createPriceEntry({ authorName: "SpecificUser" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/prices/${entry.id}`),
        makeParams(entry.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.authorName).toBe("SpecificUser");
    });

    it("should return 404 for non-existent entry", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/prices/nonexistent"),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/prices/[id]", () => {
    it("should delete a price entry", async () => {
      const entry = await createPriceEntry();

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/prices/${entry.id}`, {
          method: "DELETE",
        }),
        makeParams(entry.id)
      );
      expect(res.status).toBe(200);

      const dbEntry = await prisma.priceEntry.findUnique({
        where: { id: entry.id },
      });
      expect(dbEntry).toBeNull();
    });

    it("should return 404 for non-existent entry", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/prices/fake-id", {
          method: "DELETE",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // Discord Sources
  // ------------------------------------------------------------------
  describe("POST /api/discord-sources", () => {
    it("should create a discord source", async () => {
      const res = await POST_SOURCE(
        jsonReq("http://localhost:3000/api/discord-sources", "POST", {
          serverId: "srv-100",
          serverName: "My Server",
          channelId: "ch-200",
          channelName: "price-feed",
          cnlAuthorIds: ["author-1", "author-2"],
        })
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.serverId).toBe("srv-100");
      expect(body.channelName).toBe("price-feed");
      expect(body.cnlAuthorIds).toEqual(["author-1", "author-2"]);
    });

    it("should reject duplicate server+channel", async () => {
      await createDiscordSource({ serverId: "srv-dup", channelId: "ch-dup" });

      const res = await POST_SOURCE(
        jsonReq("http://localhost:3000/api/discord-sources", "POST", {
          serverId: "srv-dup",
          serverName: "Dup",
          channelId: "ch-dup",
          channelName: "Dup",
        })
      );
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/discord-sources", () => {
    it("should list all discord sources", async () => {
      await createDiscordSource();
      await createDiscordSource();

      const res = await GET_SOURCES(
        getReq("http://localhost:3000/api/discord-sources")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });

  describe("PUT /api/discord-sources/[id]", () => {
    it("should update a discord source", async () => {
      const source = await createDiscordSource();

      const res = await PUT_SOURCE(
        jsonReq(
          `http://localhost:3000/api/discord-sources/${source.id}`,
          "PUT",
          { channelName: "updated-channel", isActive: false }
        ),
        makeParams(source.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.channelName).toBe("updated-channel");
      expect(body.isActive).toBe(false);
    });

    it("should return 404 for non-existent source", async () => {
      const res = await PUT_SOURCE(
        jsonReq(
          "http://localhost:3000/api/discord-sources/fake-id",
          "PUT",
          { channelName: "nope" }
        ),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/discord-sources/[id]", () => {
    it("should delete a discord source", async () => {
      const source = await createDiscordSource();

      const res = await DELETE_SOURCE(
        new NextRequest(
          `http://localhost:3000/api/discord-sources/${source.id}`,
          { method: "DELETE" }
        ),
        makeParams(source.id)
      );
      expect(res.status).toBe(200);

      const dbSource = await prisma.discordSource.findUnique({
        where: { id: source.id },
      });
      expect(dbSource).toBeNull();
    });

    it("should return 404 for non-existent source", async () => {
      const res = await DELETE_SOURCE(
        new NextRequest("http://localhost:3000/api/discord-sources/fake-id", {
          method: "DELETE",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });
});
