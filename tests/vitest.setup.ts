import { beforeAll } from "vitest";

beforeAll(() => {
  // Ensure test env vars are set
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.NEXTAUTH_SECRET =
    process.env.NEXTAUTH_SECRET || "test-secret-do-not-use-in-production";
});
