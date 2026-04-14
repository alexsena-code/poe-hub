import { prisma } from "@/lib/prisma";

let counter = 0;

export function buildSimulationInput(overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    name: `Test Simulation ${counter}`,
    league: `League-${counter}`,
    durationWeeks: 2,
    status: "draft" as const,
    notes: null,
    ...overrides,
  };
}

export async function createSimulation(overrides: Record<string, unknown> = {}) {
  const input = buildSimulationInput(overrides);
  const durationWeeks = (input.durationWeeks as number) ?? 2;

  return prisma.simulation.create({
    data: {
      name: input.name as string,
      league: input.league as string,
      status: (input.status as "draft" | "active" | "archived") ?? "draft",
      durationWeeks,
      notes: input.notes as string | null,
      weeks: {
        create: Array.from({ length: durationWeeks }, (_, i) => ({
          weekNumber: i + 1,
          label: `Semana ${i + 1}`,
          defaultActiveBots: 1,
          defaultDivinePerHour: 0.5,
          defaultHoursPerDay: 24,
          days: {
            create: Array.from({ length: 7 }, (_, d) => ({
              dayNumber: d + 1,
            })),
          },
        })),
      },
    },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { dayNumber: "asc" } } },
      },
      costLinks: true,
    },
  });
}

export async function createCostConfig(overrides: Record<string, unknown> = {}) {
  counter++;
  return prisma.globalCostConfig.create({
    data: {
      name: `Test Config ${counter}`,
      proxyCostPerBotMonthly: 5.0,
      levelingCostPerBot: 10.0,
      stashPackCostPerBot: 0,
      expluginsKeyCostDaily: 1.5,
      dpbKeyCostDaily: 0.5,
      ...overrides,
    },
  });
}

export async function cleanupSimulations() {
  await prisma.simulationCostLink.deleteMany();
  await prisma.simulationDay.deleteMany();
  await prisma.simulationWeek.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.globalCostConfig.deleteMany();
}
