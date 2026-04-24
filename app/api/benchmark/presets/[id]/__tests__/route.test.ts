/**
 * Integration tests for:
 *   GET    /api/benchmark/presets/[id]
 *   PATCH  /api/benchmark/presets/[id]
 *   DELETE /api/benchmark/presets/[id]
 *
 * Uses the real `potc_test` DB (per CLAUDE.md — no Prisma mocks).
 * Auth is mocked via vi.mock("next-auth").
 *
 * Session 13 S13.a — benchmark presets CRUD.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);

// ─── Route imports (after mock) ───────────────────────────────────────────────

import { GET, PATCH, DELETE } from "../route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_URL = "http://localhost/api/benchmark/presets";

async function cleanupPresets(): Promise<void> {
  await prisma.benchmarkPreset.deleteMany();
}

/** Creates a preset directly in the DB for test setup. */
async function seedPreset(overrides?: Partial<{
  name: string;
  type: "qa" | "ideation" | "content_generation";
  payload: Record<string, unknown>;
  notes: string;
}>) {
  return prisma.benchmarkPreset.create({
    data: {
      name: overrides?.name ?? "Test Preset",
      type: overrides?.type ?? "qa",
      payload: (overrides?.payload ?? { question: "What is the best build?" }) as never,
      notes: overrides?.notes ?? null,
    },
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: "test-user", name: "admin" } });
  await cleanupPresets();
});

afterAll(async () => {
  await cleanupPresets();
  await prisma.$disconnect();
});

// ─── GET [id] ─────────────────────────────────────────────────────────────────

describe("GET /api/benchmark/presets/[id]", () => {
  it("returns the preset when it exists", async () => {
    const preset = await seedPreset({ name: "My QA preset" });

    const res = await GET(
      buildReq(`${BASE_URL}/${preset.id}`, "GET"),
      makeParams(preset.id),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(preset.id);
    expect(data.name).toBe("My QA preset");
    expect(data.type).toBe("qa");
  });

  it("returns 404 when preset does not exist", async () => {
    const res = await GET(
      buildReq(`${BASE_URL}/nonexistent-id`, "GET"),
      makeParams("nonexistent-id"),
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });

  it("returns 401 when no session", async () => {
    mockSession.mockResolvedValue(null);
    const preset = await seedPreset();

    const res = await GET(
      buildReq(`${BASE_URL}/${preset.id}`, "GET"),
      makeParams(preset.id),
    );
    expect(res.status).toBe(401);
  });
});

// ─── PATCH [id] ───────────────────────────────────────────────────────────────

describe("PATCH /api/benchmark/presets/[id]", () => {
  it("updates payload only and leaves other fields unchanged", async () => {
    const preset = await seedPreset({
      name: "Original Name",
      type: "qa",
      payload: { question: "Old question?" },
      notes: "original notes",
    });

    const res = await PATCH(
      buildReq(`${BASE_URL}/${preset.id}`, "PATCH", {
        payload: { question: "Updated question?", language: "en" },
      }),
      makeParams(preset.id),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payload).toMatchObject({ question: "Updated question?", language: "en" });
    // name and notes should be untouched
    expect(data.name).toBe("Original Name");
    expect(data.notes).toBe("original notes");
  });

  it("updates name only", async () => {
    const preset = await seedPreset({ name: "Old Name" });

    const res = await PATCH(
      buildReq(`${BASE_URL}/${preset.id}`, "PATCH", { name: "New Name" }),
      makeParams(preset.id),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
  });

  it("clears notes when notes is null", async () => {
    const preset = await seedPreset({ notes: "some notes" });

    const res = await PATCH(
      buildReq(`${BASE_URL}/${preset.id}`, "PATCH", { notes: null }),
      makeParams(preset.id),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes).toBeNull();
  });

  it("returns 400 when caller attempts to change type", async () => {
    const preset = await seedPreset({ type: "qa" });

    const res = await PATCH(
      buildReq(`${BASE_URL}/${preset.id}`, "PATCH", {
        type: "ideation",
        payload: { editorialBriefing: "switching types" },
      }),
      makeParams(preset.id),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/cannot change preset type/i);
  });

  it("returns 404 when preset does not exist", async () => {
    const res = await PATCH(
      buildReq(`${BASE_URL}/nonexistent-id`, "PATCH", { name: "Won't exist" }),
      makeParams("nonexistent-id"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockSession.mockResolvedValue(null);
    const preset = await seedPreset();

    const res = await PATCH(
      buildReq(`${BASE_URL}/${preset.id}`, "PATCH", { name: "New" }),
      makeParams(preset.id),
    );
    expect(res.status).toBe(401);
  });
});

// ─── DELETE [id] ──────────────────────────────────────────────────────────────

describe("DELETE /api/benchmark/presets/[id]", () => {
  it("deletes the preset and returns 204", async () => {
    const preset = await seedPreset();

    const res = await DELETE(
      buildReq(`${BASE_URL}/${preset.id}`, "DELETE"),
      makeParams(preset.id),
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 on subsequent GET after delete", async () => {
    const preset = await seedPreset();

    await DELETE(
      buildReq(`${BASE_URL}/${preset.id}`, "DELETE"),
      makeParams(preset.id),
    );

    const getRes = await GET(
      buildReq(`${BASE_URL}/${preset.id}`, "GET"),
      makeParams(preset.id),
    );
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when preset does not exist", async () => {
    const res = await DELETE(
      buildReq(`${BASE_URL}/nonexistent-id`, "DELETE"),
      makeParams("nonexistent-id"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockSession.mockResolvedValue(null);
    const preset = await seedPreset();

    const res = await DELETE(
      buildReq(`${BASE_URL}/${preset.id}`, "DELETE"),
      makeParams(preset.id),
    );
    expect(res.status).toBe(401);
  });
});
