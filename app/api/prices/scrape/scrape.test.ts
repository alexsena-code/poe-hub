import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth before importing route
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Mock child_process to avoid spawning real processes
vi.mock("child_process", () => {
  const EventEmitter = require("events");

  function makeMockChild(exitCode = 0) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    // Emit close asynchronously so the stream setup completes first
    setTimeout(() => child.emit("close", exitCode), 10);
    return child;
  }

  return {
    spawn: vi.fn(() => makeMockChild(0)),
  };
});

// Mock fs to avoid touching the real filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
  unlinkSync: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";

function postReq(body: unknown = {}) {
  return new NextRequest("http://localhost:3000/api/prices/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/prices/scrape", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user", name: "admin", role: "admin" },
    } as never);
  });

  it("should return 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await POST(postReq());
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return SSE content-type on success", async () => {
    const res = await POST(postReq());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("should include cache-control and connection headers", async () => {
    const res = await POST(postReq());

    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("should clear exports directory json files when it exists", async () => {
    const fs = await import("fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readdirSync).mockReturnValueOnce(["export1.json", "notes.txt"] as never);

    await POST(postReq());

    // unlinkSync should have been called only for .json files
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  it("should accept full=true param and pass --full flag to child process", async () => {
    const { spawn } = await import("child_process");

    await POST(postReq({ full: true }));

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["--full"]),
      expect.any(Object)
    );
  });

  it("should not pass --full flag when full param is absent", async () => {
    const { spawn } = await import("child_process");
    vi.mocked(spawn).mockClear();

    await POST(postReq({}));

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      expect.not.arrayContaining(["--full"]),
      expect.any(Object)
    );
  });

  it("should return SSE stream body (ReadableStream)", async () => {
    const res = await POST(postReq());

    expect(res.body).not.toBeNull();
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it("should pass --from-cache flag when fromCache=true", async () => {
    const { spawn } = await import("child_process");
    vi.mocked(spawn).mockClear();

    await POST(postReq({ fromCache: true }));

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["--from-cache"]),
      expect.any(Object)
    );
  });

  it("should NOT clear exports when fromCache=true (preserve uploaded JSON)", async () => {
    const fs = await import("fs");
    vi.mocked(fs.unlinkSync).mockClear();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(["uploaded.json"] as never);

    await POST(postReq({ fromCache: true }));

    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
