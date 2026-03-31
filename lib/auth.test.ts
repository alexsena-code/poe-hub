import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock Prisma
const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// We test the authorize logic directly by importing authOptions
import { authOptions } from "./auth";

const credentialsProvider = authOptions.providers[0];
// Access the authorize function from the credentials provider
const authorize = (credentialsProvider as { options: { authorize: (credentials: Record<string, string>) => Promise<unknown> } }).options.authorize;

describe("auth - credentials provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when credentials are missing", async () => {
    const result = await authorize({} as Record<string, string>);
    expect(result).toBeNull();
  });

  it("should return null when user is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await authorize({
      username: "nonexistent",
      password: "password",
    });

    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { username: "nonexistent" },
    });
  });

  it("should return null when password is wrong", async () => {
    const hash = await bcrypt.hash("correct-password", 12);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      passwordHash: hash,
      role: "admin",
    });

    const result = await authorize({
      username: "admin",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("should return user when credentials are valid", async () => {
    const hash = await bcrypt.hash("correct-password", 12);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      passwordHash: hash,
      role: "admin",
    });

    const result = await authorize({
      username: "admin",
      password: "correct-password",
    });

    expect(result).toEqual({
      id: "user-1",
      name: "admin",
      role: "admin",
    });
  });

  it("should call jwt callback correctly", async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (!jwtCallback) throw new Error("jwt callback not found");

    // When user logs in (user object present)
    const token = await jwtCallback({
      token: { sub: "user-1" },
      user: { id: "user-1", name: "admin", role: "admin" },
    } as Parameters<typeof jwtCallback>[0]);

    expect(token.id).toBe("user-1");
    expect(token.role).toBe("admin");
  });

  it("should call session callback correctly", async () => {
    const sessionCallback = authOptions.callbacks?.session;
    if (!sessionCallback) throw new Error("session callback not found");

    const session = await sessionCallback({
      session: { user: { name: "admin" }, expires: "" },
      token: { id: "user-1", role: "admin", sub: "user-1" },
    } as Parameters<typeof sessionCallback>[0]);

    expect((session.user as { id: string }).id).toBe("user-1");
    expect((session.user as { role: string }).role).toBe("admin");
  });
});
