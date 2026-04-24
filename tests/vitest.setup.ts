import { beforeAll } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Smoke tests opt-in: load real SANITY_* from .env only when SMOKE_SANITY=1.
// Runs at module-import time so any `describe.skipIf(...)` guards evaluate
// with the loaded vars present — `beforeAll` would be too late.
if (process.env.SMOKE_SANITY === "1") {
  loadDotEnv(path.resolve(process.cwd(), ".env"), [
    "SANITY_PROJECT_ID",
    "SANITY_DATASET",
    "SANITY_API_VERSION",
    "SANITY_API_WRITE_TOKEN",
  ]);
}

beforeAll(() => {
  // Ensure test env vars are set
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.NEXTAUTH_SECRET =
    process.env.NEXTAUTH_SECRET || "test-secret-do-not-use-in-production";
});

function loadDotEnv(filePath: string, whitelist: string[]): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!whitelist.includes(key)) continue;
    if (process.env[key]) continue;
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    process.env[key] = value;
  }
}
