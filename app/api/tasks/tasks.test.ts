import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildTaskInput,
  createTask,
  createTestUser,
  cleanupTasks,
  cleanupTestUsers,
} from "@/tests/factories/task.factory";

// Mock next-auth to always return a session
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", name: "admin", role: "admin" },
  }),
}));

// Import routes after mocking
import { GET, POST } from "./route";
import { GET as GET_BY_ID, PUT, DELETE } from "./[id]/route";
import { PATCH as PATCH_STATUS } from "./[id]/status/route";
import { PATCH as PATCH_REORDER } from "./reorder/route";

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

describe("Tasks API", () => {
  beforeAll(async () => {
    await cleanupTasks();
    await createTestUser();
  });

  beforeEach(async () => {
    await cleanupTasks();
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await prisma.$disconnect();
  });

  // -------------------------------------------------------
  // POST /api/tasks
  // -------------------------------------------------------
  describe("POST /api/tasks", () => {
    it("should create a task (happy path)", async () => {
      const input = buildTaskInput({ title: "Implement feature X" });
      const res = await POST(
        jsonReq("http://localhost:3000/api/tasks", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.title).toBe("Implement feature X");
      expect(body.status).toBe("backlog");
      expect(body.priority).toBe("medium");
      expect(body.id).toBeDefined();
    });

    it("should reject missing title", async () => {
      const res = await POST(
        jsonReq("http://localhost:3000/api/tasks", "POST", { description: "no title" })
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("Validation failed");
    });

    it("should set createdBy from session user", async () => {
      const input = buildTaskInput();
      const res = await POST(
        jsonReq("http://localhost:3000/api/tasks", "POST", input)
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.createdBy).toBe("test-user-id");
      expect(body.creator.id).toBe("test-user-id");
    });
  });

  // -------------------------------------------------------
  // GET /api/tasks
  // -------------------------------------------------------
  describe("GET /api/tasks", () => {
    it("should list all tasks", async () => {
      await createTask({ title: "Task A" });
      await createTask({ title: "Task B" });

      const res = await GET(getReq("http://localhost:3000/api/tasks"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it("should filter by status", async () => {
      await createTask({ status: "backlog" });
      await createTask({ status: "done" });

      const res = await GET(
        getReq("http://localhost:3000/api/tasks?status=done")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("done");
    });

    it("should filter by priority", async () => {
      await createTask({ priority: "low" });
      await createTask({ priority: "urgent" });

      const res = await GET(
        getReq("http://localhost:3000/api/tasks?priority=urgent")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].priority).toBe("urgent");
    });

    it("should search by title", async () => {
      await createTask({ title: "Deploy new bots" });
      await createTask({ title: "Fix price scraper" });

      const res = await GET(
        getReq("http://localhost:3000/api/tasks?search=deploy")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe("Deploy new bots");
    });

    it("should paginate results", async () => {
      await createTask({ title: "T1" });
      await createTask({ title: "T2" });
      await createTask({ title: "T3" });

      const res = await GET(
        getReq("http://localhost:3000/api/tasks?page=1&limit=2")
      );
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.totalPages).toBe(2);
    });
  });

  // -------------------------------------------------------
  // GET /api/tasks/[id]
  // -------------------------------------------------------
  describe("GET /api/tasks/[id]", () => {
    it("should get a single task by id", async () => {
      const task = await createTask({ title: "Fetch me" });

      const res = await GET_BY_ID(
        getReq(`http://localhost:3000/api/tasks/${task.id}`),
        makeParams(task.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("Fetch me");
      expect(body.id).toBe(task.id);
    });

    it("should return 404 for non-existent task", async () => {
      const res = await GET_BY_ID(
        getReq("http://localhost:3000/api/tasks/nonexistent"),
        makeParams("nonexistent")
      );
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // PUT /api/tasks/[id]
  // -------------------------------------------------------
  describe("PUT /api/tasks/[id]", () => {
    it("should update task fields", async () => {
      const task = await createTask({ title: "Original" });

      const res = await PUT(
        jsonReq(`http://localhost:3000/api/tasks/${task.id}`, "PUT", {
          title: "Updated Title",
          priority: "high",
          module: "bots",
        }),
        makeParams(task.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("Updated Title");
      expect(body.priority).toBe("high");
      expect(body.module).toBe("bots");
    });

    it("should return 404 for non-existent task", async () => {
      const res = await PUT(
        jsonReq("http://localhost:3000/api/tasks/fake-id", "PUT", {
          title: "No task",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // DELETE /api/tasks/[id]
  // -------------------------------------------------------
  describe("DELETE /api/tasks/[id]", () => {
    it("should delete a task", async () => {
      const task = await createTask();

      const res = await DELETE(
        new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
          method: "DELETE",
        }),
        makeParams(task.id)
      );
      expect(res.status).toBe(200);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(dbTask).toBeNull();
    });

    it("should return 404 for non-existent task", async () => {
      const res = await DELETE(
        new NextRequest("http://localhost:3000/api/tasks/fake-id", {
          method: "DELETE",
        }),
        makeParams("fake-id")
      );
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // PATCH /api/tasks/[id]/status
  // -------------------------------------------------------
  describe("PATCH /api/tasks/[id]/status", () => {
    it("should change task status", async () => {
      const task = await createTask({ status: "backlog" });

      const res = await PATCH_STATUS(
        jsonReq(
          `http://localhost:3000/api/tasks/${task.id}/status`,
          "PATCH",
          { status: "in_progress" }
        ),
        makeParams(task.id)
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("in_progress");
    });

    it("should reject invalid status", async () => {
      const task = await createTask();

      const res = await PATCH_STATUS(
        jsonReq(
          `http://localhost:3000/api/tasks/${task.id}/status`,
          "PATCH",
          { status: "invalid_status" }
        ),
        makeParams(task.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // PATCH /api/tasks/reorder
  // -------------------------------------------------------
  describe("PATCH /api/tasks/reorder", () => {
    it("should batch reorder multiple tasks", async () => {
      const t1 = await createTask({ title: "Reorder A", status: "backlog", position: 0 });
      const t2 = await createTask({ title: "Reorder B", status: "backlog", position: 1 });
      const t3 = await createTask({ title: "Reorder C", status: "todo", position: 0 });

      const res = await PATCH_REORDER(
        jsonReq("http://localhost:3000/api/tasks/reorder", "PATCH", {
          tasks: [
            { id: t1.id, status: "todo", position: 0 },
            { id: t2.id, status: "todo", position: 1 },
            { id: t3.id, status: "backlog", position: 0 },
          ],
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.updated).toBe(3);

      // Verify in DB
      const updated1 = await prisma.task.findUnique({ where: { id: t1.id } });
      expect(updated1!.status).toBe("todo");
      expect(updated1!.position).toBe(0);

      const updated3 = await prisma.task.findUnique({ where: { id: t3.id } });
      expect(updated3!.status).toBe("backlog");
      expect(updated3!.position).toBe(0);
    });

    it("should return 404 when a task ID does not exist", async () => {
      const t1 = await createTask();

      const res = await PATCH_REORDER(
        jsonReq("http://localhost:3000/api/tasks/reorder", "PATCH", {
          tasks: [
            { id: t1.id, status: "backlog", position: 0 },
            { id: "00000000-0000-0000-0000-000000000000", status: "backlog", position: 1 },
          ],
        })
      );
      expect(res.status).toBe(404);
    });
  });
});
