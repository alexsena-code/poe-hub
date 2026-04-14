import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createInstance,
  createAlert,
  cleanupMonitor,
} from "@/tests/factories/monitor.factory";
import { createBot, cleanupBots } from "@/tests/factories/bot.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET as GET_ALERTS } from "./alerts/route";
import { PUT as ACKNOWLEDGE_ALERT } from "./alerts/[id]/route";
import { POST as ACKNOWLEDGE_ALL } from "./alerts/acknowledge-all/route";
import { GET as GET_INSTANCES } from "./instances/route";
import {
  GET as GET_INSTANCE,
  PUT as LINK_INSTANCE_BOT,
  DELETE as DELETE_INSTANCE,
} from "./instances/[id]/route";
import { GET as GET_STATS } from "./stats/route";

function getReq(url: string) {
  return new NextRequest(url);
}

function jsonReq(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Monitor API", () => {
  beforeEach(async () => {
    await cleanupMonitor();
    await cleanupBots();
  });

  afterAll(async () => {
    await cleanupMonitor();
    await cleanupBots();
    await prisma.$disconnect();
  });

  // =================================================================
  // GET /api/monitor/alerts
  // =================================================================
  describe("GET /api/monitor/alerts", () => {
    it("should return alerts with pagination", async () => {
      const inst = await createInstance();
      await createAlert(inst.id);
      await createAlert(inst.id);
      await createAlert(inst.id);

      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts?page=1&limit=2")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });

    it("should filter by instanceId", async () => {
      const inst1 = await createInstance();
      const inst2 = await createInstance();
      await createAlert(inst1.id);
      await createAlert(inst2.id);

      const res = await GET_ALERTS(
        getReq(
          `http://localhost:3000/api/monitor/alerts?instanceId=${inst1.id}`
        )
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].instanceId).toBe(inst1.id);
    });

    it("should filter by type", async () => {
      const inst = await createInstance();
      await createAlert(inst.id, { type: "error" });
      await createAlert(inst.id, { type: "loop" });

      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts?type=loop")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].type).toBe("loop");
    });

    it("should filter by severity", async () => {
      const inst = await createInstance();
      await createAlert(inst.id, { severity: "critical" });
      await createAlert(inst.id, { severity: "low" });

      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts?severity=critical")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].severity).toBe("critical");
    });

    it("should filter by acknowledged", async () => {
      const inst = await createInstance();
      await createAlert(inst.id, { acknowledged: false });
      await createAlert(inst.id, { acknowledged: true });

      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts?acknowledged=false")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].acknowledged).toBe(false);
    });

    it("should filter by date range", async () => {
      const inst = await createInstance();

      // Create alert with a known createdAt by inserting directly
      const oldAlert = await prisma.botAlert.create({
        data: {
          instanceId: inst.id,
          type: "error",
          severity: "high",
          title: "Old alert",
          message: "Old",
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      });
      const newAlert = await createAlert(inst.id, { title: "New alert" });

      const res = await GET_ALERTS(
        getReq(
          "http://localhost:3000/api/monitor/alerts?dateFrom=2025-01-01T00:00:00Z"
        )
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(newAlert.id);
    });

    it("should include instance info in response", async () => {
      const inst = await createInstance({ pcName: "MyPC", configName: "Cfg1" });
      await createAlert(inst.id);

      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts")
      );
      const body = await res.json();

      expect(body.data[0].instance).toEqual({
        id: inst.id,
        pcName: "MyPC",
        configName: "Cfg1",
      });
    });

    it("should reject invalid query parameters", async () => {
      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts?type=invalid_type")
      );
      expect(res.status).toBe(400);
    });

    it("should return empty data when no alerts exist", async () => {
      const res = await GET_ALERTS(
        getReq("http://localhost:3000/api/monitor/alerts")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // =================================================================
  // PUT /api/monitor/alerts/[id] (acknowledge)
  // =================================================================
  describe("PUT /api/monitor/alerts/[id]", () => {
    it("should acknowledge an alert", async () => {
      const inst = await createInstance();
      const alert = await createAlert(inst.id);

      const res = await ACKNOWLEDGE_ALERT(
        jsonReq(
          `http://localhost:3000/api/monitor/alerts/${alert.id}`,
          "PUT",
          { acknowledged: true }
        ),
        makeParams(alert.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.acknowledged).toBe(true);
      expect(body.acknowledgedAt).not.toBeNull();
    });

    it("should include instance info in response", async () => {
      const inst = await createInstance({ pcName: "AckPC" });
      const alert = await createAlert(inst.id);

      const res = await ACKNOWLEDGE_ALERT(
        jsonReq(
          `http://localhost:3000/api/monitor/alerts/${alert.id}`,
          "PUT",
          { acknowledged: true }
        ),
        makeParams(alert.id)
      );
      const body = await res.json();

      expect(body.instance.pcName).toBe("AckPC");
    });

    it("should return 404 for non-existent alert", async () => {
      const res = await ACKNOWLEDGE_ALERT(
        jsonReq(
          "http://localhost:3000/api/monitor/alerts/nonexistent",
          "PUT",
          { acknowledged: true }
        ),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("should reject invalid body", async () => {
      const inst = await createInstance();
      const alert = await createAlert(inst.id);

      const res = await ACKNOWLEDGE_ALERT(
        jsonReq(
          `http://localhost:3000/api/monitor/alerts/${alert.id}`,
          "PUT",
          { acknowledged: false }
        ),
        makeParams(alert.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // POST /api/monitor/alerts/acknowledge-all
  // =================================================================
  describe("POST /api/monitor/alerts/acknowledge-all", () => {
    it("should acknowledge all unacknowledged alerts", async () => {
      const inst = await createInstance();
      await createAlert(inst.id, { acknowledged: false });
      await createAlert(inst.id, { acknowledged: false });
      await createAlert(inst.id, { acknowledged: true });

      const res = await ACKNOWLEDGE_ALL();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.acknowledgedCount).toBe(2);

      // Verify in DB
      const unacked = await prisma.botAlert.count({
        where: { acknowledged: false },
      });
      expect(unacked).toBe(0);
    });

    it("should return 0 count when nothing to acknowledge", async () => {
      const res = await ACKNOWLEDGE_ALL();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.acknowledgedCount).toBe(0);
    });
  });

  // =================================================================
  // GET /api/monitor/instances
  // =================================================================
  describe("GET /api/monitor/instances", () => {
    it("should return instances grouped by pcName", async () => {
      await createInstance({ pcName: "PC-A", configName: "C1" });
      await createInstance({ pcName: "PC-A", configName: "C2" });
      await createInstance({ pcName: "PC-B", configName: "C1" });

      const res = await GET_INSTANCES();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.total).toBe(3);
      expect(body.data).toHaveLength(2); // 2 PCs

      const pcA = body.data.find(
        (g: { pcName: string }) => g.pcName === "PC-A"
      );
      expect(pcA.instances).toHaveLength(2);
    });

    it("should include linked bot info", async () => {
      const bot = await createBot({ nick: "LinkedBot" });
      await createInstance({ pcName: "PC-X", botId: bot.id });

      const res = await GET_INSTANCES();
      const body = await res.json();

      const inst = body.data[0].instances[0];
      expect(inst.bot).toEqual({ id: bot.id, nick: "LinkedBot" });
    });

    it("should return null bot when not linked", async () => {
      await createInstance();

      const res = await GET_INSTANCES();
      const body = await res.json();

      expect(body.data[0].instances[0].bot).toBeNull();
    });

    it("should return empty when no instances", async () => {
      const res = await GET_INSTANCES();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  // =================================================================
  // GET /api/monitor/instances/[id]
  // =================================================================
  describe("GET /api/monitor/instances/[id]", () => {
    it("should return a single instance", async () => {
      const inst = await createInstance({ pcName: "Solo" });

      const res = await GET_INSTANCE(
        getReq(`http://localhost:3000/api/monitor/instances/${inst.id}`),
        makeParams(inst.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pcName).toBe("Solo");
      expect(body.id).toBe(inst.id);
    });

    it("should return 404 for non-existent instance", async () => {
      const res = await GET_INSTANCE(
        getReq("http://localhost:3000/api/monitor/instances/nonexistent"),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // PUT /api/monitor/instances/[id] (link bot)
  // =================================================================
  describe("PUT /api/monitor/instances/[id]", () => {
    it("should link a bot to an instance", async () => {
      const bot = await createBot({ nick: "Linkable" });
      const inst = await createInstance();

      const res = await LINK_INSTANCE_BOT(
        jsonReq(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          "PUT",
          { botId: bot.id }
        ),
        makeParams(inst.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.botId).toBe(bot.id);
      expect(body.bot).toEqual({ id: bot.id, nick: "Linkable" });
    });

    it("should unlink a bot by setting botId to null", async () => {
      const bot = await createBot();
      const inst = await createInstance({ botId: bot.id });

      const res = await LINK_INSTANCE_BOT(
        jsonReq(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          "PUT",
          { botId: null }
        ),
        makeParams(inst.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.botId).toBeNull();
      expect(body.bot).toBeNull();
    });

    it("should return 404 for non-existent instance", async () => {
      const res = await LINK_INSTANCE_BOT(
        jsonReq(
          "http://localhost:3000/api/monitor/instances/nonexistent",
          "PUT",
          { botId: null }
        ),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent bot", async () => {
      const inst = await createInstance();
      const fakeBotId = "00000000-0000-0000-0000-000000000000";

      const res = await LINK_INSTANCE_BOT(
        jsonReq(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          "PUT",
          { botId: fakeBotId }
        ),
        makeParams(inst.id)
      );
      expect(res.status).toBe(404);
    });

    it("should reject invalid botId format", async () => {
      const inst = await createInstance();

      const res = await LINK_INSTANCE_BOT(
        jsonReq(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          "PUT",
          { botId: "not-a-uuid" }
        ),
        makeParams(inst.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // =================================================================
  // DELETE /api/monitor/instances/[id]
  // =================================================================
  describe("DELETE /api/monitor/instances/[id]", () => {
    it("should delete an instance", async () => {
      const inst = await createInstance();

      const res = await DELETE_INSTANCE(
        new NextRequest(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          { method: "DELETE" }
        ),
        makeParams(inst.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const dbInst = await prisma.botInstance.findUnique({
        where: { id: inst.id },
      });
      expect(dbInst).toBeNull();
    });

    it("should cascade delete alerts when instance is deleted", async () => {
      const inst = await createInstance();
      await createAlert(inst.id);
      await createAlert(inst.id);

      await DELETE_INSTANCE(
        new NextRequest(
          `http://localhost:3000/api/monitor/instances/${inst.id}`,
          { method: "DELETE" }
        ),
        makeParams(inst.id)
      );

      const alertCount = await prisma.botAlert.count({
        where: { instanceId: inst.id },
      });
      expect(alertCount).toBe(0);
    });

    it("should return 404 for non-existent instance", async () => {
      const res = await DELETE_INSTANCE(
        new NextRequest(
          "http://localhost:3000/api/monitor/instances/nonexistent",
          { method: "DELETE" }
        ),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  // =================================================================
  // GET /api/monitor/stats
  // =================================================================
  describe("GET /api/monitor/stats", () => {
    it("should return aggregate stats", async () => {
      const inst1 = await createInstance({ isOnline: true });
      const inst2 = await createInstance({ isOnline: false });
      await createAlert(inst1.id, { type: "error", acknowledged: false });
      await createAlert(inst1.id, { type: "loop", acknowledged: false });

      const res = await GET_STATS();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.totalInstances).toBe(2);
      expect(body.onlineCount).toBe(1);
      expect(body.offlineCount).toBe(1);
      expect(body.totalAlertsToday).toBeGreaterThanOrEqual(2);
      expect(body.errorCountToday).toBeGreaterThanOrEqual(1);
    });

    it("should group instances by pcName", async () => {
      await createInstance({ pcName: "PC-S1", configName: "A", isOnline: true });
      await createInstance({
        pcName: "PC-S1",
        configName: "B",
        isOnline: false,
      });
      await createInstance({ pcName: "PC-S2", configName: "A", isOnline: true });

      const res = await GET_STATS();
      const body = await res.json();

      expect(body.pcs).toHaveLength(2);

      const pc1 = body.pcs.find(
        (p: { pcName: string }) => p.pcName === "PC-S1"
      );
      expect(pc1.total).toBe(2);
      expect(pc1.online).toBe(1);
      expect(pc1.offline).toBe(1);
    });

    it("should return zeros when no data", async () => {
      const res = await GET_STATS();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.totalInstances).toBe(0);
      expect(body.onlineCount).toBe(0);
      expect(body.offlineCount).toBe(0);
      expect(body.totalAlertsToday).toBe(0);
      expect(body.errorCountToday).toBe(0);
      expect(body.pcs).toHaveLength(0);
    });
  });
});
