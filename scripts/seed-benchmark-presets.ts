/**
 * Seeds BenchmarkPreset rows from the engine's canonical scenarios.yaml.
 *
 * Run manually:
 *   npm run seed:benchmarks
 *   npx tsx scripts/seed-benchmark-presets.ts
 *
 * Upserts on `(name, type)` so re-running is idempotent. Each scenario
 * becomes a preset where `name = scenario.id`, `type` = bucket, and
 * `payload` = the scenario object with `id` stripped (the UI already
 * carries the preset's name).
 *
 * Session 13 S13 (seed presets from scenarios.yaml). Defensive against
 * the legacy `build_guide:` alias still referenced by the engine CLI.
 */
import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import type { BenchmarkType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawScenario {
  id: string;
  [key: string]: unknown;
}

export interface ScenariosFile {
  qa?: RawScenario[];
  ideation?: RawScenario[];
  content_generation?: RawScenario[];
  /** Legacy alias — folded into content_generation if present. */
  build_guide?: RawScenario[];
}

interface BucketMap {
  qa: RawScenario[];
  ideation: RawScenario[];
  content_generation: RawScenario[];
}

export interface SeedSummary {
  qa: number;
  ideation: number;
  content_generation: number;
  created: number;
  updated: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SCENARIOS_PATH = path.resolve(
  __dirname,
  "../../path-of-trade-content/packages/api/scripts/benchmark/scenarios.yaml",
);

const SEED_NOTE = "Seeded from engine scenarios.yaml";

// ─── Parsing ──────────────────────────────────────────────────────────────────

function normalizeBuckets(parsed: ScenariosFile): BucketMap {
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `scenarios.yaml malformed: expected object, got ${typeof parsed}`,
    );
  }
  const contentGen = [
    ...(parsed.content_generation ?? []),
    ...(parsed.build_guide ?? []),
  ];
  return {
    qa: parsed.qa ?? [],
    ideation: parsed.ideation ?? [],
    content_generation: contentGen,
  };
}

function buildPayload(scenario: RawScenario): Prisma.InputJsonValue {
  const { id: _id, ...rest } = scenario;
  void _id; // payload strips id — it's redundant with the preset name.
  return rest as Prisma.InputJsonValue;
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Stable stringify — sorts keys recursively so Postgres JSON (which does not
 * preserve insertion order) compares equal to the fresh object from the YAML.
 * Without this, every re-run reports "updated" even when the payload is
 * identical.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

async function upsertOne(
  name: string,
  type: BenchmarkType,
  payload: Prisma.InputJsonValue,
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await prisma.benchmarkPreset.findUnique({
    where: { name_type: { name, type } },
  });
  if (!existing) {
    await prisma.benchmarkPreset.create({
      data: { name, type, payload, notes: SEED_NOTE },
    });
    return "created";
  }
  const same = stableStringify(existing.payload) === stableStringify(payload);
  if (same && existing.notes === SEED_NOTE) return "unchanged";
  await prisma.benchmarkPreset.update({
    where: { name_type: { name, type } },
    data: { payload, notes: SEED_NOTE },
  });
  return "updated";
}

async function seedBucket(
  type: BenchmarkType,
  scenarios: RawScenario[],
  counts: { created: number; updated: number },
): Promise<void> {
  for (const scenario of scenarios) {
    if (!scenario.id || typeof scenario.id !== "string") {
      throw new Error(
        `scenario missing id (bucket=${type}): ${JSON.stringify(scenario)}`,
      );
    }
    const result = await upsertOne(scenario.id, type, buildPayload(scenario));
    if (result === "created") counts.created++;
    else if (result === "updated") counts.updated++;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function seedPresetsFromParsed(
  parsed: ScenariosFile,
): Promise<SeedSummary> {
  const buckets = normalizeBuckets(parsed);
  const counts = { created: 0, updated: 0 };
  await seedBucket("qa", buckets.qa, counts);
  await seedBucket("ideation", buckets.ideation, counts);
  await seedBucket(
    "content_generation",
    buckets.content_generation,
    counts,
  );
  return {
    qa: buckets.qa.length,
    ideation: buckets.ideation.length,
    content_generation: buckets.content_generation.length,
    created: counts.created,
    updated: counts.updated,
  };
}

export async function seedPresets(yamlPath: string): Promise<SeedSummary> {
  const raw = fs.readFileSync(yamlPath, "utf-8");
  const parsed = YAML.parse(raw) as ScenariosFile;
  return seedPresetsFromParsed(parsed);
}

export function formatSummary(s: SeedSummary): string {
  return (
    `seeded ${s.qa} qa, ${s.ideation} ideation, ${s.content_generation} content_generation ` +
    `— ${s.created} new, ${s.updated} updated`
  );
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const yamlPath = process.argv[2] ?? DEFAULT_SCENARIOS_PATH;
  if (!fs.existsSync(yamlPath)) {
    throw new Error(
      `scenarios.yaml not found at ${yamlPath} (expected sibling repo path-of-trade-content)`,
    );
  }
  const summary = await seedPresets(yamlPath);
  console.log(formatSummary(summary));
}

// Only run when invoked as a script (not imported by tests).
const invokedDirectly =
  typeof require !== "undefined" && require.main === module;

if (invokedDirectly) {
  main()
    .catch((err) => {
      console.error(`[seed-benchmark-presets] failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
