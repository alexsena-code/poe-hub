import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth before importing route
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Mock fs to avoid touching the real filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  unlinkSync: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";

function uploadReq(content: string, filename = "export.json") {
  const form = new FormData();
  form.append("file", new File([content], filename, { type: "application/json" }));
  return new NextRequest("http://localhost:3000/api/prices/import", {
    method: "POST",
    body: form,
  });
}

const validExport = JSON.stringify({
  guild: { id: "g1", name: "PoE BR" },
  channel: { id: "c123", name: "precos-poe1" },
  messages: [{ id: "m1" }, { id: "m2" }],
});

describe("POST /api/prices/import", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user", name: "admin", role: "admin" },
    } as never);
  });

  it("should return 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await POST(uploadReq(validExport));
    expect(res.status).toBe(401);
  });

  it("should reject invalid JSON with 400", async () => {
    const res = await POST(uploadReq("{ not json"));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/JSON inválido/);
  });

  it("should reject JSON missing DiscordChatExporter shape with 400", async () => {
    const res = await POST(uploadReq(JSON.stringify({ foo: "bar" })));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/DiscordChatExporter/);
  });

  it("should save valid export to exports/<channelId>.json and return metadata", async () => {
    const fs = await import("fs");

    const res = await POST(uploadReq(validExport));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      channelId: "c123",
      channelName: "precos-poe1",
      serverName: "PoE BR",
      messages: 2,
      savedAs: "exports/c123.json",
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("c123.json"),
      validExport,
      "utf-8"
    );
  });
});
