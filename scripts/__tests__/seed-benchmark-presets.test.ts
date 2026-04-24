/**
 * Integration tests for the benchmark preset seeder.
 *
 * Uses the real `potc_test` DB (per CLAUDE.md — no Prisma mocks).
 *
 * Session 13 S13 — seed-benchmark-presets.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  seedPresetsFromParsed,
  type ScenariosFile,
} from "../seed-benchmark-presets";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function buildFixture(): ScenariosFile {
  return {
    qa: [
      {
        id: "qa.mechanic_rf",
        question: "How does Righteous Fire scale?",
        queryType: "mechanic",
        language: "en",
      },
    ],
    ideation: [
      {
        id: "ideation.mechanic_guide_shortlist",
        editorialBriefing: "Focus on mid-tier mapping strategies.",
        templateFilter: ["mechanic_guide", "faq"],
      },
    ],
    content_generation: [
      {
        id: "build_guide.rf_chieftain",
        briefing: {
          skill: "Righteous Fire",
          ascendancy: "Chieftain",
          language: "en",
        },
      },
    ],
  };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  await prisma.benchmarkPreset.deleteMany();
});

afterAll(async () => {
  await prisma.benchmarkPreset.deleteMany();
  await prisma.$disconnect();
});

// ─── Cases ────────────────────────────────────────────────────────────────────

describe("seedPresetsFromParsed", () => {
  it("creates one preset per scenario across all three buckets", async () => {
    const summary = await seedPresetsFromParsed(buildFixture());

    expect(summary).toEqual({
      qa: 1,
      ideation: 1,
      content_generation: 1,
      created: 3,
      updated: 0,
    });

    const rows = await prisma.benchmarkPreset.findMany({
      orderBy: { name: "asc" },
    });
    expect(rows).toHaveLength(3);

    const qa = rows.find((r) => r.name === "qa.mechanic_rf");
    expect(qa?.type).toBe("qa");
    // payload strips `id` — it duplicates the preset's name field.
    expect(qa?.payload).toEqual({
      question: "How does Righteous Fire scale?",
      queryType: "mechanic",
      language: "en",
    });
    expect(qa?.notes).toBe("Seeded from engine scenarios.yaml");

    const ideation = rows.find(
      (r) => r.name === "ideation.mechanic_guide_shortlist",
    );
    expect(ideation?.type).toBe("ideation");

    const contentGen = rows.find((r) => r.name === "build_guide.rf_chieftain");
    expect(contentGen?.type).toBe("content_generation");
  });

  it("is idempotent when re-run with the same payload", async () => {
    const fixture = buildFixture();
    const first = await seedPresetsFromParsed(fixture);
    expect(first.created).toBe(3);

    const second = await seedPresetsFromParsed(fixture);
    expect(second).toEqual({
      qa: 1,
      ideation: 1,
      content_generation: 1,
      created: 0,
      updated: 0,
    });

    // Row count unchanged — upsert on (name, type) worked.
    const count = await prisma.benchmarkPreset.count();
    expect(count).toBe(3);
  });

  it("updates the payload when the scenario changed", async () => {
    await seedPresetsFromParsed(buildFixture());

    const mutated = buildFixture();
    mutated.qa![0].question = "How does Righteous Fire interact with Vaal Pact?";

    const summary = await seedPresetsFromParsed(mutated);
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);

    const row = await prisma.benchmarkPreset.findUnique({
      where: { name_type: { name: "qa.mechanic_rf", type: "qa" } },
    });
    expect(row?.payload).toMatchObject({
      question: "How does Righteous Fire interact with Vaal Pact?",
    });
  });
});
